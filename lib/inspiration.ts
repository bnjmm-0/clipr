import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "./db";
import { getCredential } from "./settings";
import { recordUsage } from "./usage";
import { chat, parseJsonLoose } from "./providers/llm";
import { probe, run } from "./pipeline/ffmpeg";
import { STORY_FIELDS } from "./story-options";
import { transcribeFile } from "./providers/stt";

// Page Inspiration : les Shorts « fruits IA » qui marchent le mieux sur YouTube, et comment ils ont été faits.
export const INSPIRATION_HOURS = 12;
export const QUERIES = ["fruit ai", "ai fruit drama", "fruit love island", "talking fruit ai", "fruits ia", "fruit ia drame"];
const API = () => process.env.YOUTUBE_API_BASE ?? "https://www.googleapis.com/youtube/v3";

function isoDur(d: string) {
  const m = d.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0)) : 0;
}

async function yt(pathname: string, params: Record<string, string>, units: number) {
  const key = await getCredential("youtube");
  if (!key) throw new Error("Clé YouTube Data API absente : ajoutez-la dans Réglages.");
  const u = new URL(`${API()}/${pathname}`);
  u.search = new URLSearchParams({ ...params, key }).toString();
  const r = await fetch(u);
  const j = await r.json();
  if (!r.ok) throw new Error(`YouTube : ${j?.error?.message ?? r.status}`);
  // Compté dans le quota du jour (page Usage) : une recherche coûte 100 unités, une lecture 1.
  await recordUsage({ userId: null, provider: "youtube", kind: "quota", units, unitLabel: "unités", costUsd: 0, meta: { what: `inspiration ${pathname}` } });
  return j;
}

// Surperformance : vues rapportées aux abonnés de la chaîne (une vidéo vue 20 fois plus que la chaîne n'a d'abonnés
// a touché bien au-delà de son public : c'est sa mécanique qui marche). Les chaînes de moins de 1 000 abonnés comptent
// pour 1 000, sinon une vidéo à 2 000 vues sur une chaîne d'un abonné passerait devant tout le monde.
// Vues par jour : vitesse depuis la publication.
export const viewsPerDay = (v: { views: number; publishedAt: Date }) => Math.round(v.views / Math.max(1, (Date.now() - v.publishedAt.getTime()) / 864e5));
export const overSubs = (v: { views: number; channelSubs: number }) => v.views / Math.max(1000, v.channelSubs);
// Vidéo bien générée par IA (et pas un dessin animé classique sur les fruits) : mot « IA » dans le titre, les mots-clés ou la description.
const isAi = (it: any) => /(^|[^a-z])(ai|ia|a\.i\.|artificial|intelligence artificielle)([^a-z]|$)/i.test(`${it.snippet.title} ${(it.snippet.tags ?? []).join(" ")} ${it.snippet.description ?? ""}`);

// Relevé : 6 recherches (100 unités chacune), puis détails des vidéos et abonnés des chaînes (1 unité par lot de 50).
export async function refreshInspiration() {
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const found = new Map<string, string>();
  for (const q of QUERIES) {
    const j = await yt("search", { part: "snippet", type: "video", videoDuration: "short", order: "viewCount", publishedAfter: since, maxResults: "25", q }, 100);
    for (const it of j.items ?? []) if (it.id?.videoId && !found.has(it.id.videoId)) found.set(it.id.videoId, q);
  }
  const ids = [...found.keys()];
  const items: any[] = [];
  for (let i = 0; i < ids.length; i += 50) items.push(...((await yt("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") }, 1)).items ?? []));
  const chans = [...new Set(items.map((it) => it.snippet.channelId))];
  const subs = new Map<string, number>();
  for (let i = 0; i < chans.length; i += 50) {
    for (const c of (await yt("channels", { part: "statistics", id: chans.slice(i, i + 50).join(",") }, 1)).items ?? []) subs.set(c.id, Number(c.statistics?.subscriberCount ?? 0));
  }
  const now = new Date();
  for (const it of items) {
    const durationSec = isoDur(it.contentDetails?.duration ?? "");
    if (!durationSec || durationSec > 180 || !isAi(it)) continue;
    const data = {
      title: it.snippet.title, channel: it.snippet.channelTitle, channelId: it.snippet.channelId, channelSubs: subs.get(it.snippet.channelId) ?? 0,
      thumb: it.snippet.thumbnails?.high?.url ?? it.snippet.thumbnails?.medium?.url ?? "", description: (it.snippet.description ?? "").slice(0, 3000),
      tags: (it.snippet.tags ?? []).slice(0, 30).join(", "), query: found.get(it.id)!, durationSec,
      views: Math.min(2_000_000_000, Number(it.statistics?.viewCount ?? 0)), likes: Math.min(2_000_000_000, Number(it.statistics?.likeCount ?? 0)),
      comments: Math.min(2_000_000_000, Number(it.statistics?.commentCount ?? 0)), publishedAt: new Date(it.snippet.publishedAt), fetchedAt: now,
    };
    await prisma.inspirationVideo.upsert({ where: { id: it.id }, update: data, create: { id: it.id, ...data } });
  }
  // On garde les vidéos des 90 derniers jours encore trouvées (et toutes celles déjà analysées).
  await prisma.inspirationVideo.deleteMany({ where: { analysisJson: null, OR: [{ publishedAt: { lt: new Date(Date.now() - 90 * 864e5) } }, { fetchedAt: { lt: now } }] } });
  return items.length;
}

export type Recipe = { brief: string; format: "dialogue" | "narration"; durationSec: number; options: Record<string, string>; characters: { name: string; look: string; personality: string }[] };
export type Analysis = {
  resume: string; format: string; accroche: string; structure: { moment: string; quoi: string }[];
  personnages: { nom: string; apparence: string; personnalite: string }[];
  style: string; voix: string; montage: string; outils: string; pourquoi: string[]; recette: Recipe;
};

// Paroles et 4 images de la vidéo : vidéo en 480p au plus récupérée avec yt-dlp (supprimée après l'analyse),
// sous-titres de YouTube s'il les donne, sinon transcription du son (Whisper, quelques dixièmes de centime).
async function material(id: string, userId: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clipr-insp-"));
  const url = `https://www.youtube.com/shorts/${id}`;
  const yd = (args: string[], timeoutMs: number) => run("yt-dlp", ["--js-runtimes", "node", "--no-playlist", ...args, url], { timeoutMs }).catch(() => "");
  let transcript = "";
  const frames: string[] = [];
  await yd(["--skip-download", "--write-auto-subs", "--write-subs", "--sub-langs", "fr-orig,fr,en-orig,en", "--sub-format", "vtt", "-o", path.join(dir, "subs")], 60_000);
  const vtt = fs.readdirSync(dir).find((f) => f.endsWith(".vtt"));
  if (vtt) {
    const lines = fs.readFileSync(path.join(dir, vtt), "utf8").split("\n").filter((l) => l && !/-->|^WEBVTT|^Kind:|^Language:|^\d+$/.test(l)).map((l) => l.replace(/<[^>]+>/g, "").trim());
    transcript = lines.filter((l, i) => l && l !== lines[i - 1]).join(" ").slice(0, 6000);
  }
  await yd(["-S", "res:480", "-f", "bv*+ba/b/wv*+wa/w", "--merge-output-format", "mp4", "-o", path.join(dir, "v.%(ext)s")], 180_000);
  const video = fs.readdirSync(dir).find((f) => /^v\.(mp4|webm|mkv)$/.test(f));
  if (video) {
    const file = path.join(dir, video);
    const info = await probe(file).catch(() => null);
    const d = info?.duration || 20;
    for (const [i, f] of [0.08, 0.35, 0.62, 0.9].entries()) {
      const out = path.join(dir, `f${i}.jpg`);
      await run("ffmpeg", ["-y", "-v", "error", "-ss", (d * f).toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "4", out]).catch(() => "");
      if (fs.existsSync(out)) frames.push(out);
    }
    if (!transcript && info?.hasAudio) {
      const audio = path.join(dir, "a.mp3");
      await run("ffmpeg", ["-y", "-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audio]).catch(() => "");
      if (fs.existsSync(audio)) transcript = (await transcribeFile(audio, { language: "auto", userId, minutes: d / 60 }).catch(() => null))?.text.slice(0, 6000) ?? "";
    }
  }
  return { dir, transcript, frames };
}

const OPTION_CODES = STORY_FIELDS.filter((f) => f.kind === "select").map((f) => `${f.name} : ${f.kind === "select" ? f.choices.filter((c) => c.v).map((c) => c.v).join(" | ") : ""}`).join("\n");

export async function analyzeInspiration(id: string, userId: string) {
  const v = await prisma.inspirationVideo.findUniqueOrThrow({ where: { id } });
  const m = await material(id, userId);
  try {
    const out = await chat({
      userId, purpose: "inspiration", json: true, maxTokens: 3500, images: m.frames,
      system: "Tu es réalisateur et stratège de vidéos courtes IA (mini-feuilletons de fruits, d'objets ou d'animaux qui parlent). Tu décortiques une vidéo qui marche pour qu'un débutant comprenne comment elle a été faite et puisse en créer une version ORIGINALE (jamais une copie : autres personnages, autre histoire, même mécanique). Ce qui n'est pas visible ou dit est une déduction : formule-le comme probable. N'invente aucun chiffre.",
      user: `Vidéo YouTube Short « ${v.title} » de ${v.channel} (${v.channelSubs.toLocaleString("fr-FR")} abonnés) : ${v.views.toLocaleString("fr-FR")} vues, ${v.likes.toLocaleString("fr-FR")} j'aime, ${v.comments.toLocaleString("fr-FR")} commentaires, ${v.durationSec} s, publiée le ${v.publishedAt.toLocaleDateString("fr-FR")}.
Description : ${v.description.slice(0, 1500) || "(vide)"}
Mots-clés : ${v.tags || "(aucun)"}
Paroles (sous-titres automatiques) : ${m.transcript || "(indisponibles)"}
${m.frames.length ? `${m.frames.length} images de la vidéo sont jointes, du début à la fin.` : "Aucune image de la vidéo n'a pu être récupérée : base-toi sur le titre, la description et les paroles."}

Réponds en français, en JSON :
{"resume":"ce qui se passe, en 2 phrases","format":"dialogue entre personnages, narration, face caméra…","accroche":"ce qui retient dans les 2 premières secondes",
"structure":[{"moment":"0-3 s","quoi":"..."}],"personnages":[{"nom":"...","apparence":"description précise réutilisable","personnalite":"..."}],
"style":"style visuel, lumière, décor, cadrage","voix":"type de voix, ton, langue","montage":"rythme des plans, sous-titres, musique, effets",
"outils":"outils probablement utilisés (génération d'images, de vidéo, de voix), formulés comme des hypothèses",
"pourquoi":["raison concrète pour laquelle elle marche"],
"recette":{"brief":"consigne pour créer une version ORIGINALE avec la même mécanique, autres personnages ou autre intrigue","format":"dialogue ou narration","durationSec":30,
"options":{"genre":"code","hook":"code","ending":"code","rhythm":"code","setting":"décor en quelques mots","light":"code","style":"code","framing":"code"},
"characters":[{"name":"prénom court","look":"apparence précise (forme, couleurs, visage, tenue, accessoires)","personality":"3 traits"}]}}
Codes autorisés pour recette.options :
${OPTION_CODES}`,
    });
    const a = parseJsonLoose<Analysis>(out);
    a.recette = cleanRecipe(a.recette);
    await prisma.inspirationVideo.update({ where: { id }, data: { analysisJson: JSON.stringify(a), analyzedAt: new Date() } });
    return a;
  } finally {
    fs.rmSync(m.dir, { recursive: true, force: true });
  }
}

// Recette vérifiée : options limitées aux codes existants, durée entre 15 s et 3 min, 4 personnages au plus.
function cleanRecipe(r: Partial<Recipe> | undefined): Recipe {
  const options: Record<string, string> = {};
  for (const f of STORY_FIELDS) {
    const v = String(r?.options?.[f.name] ?? "").trim();
    if (!v) continue;
    if (f.kind === "text") options[f.name] = v.slice(0, f.max);
    else if (f.choices.some((c) => c.v === v)) options[f.name] = v;
  }
  return {
    brief: String(r?.brief ?? "").slice(0, 1500), format: r?.format === "narration" ? "narration" : "dialogue",
    durationSec: Math.max(15, Math.min(180, Math.round(Number(r?.durationSec) || 30))), options,
    characters: (r?.characters ?? []).slice(0, 4).map((c) => ({ name: String(c.name ?? "").slice(0, 40), look: String(c.look ?? "").slice(0, 600), personality: String(c.personality ?? "").slice(0, 200) })).filter((c) => c.name && c.look),
  };
}
