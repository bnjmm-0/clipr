import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";
import { apiError } from "./errors";
import { TOOL_APPS, pickOptions } from "../ai-tools";
import { GEMINI_IMAGE, GEMINI_VIDEO, imagePart, interact, saveOutput } from "./gemini";

// Texte → image : OpenAI Images, Replicate ou Gemini (Nano Banana). `engine` (lib/engines.ts) impose l'IA de la vidéo, sinon Réglages.
// `refs` : images de référence (fiches des personnages) qui verrouillent l'apparence ; GPT Image et FLUX.2 les acceptent.
export async function generateImage(prompt: string, outFile: string, userId: string, engine?: string | null, refs: string[] = []) {
  const s = await getSettings();
  refs = refs.filter((f) => fs.existsSync(f));
  if (engine === "gemini-image" || (s.imageProvider === "google" && engine !== "gpt-image" && engine !== "flux")) {
    return geminiImage(prompt, outFile, userId, s.imageModel.startsWith("gemini") ? s.imageModel : GEMINI_IMAGE, refs);
  }
  if (engine === "flux") {
    const input = replicateInput("flux", prompt, { aspect_ratio: "9:16" });
    if (refs.length) input.input_images = refs.map((f) => dataUri(f));
    const url = await replicateRun(TOOL_APPS.flux.model!, input);
    await download(url, outFile);
    await recordUsage({ userId, provider: "replicate", kind: "image", model: TOOL_APPS.flux.model, units: 1, unitLabel: "image", costUsd: priceOf("replicate:image", s.prices) });
    return outFile;
  }
  const model = engine === "gpt-image" && s.imageProvider !== "openai" ? "gpt-image-1" : s.imageModel || "gpt-image-1";
  // Qualité choisie dans Réglages (GPT Image seulement) : « moyenne » coûte environ 4 fois moins que « haute ».
  const quality = model.startsWith("gpt-image") && ["low", "medium", "high"].includes(s.imageQuality) ? s.imageQuality : undefined;
  if (s.imageProvider === "replicate" && engine !== "gpt-image") {
    const url = await replicateRun(s.imageModel || "black-forest-labs/flux-schnell", { prompt, aspect_ratio: "9:16" });
    await download(url, outFile);
    await recordUsage({ userId, provider: "replicate", kind: "image", model: s.imageModel, units: 1, unitLabel: "image", costUsd: priceOf("replicate:image", s.prices) });
    return outFile;
  }
  const key = await requireCredential("openai");
  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  let r: Response;
  if (refs.length && model.startsWith("gpt-image")) {
    // Édition à partir des références : le modèle reprend l'apparence exacte des personnages joints.
    const fd = new FormData();
    fd.append("model", model); fd.append("prompt", prompt); fd.append("size", "1024x1536"); fd.append("n", "1");
    if (quality) fd.append("quality", quality);
    for (const f of refs) fd.append("image[]", new Blob([fs.readFileSync(f)], { type: "image/png" }), path.basename(f));
    r = await fetch(`${base}/images/edits`, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd });
  } else {
    r = await fetch(`${base}/images/generations`, {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1024x1536", n: 1, ...(quality ? { quality } : {}) }),
    });
  }
  const j = await r.json();
  if (!r.ok) throw apiError("OpenAI", r.status, j);
  const d = j.data?.[0];
  if (d?.b64_json) fs.writeFileSync(outFile, Buffer.from(d.b64_json, "base64"));
  else if (d?.url) await download(d.url, outFile);
  else throw new Error("Aucune image renvoyée");
  await recordUsage({ userId, provider: "openai", kind: "image", model, units: 1, unitLabel: "image", costUsd: (quality ? priceOf(`openai:image:${quality}`, s.prices) : 0) || priceOf(`openai:${model}`, s.prices) || 0.063, meta: { quality } });
  return outFile;
}

// Nom du paramètre « image de départ » de chaque moteur vidéo sur Replicate.
const START_IMAGE: Record<string, string> = { kling: "start_image", veo: "image", seedance: "image" };

// Texte → vidéo sur Replicate : moteur de la vidéo (kling, veo, seedance), sinon le modèle de Réglages (ex. minimax/video-01).
// Pour une scène de vidéo IA : format vertical, sans son (la voix off est posée ensuite), et si possible
// à partir de l'image de la scène (`startImage`) : le prompt ne décrit alors que le mouvement.
export async function generateVideo(prompt: string, outFile: string, userId: string, engine?: string | null, startImage?: string, seconds = 5) {
  if (engine === "omni") return geminiVideo(prompt, outFile, userId, startImage, seconds);
  if (engine === "grok" || engine === "grokpro") return grokVideo(prompt, outFile, userId, engine === "grok" ? "grok-imagine-video-1.5-lite" : "grok-imagine-video-1.5", startImage, seconds);
  const s = await getSettings();
  const model = engine ? TOOL_APPS[engine]?.model : s.videoModel;
  if (!model) throw new Error("Aucun modèle vidéo choisi : renseignez-le dans Réglages.");
  const input = engine ? replicateInput(engine, prompt, { aspect_ratio: "9:16", generate_audio: "false" }) : { prompt };
  if (engine && startImage && fs.existsSync(startImage)) input[START_IMAGE[engine]] = dataUri(startImage);
  const url = await replicateRun(model, input);
  await download(url, outFile);
  await recordUsage({ userId, provider: "replicate", kind: "video", model, units: 1, unitLabel: "vidéo", costUsd: priceOf("replicate:video", s.prices) });
  return outFile;
}

// Grok Imagine (API xAI) : une requête, puis interrogation toutes les 5 s jusqu'à « done ». Payé à la seconde :
// la durée demandée est celle de la scène (1 à 15 s). Avec une image de départ, le format suit l'image.
async function grokVideo(prompt: string, outFile: string, userId: string, model: string, startImage?: string, seconds = 5) {
  const s = await getSettings();
  const key = await requireCredential("xai");
  const base = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
  const h = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  const duration = Math.max(1, Math.min(15, Math.ceil(seconds)));
  const body: Record<string, unknown> = { model, prompt, duration, resolution: "720p" };
  if (startImage && fs.existsSync(startImage)) body.image = { url: dataUri(startImage) };
  else body.aspect_ratio = "9:16";
  const r = await fetch(`${base}/videos/generations`, { method: "POST", headers: h, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw apiError("xAI", r.status, j);
  let st: { status?: string; video?: { url?: string }; error?: unknown } = {};
  for (let i = 0; i < 120; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    const p = await fetch(`${base}/videos/${j.request_id}`, { headers: h });
    st = await p.json();
    if (!p.ok) throw apiError("xAI", p.status, st);
    if (st.status === "done" || st.status === "failed" || st.status === "expired") break;
  }
  if (st.status !== "done" || !st.video?.url) throw new Error(`Grok Imagine : ${st.status === "failed" ? "génération refusée ou échouée" : st.status ?? "délai dépassé"}`);
  await download(st.video.url, outFile);
  await recordUsage({ userId, provider: "xai", kind: "video", model, units: duration, unitLabel: "secondes", costUsd: duration * priceOf(`xai:${model}`, s.prices) });
  return outFile;
}

// Nano Banana (Gemini) : les fiches des personnages sont jointes comme références (4 personnages au plus),
// format vertical 9:16 en 1K (le moins cher). L'image reçue est convertie si son format ne suit pas le nom du fichier.
async function geminiImage(prompt: string, outFile: string, userId: string, model: string, refs: string[]) {
  const s = await getSettings();
  const j = await interact({ model, input: [{ type: "text", text: prompt }, ...refs.slice(0, 4).map(imagePart)], response_format: { type: "image", aspect_ratio: "9:16", image_size: "1K" } });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = `${outFile}.gemini`;
  const mime = await saveOutput(j, "image", tmp);
  const ext = path.extname(outFile).slice(1).toLowerCase().replace("jpg", "jpeg");
  if (mime.endsWith(`/${ext}`)) fs.renameSync(tmp, outFile);
  else { execFileSync("ffmpeg", ["-v", "error", "-y", "-i", tmp, "-frames:v", "1", outFile]); fs.rmSync(tmp, { force: true }); }
  await recordUsage({ userId, provider: "google", kind: "image", model, units: 1, unitLabel: "image", costUsd: priceOf(`google:${model}`, s.prices) || 0.0336, meta: { refs: refs.length } });
  return outFile;
}

// Gemini Omni Flash : plan vidéo vertical de 3 à 15 s, à partir de l'image de la scène si elle existe.
// Omni ajoute toujours un son ; le montage le retire (-an) pour poser la voix off.
async function geminiVideo(prompt: string, outFile: string, userId: string, startImage?: string, seconds = 5) {
  const s = await getSettings();
  const duration = Math.max(3, Math.min(15, Math.ceil(seconds)));
  const input = [...(startImage && fs.existsSync(startImage) ? [imagePart(startImage)] : []), { type: "text", text: prompt }];
  const j = await interact({ model: GEMINI_VIDEO, input, response_format: { type: "video", aspect_ratio: "9:16", duration: `${duration}s`, resolution: "720p" } });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await saveOutput(j, "video", outFile);
  await recordUsage({ userId, provider: "google", kind: "video", model: GEMINI_VIDEO, units: duration, unitLabel: "secondes", costUsd: duration * priceOf(`google:${GEMINI_VIDEO}`, s.prices) });
  return outFile;
}

// Paramètres Replicate d'un outil de lib/ai-tools.ts (noms vérifiés sur replicate.com) ;
// les options absentes prennent la première valeur proposée par l'outil.
export function replicateInput(toolId: string, prompt: string, input: Record<string, string>): Record<string, unknown> {
  const o = pickOptions(TOOL_APPS[toolId], (n) => input[n] ?? null);
  const audio = o.generate_audio === "true";
  const params: Record<string, Record<string, unknown>> = {
    flux: { prompt, aspect_ratio: o.aspect_ratio, resolution: o.resolution, output_format: "png" },
    kling: { prompt, duration: Number(o.duration), aspect_ratio: o.aspect_ratio, mode: o.mode, generate_audio: audio },
    veo: { prompt, duration: Number(o.duration), aspect_ratio: o.aspect_ratio, resolution: o.resolution, generate_audio: audio },
    seedance: { prompt, duration: Number(o.duration), aspect_ratio: o.aspect_ratio, resolution: o.resolution, generate_audio: audio },
  };
  if (!params[toolId]) throw new Error("Outil inconnu");
  return params[toolId];
}

export async function replicateRun(model: string, input: Record<string, unknown>): Promise<string> {
  const key = await requireCredential("replicate");
  const h = { authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "wait" };
  let r = await fetch(`${process.env.REPLICATE_BASE_URL ?? "https://api.replicate.com/v1"}/models/${model}/predictions`, { method: "POST", headers: h, body: JSON.stringify({ input }) });
  let j = await r.json();
  if (!r.ok) throw apiError("Replicate", r.status, j);
  for (let i = 0; i < 180 && !["succeeded", "failed", "canceled"].includes(j.status); i++) {
    await new Promise((res) => setTimeout(res, 5000));
    r = await fetch(j.urls.get, { headers: h });
    j = await r.json();
  }
  if (j.status !== "succeeded") throw new Error(`Replicate : ${j.error ?? j.status}`);
  const out = Array.isArray(j.output) ? j.output[0] : j.output;
  if (typeof out !== "string") throw new Error("Sortie Replicate inattendue");
  return out;
}

// Synchro des lèvres (Kling Lip Sync sur Replicate) : la bouche du personnage suit la voix de la scène.
// Contraintes du modèle : vidéo de 2 à 10 s en 720-1920 px, audio de moins de 5 Mo. Payé à la seconde de vidéo.
export const LIPSYNC_MODEL = "kwaivgi/kling-lip-sync";
export const LIPSYNC_MIN = 2, LIPSYNC_MAX = 10;
export async function lipSync(video: string, audio: string, outFile: string, userId: string, seconds: number) {
  const s = await getSettings();
  const url = await replicateRun(LIPSYNC_MODEL, { video_url: await replicateUpload(video), audio_file: await replicateUpload(audio) });
  await download(url, outFile);
  await recordUsage({ userId, provider: "replicate", kind: "video", model: LIPSYNC_MODEL, units: seconds, unitLabel: "secondes", costUsd: seconds * priceOf(`replicate:${LIPSYNC_MODEL}`, s.prices) });
  return outFile;
}

// Envoie un fichier sur Replicate (Files API) et renvoie l'adresse à passer en entrée d'un modèle.
export async function replicateUpload(file: string) {
  const key = await requireCredential("replicate");
  const fd = new FormData();
  const type = file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".mp3") ? "audio/mpeg" : file.endsWith(".wav") ? "audio/wav" : "application/octet-stream";
  fd.append("content", new Blob([fs.readFileSync(file)], { type }), path.basename(file));
  const r = await fetch(`${process.env.REPLICATE_BASE_URL ?? "https://api.replicate.com/v1"}/files`, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw apiError("Replicate", r.status, j);
  if (!j.urls?.get) throw new Error("Replicate : envoi du fichier impossible");
  return j.urls.get as string;
}

// Image envoyée en ligne (data URI) : convertie en JPEG de 1080 px de large au plus pour rester légère.
function dataUri(file: string) {
  const jpg = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale='min(1080,iw)':-2", "-q:v", "3", "-f", "image2pipe", "-vcodec", "mjpeg", "-"], { maxBuffer: 32 << 20 });
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

export async function download(url: string, outFile: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Téléchargement : ${r.status}`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
}
