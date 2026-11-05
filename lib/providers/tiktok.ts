import fs from "node:fs";
import { prisma } from "../db";
import { openJson, sealJson } from "../crypto";
import { requireCredential } from "../settings";
import { recordUsage } from "../usage";

// Intégration TikTok officielle (Login Kit + Content Posting API + Display API).
// L'app développeur est créée sous le compte TikTok du client ; ses identifiants sont saisis dans Réglages.
export const TIKTOK_SCOPES = "user.info.basic,user.info.stats,video.list,video.publish,video.upload";
const redirectUri = () => `${process.env.APP_URL ?? "http://localhost:3000"}/api/tiktok/callback`;

export async function authorizeUrl(state: string) {
  const key = await requireCredential("tiktok_client_key");
  const p = new URLSearchParams({ client_key: key, scope: TIKTOK_SCOPES, response_type: "code", redirect_uri: redirectUri(), state });
  return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
}

export async function exchangeCode(code: string, userId: string) {
  const body = new URLSearchParams({
    client_key: await requireCredential("tiktok_client_key"), client_secret: await requireCredential("tiktok_client_secret"),
    code, grant_type: "authorization_code", redirect_uri: redirectUri(),
  });
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`TikTok OAuth : ${j.error_description ?? j.error ?? r.status}`);
  await saveTokens(userId, j);
  const info = await tiktokApi(userId, "/v2/user/info/?fields=open_id,display_name,avatar_url");
  await prisma.socialAccount.update({
    where: { userId_platform: { userId, platform: "tiktok" } },
    data: { displayName: info?.data?.user?.display_name, avatarUrl: info?.data?.user?.avatar_url },
  });
}

async function saveTokens(userId: string, j: { open_id: string; access_token: string; refresh_token?: string; expires_in: number; scope?: string }) {
  const data = {
    openId: j.open_id, accessEnc: sealJson(j.access_token, "tiktok"), refreshEnc: j.refresh_token ? sealJson(j.refresh_token, "tiktok") : null,
    expiresAt: new Date(Date.now() + j.expires_in * 1000), scopes: j.scope ?? null,
  };
  await prisma.socialAccount.upsert({ where: { userId_platform: { userId, platform: "tiktok" } }, update: data, create: { userId, platform: "tiktok", ...data } });
}

async function accessToken(userId: string) {
  const a = await prisma.socialAccount.findUnique({ where: { userId_platform: { userId, platform: "tiktok" } } });
  if (!a) throw new Error("Compte TikTok non connecté");
  if (a.expiresAt && a.expiresAt.getTime() - Date.now() < 60_000 && a.refreshEnc) {
    const body = new URLSearchParams({
      client_key: await requireCredential("tiktok_client_key"), client_secret: await requireCredential("tiktok_client_secret"),
      grant_type: "refresh_token", refresh_token: openJson(a.refreshEnc, "tiktok"),
    });
    const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error("Session TikTok expirée : reconnectez le compte");
    await saveTokens(userId, j);
    return j.access_token as string;
  }
  return openJson(a.accessEnc, "tiktok");
}

export async function tiktokApi(userId: string, pathAndQuery: string, body?: unknown) {
  const t = await accessToken(userId);
  const r = await fetch(`https://open.tiktokapis.com${pathAndQuery}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${t}`, "content-type": "application/json; charset=UTF-8" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (!r.ok || (j.error && j.error.code && j.error.code !== "ok")) throw new Error(`TikTok : ${j.error?.message ?? r.status}`);
  return j;
}

export async function accountSnapshot(userId: string) {
  const info = await tiktokApi(userId, "/v2/user/info/?fields=display_name,follower_count,following_count,likes_count,video_count,bio_description");
  const vids = await tiktokApi(userId, "/v2/video/list/?fields=id,title,video_description,duration,create_time,view_count,like_count,comment_count,share_count", { max_count: 20 });
  return { user: info.data?.user, videos: vids.data?.videos ?? [] };
}

// Publication d'un fichier local via FILE_UPLOAD (envoi en un seul morceau, < 64 Mo).
// Tant que l'app n'est pas validée par TikTok, les posts sont forcés en privé (SELF_ONLY).
export async function publishVideo(userId: string, file: string, caption: string, privacy = "SELF_ONLY") {
  const size = fs.statSync(file).size;
  const init = await tiktokApi(userId, "/v2/post/publish/video/init/", {
    post_info: { title: caption.slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
  });
  const up = await fetch(init.data.upload_url, {
    method: "PUT",
    headers: { "content-type": "video/mp4", "content-length": String(size), "content-range": `bytes 0-${size - 1}/${size}` },
    body: fs.readFileSync(file),
  });
  if (!up.ok) throw new Error(`Upload TikTok : ${up.status}`);
  await recordUsage({ userId, provider: "tiktok", kind: "tiktok", units: 1, unitLabel: "publication", costUsd: 0 });
  return init.data.publish_id as string;
}
