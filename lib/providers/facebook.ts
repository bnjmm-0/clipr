import fs from "node:fs";
import { prisma } from "../db";
import { openJson, sealJson } from "../crypto";
import { requireCredential } from "../settings";
import { recordUsage } from "../usage";

// Facebook (Meta Graph API) : connexion via l'app Meta du client, publication en Reels sur une Page, statistiques de la Page.
const V = "v21.0";
const G = `https://graph.facebook.com/${V}`;
export const FB_SCOPES = "pages_show_list,pages_read_engagement,pages_manage_posts,read_insights,business_management";
const redirectUri = () => `${process.env.APP_URL ?? "http://localhost:3000"}/api/facebook/callback`;

export async function fbAuthorizeUrl(state: string) {
  const id = await requireCredential("meta_app_id");
  const p = new URLSearchParams({ client_id: id, redirect_uri: redirectUri(), state, scope: FB_SCOPES, response_type: "code" });
  return `https://www.facebook.com/${V}/dialog/oauth?${p}`;
}

async function gget(path: string, params: Record<string, string>) {
  const r = await fetch(`${G}${path}?${new URLSearchParams(params)}`);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`Facebook : ${j.error?.message ?? r.status}`);
  return j;
}

// Échange le code, récupère un jeton longue durée puis la première Page gérée (jeton de Page sans expiration).
export async function fbExchangeCode(code: string, userId: string) {
  const client_id = await requireCredential("meta_app_id");
  const client_secret = await requireCredential("meta_app_secret");
  const short = await gget("/oauth/access_token", { client_id, client_secret, redirect_uri: redirectUri(), code });
  const long = await gget("/oauth/access_token", { grant_type: "fb_exchange_token", client_id, client_secret, fb_exchange_token: short.access_token });
  const pages = await gget("/me/accounts", { access_token: long.access_token, fields: "id,name,access_token,picture{url}" });
  const page = pages.data?.[0];
  if (!page) throw new Error("Aucune Page Facebook trouvée sur ce compte");
  const data = { openId: page.id, displayName: page.name, avatarUrl: page.picture?.data?.url ?? null, accessEnc: sealJson(page.access_token, "facebook"), refreshEnc: null, expiresAt: null, scopes: FB_SCOPES };
  await prisma.socialAccount.upsert({ where: { userId_platform: { userId, platform: "facebook" } }, update: data, create: { userId, platform: "facebook", ...data } });
}

async function page(userId: string) {
  const a = await prisma.socialAccount.findUnique({ where: { userId_platform: { userId, platform: "facebook" } } });
  if (!a) throw new Error("Page Facebook non connectée");
  return { id: a.openId, token: openJson(a.accessEnc, "facebook") };
}

// Publication d'un Reel : start → envoi du fichier → finish (publié).
export async function fbPublishReel(userId: string, file: string, description: string) {
  const p = await page(userId);
  const start = await fetch(`${G}/${p.id}/video_reels`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ upload_phase: "start", access_token: p.token }) }).then((r) => r.json());
  if (start.error) throw new Error(`Facebook : ${start.error.message}`);
  const size = fs.statSync(file).size;
  const up = await fetch(`https://rupload.facebook.com/video-upload/${V}/${start.video_id}`, {
    method: "POST", headers: { authorization: `OAuth ${p.token}`, offset: "0", file_size: String(size) }, body: fs.readFileSync(file),
  }).then((r) => r.json());
  if (!up.success) throw new Error(`Envoi Facebook : ${JSON.stringify(up).slice(0, 200)}`);
  const fin = await fetch(`${G}/${p.id}/video_reels`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ upload_phase: "finish", video_id: start.video_id, video_state: "PUBLISHED", description: description.slice(0, 2200), access_token: p.token }),
  }).then((r) => r.json());
  if (fin.error) throw new Error(`Facebook : ${fin.error.message}`);
  await recordUsage({ userId, provider: "facebook", kind: "publication", units: 1, unitLabel: "publication", costUsd: 0 });
  return String(start.video_id);
}

export async function fbSnapshot(userId: string) {
  const p = await page(userId);
  const info = await gget(`/${p.id}`, { fields: "followers_count,fan_count,name", access_token: p.token });
  const reels = await gget(`/${p.id}/video_reels`, { fields: "id,description,created_time,length", limit: "20", access_token: p.token }).catch(() => ({ data: [] }));
  const vids: { title: string; views: number; likes: number; date: string }[] = [];
  for (const v of reels.data ?? []) {
    const ins = await gget(`/${v.id}/video_insights`, { access_token: p.token }).catch(() => ({ data: [] }));
    const metric = (n: string) => Number((ins.data ?? []).find((m: { name: string }) => m.name === n)?.values?.[0]?.value ?? 0);
    vids.push({ title: v.description ?? "", views: metric("blue_reels_play_count") || metric("fb_reels_total_plays"), likes: metric("post_video_likes_by_reaction_type") || 0, date: v.created_time });
  }
  return { followers: Number(info.followers_count ?? info.fan_count ?? 0), likes: 0, videos: vids.length, views: vids.reduce((a, v) => a + v.views, 0), top: vids.sort((a, b) => b.views - a.views).slice(0, 10) };
}
