import fs from "node:fs";
import { prisma } from "../db";
import { openJson, sealJson } from "../crypto";
import { requireCredential } from "../settings";
import { recordUsage } from "../usage";

// YouTube (Data API v3) : connexion OAuth avec le projet Google Cloud du client, publication des clips en Shorts,
// statistiques de la chaîne. Chaque appel consomme du quota (10 000 unités par jour par défaut, remis à zéro à minuit heure du Pacifique).
export const YT_SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
// Coût en unités de quota, d'après la grille Google (à vérifier sur developers.google.com/youtube/v3/determine_quota_cost).
export const YT_QUOTA = { upload: 1600, read: 1 } as const;
export const YT_DAILY_QUOTA = Number(process.env.YOUTUBE_DAILY_QUOTA ?? 10_000);
const API = () => process.env.YOUTUBE_API_BASE ?? "https://www.googleapis.com/youtube/v3";
const UPLOAD = () => process.env.YOUTUBE_UPLOAD_BASE ?? "https://www.googleapis.com/upload/youtube/v3";
const TOKEN = () => process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const redirectUri = () => `${process.env.APP_URL ?? "http://localhost:3000"}/api/youtube/callback`;

export async function ytAuthorizeUrl(state: string) {
  const id = await requireCredential("google_client_id");
  // access_type=offline + prompt=consent : Google renvoie un jeton de rafraîchissement à chaque connexion.
  const p = new URLSearchParams({ client_id: id, redirect_uri: redirectUri(), response_type: "code", scope: YT_SCOPES, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function token(params: Record<string, string>) {
  const body = new URLSearchParams({ client_id: await requireCredential("google_client_id"), client_secret: await requireCredential("google_client_secret"), ...params });
  const r = await fetch(TOKEN(), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`Google OAuth : ${j.error_description ?? j.error ?? r.status}`);
  return j as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}

async function quota(userId: string, units: number, what: string) {
  await recordUsage({ userId, provider: "youtube", kind: "quota", units, unitLabel: "unités", costUsd: 0, meta: { what } });
}

async function call(userId: string, t: string, path: string, params: Record<string, string>) {
  const r = await fetch(`${API()}${path}?${new URLSearchParams(params)}`, { headers: { authorization: `Bearer ${t}` } });
  const j = await r.json();
  await quota(userId, YT_QUOTA.read, path);
  if (!r.ok || j.error) throw new Error(`YouTube : ${j.error?.message ?? r.status}`);
  return j;
}

export async function ytExchangeCode(code: string, userId: string) {
  const j = await token({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  const ch = await call(userId, j.access_token, "/channels", { part: "snippet", mine: "true" });
  const c = ch.items?.[0];
  if (!c) throw new Error("Aucune chaîne YouTube sur ce compte Google : crée-la d'abord sur youtube.com");
  const data = {
    openId: c.id, displayName: c.snippet?.title ?? null, avatarUrl: c.snippet?.thumbnails?.default?.url ?? null,
    accessEnc: sealJson(j.access_token, "youtube"), refreshEnc: j.refresh_token ? sealJson(j.refresh_token, "youtube") : null,
    expiresAt: new Date(Date.now() + j.expires_in * 1000), scopes: j.scope ?? YT_SCOPES,
  };
  await prisma.socialAccount.upsert({ where: { userId_platform: { userId, platform: "youtube" } }, update: data, create: { userId, platform: "youtube", ...data } });
}

async function accessToken(userId: string) {
  const a = await prisma.socialAccount.findUnique({ where: { userId_platform: { userId, platform: "youtube" } } });
  if (!a) throw new Error("Chaîne YouTube non connectée");
  if (a.expiresAt && a.expiresAt.getTime() - Date.now() > 60_000) return { token: openJson(a.accessEnc, "youtube"), channelId: a.openId };
  if (!a.refreshEnc) throw new Error("Session YouTube expirée : reconnecte la chaîne");
  const j = await token({ grant_type: "refresh_token", refresh_token: openJson(a.refreshEnc, "youtube") }).catch(() => { throw new Error("Session YouTube expirée : reconnecte la chaîne"); });
  await prisma.socialAccount.update({
    where: { id: a.id },
    // Google ne renvoie pas toujours de nouveau jeton de rafraîchissement : on garde l'ancien.
    data: { accessEnc: sealJson(j.access_token, "youtube"), expiresAt: new Date(Date.now() + j.expires_in * 1000), ...(j.refresh_token ? { refreshEnc: sealJson(j.refresh_token, "youtube") } : {}) },
  });
  return { token: j.access_token, channelId: a.openId };
}

// Visibilité YouTube à partir d'une valeur TikTok (publication automatique) ou directe.
export function ytPrivacy(v?: string | null): "private" | "unlisted" | "public" {
  if (v === "public" || v === "PUBLIC_TO_EVERYONE") return "public";
  if (v === "unlisted" || v === "MUTUAL_FOLLOW_FRIENDS") return "unlisted";
  return "private";
}

// Titre (100 caractères max, sans < >) et description d'un Short : le mot-clé #Shorts aide YouTube à le classer.
export function shortMeta(caption: string) {
  const clean = caption.replace(/[<>]/g, "").trim();
  const first = clean.split("\n")[0] || "Clip";
  const tag = " #Shorts";
  const title = (first.length + tag.length > 100 ? `${first.slice(0, 100 - tag.length - 1).trimEnd()}…` : first) + (/#shorts/i.test(first) ? "" : tag);
  const description = /#shorts/i.test(clean) ? clean : `${clean}\n\n#Shorts`.trim();
  return { title: title.trim(), description: description.slice(0, 5000) };
}

// Publication en Short : vidéo verticale de 3 min maximum, envoi « resumable » en une fois.
// Tant que le projet Google Cloud n'a pas passé l'audit YouTube, Google force les vidéos envoyées par l'API en privé.
export async function ytPublishShort(userId: string, file: string, caption: string, privacy?: string | null) {
  const { token: t } = await accessToken(userId);
  const size = fs.statSync(file).size;
  const { title, description } = shortMeta(caption);
  const init = await fetch(`${UPLOAD()}/videos?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: { authorization: `Bearer ${t}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-length": String(size), "x-upload-content-type": "video/mp4" },
    body: JSON.stringify({
      snippet: { title, description, categoryId: "22" },
      status: { privacyStatus: ytPrivacy(privacy), selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) { const j = await init.json().catch(() => ({})); throw new Error(`YouTube : ${j.error?.message ?? init.status}`); }
  const loc = init.headers.get("location");
  if (!loc) throw new Error("YouTube : adresse d'envoi absente");
  const up = await fetch(loc, { method: "PUT", headers: { "content-type": "video/mp4", "content-length": String(size) }, body: fs.readFileSync(file) });
  const j = await up.json().catch(() => ({}));
  await quota(userId, YT_QUOTA.upload, "videos.insert");
  if (!up.ok || !j.id) throw new Error(`Envoi YouTube : ${j.error?.message ?? up.status}`);
  return String(j.id);
}

export async function ytSnapshot(userId: string) {
  const { token: t } = await accessToken(userId);
  const ch = await call(userId, t, "/channels", { part: "statistics,contentDetails", mine: "true" });
  const c = ch.items?.[0];
  if (!c) throw new Error("Chaîne YouTube introuvable");
  const uploads = c.contentDetails?.relatedPlaylists?.uploads;
  const list = uploads ? await call(userId, t, "/playlistItems", { part: "contentDetails", playlistId: uploads, maxResults: "20" }).catch(() => ({ items: [] })) : { items: [] };
  const ids = (list.items ?? []).map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId).join(",");
  const vids = ids ? await call(userId, t, "/videos", { part: "snippet,statistics", id: ids }) : { items: [] };
  const top = (vids.items ?? []).map((v: Record<string, any>) => ({ title: v.snippet?.title ?? "", views: Number(v.statistics?.viewCount ?? 0), likes: Number(v.statistics?.likeCount ?? 0), date: v.snippet?.publishedAt ?? "" }));
  return {
    followers: Number(c.statistics?.subscriberCount ?? 0), videos: Number(c.statistics?.videoCount ?? 0),
    likes: top.reduce((a: number, v: { likes: number }) => a + v.likes, 0), views: top.reduce((a: number, v: { views: number }) => a + v.views, 0),
    top: top.sort((a: { views: number }, b: { views: number }) => b.views - a.views).slice(0, 10),
  };
}

// Début de la journée de quota (minuit heure du Pacifique) pour l'affichage dans Usage.
export function quotaDayStart(now = new Date()) {
  const pt = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offset = now.getTime() - pt.getTime();
  pt.setHours(0, 0, 0, 0);
  return new Date(pt.getTime() + offset);
}
