import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";
import { apiError } from "./errors";
import { TOOL_APPS, pickOptions } from "../ai-tools";

// Texte → image : OpenAI Images ou Replicate. `engine` (lib/engines.ts) impose l'IA de la vidéo, sinon Réglages.
// `refs` : images de référence (fiches des personnages) qui verrouillent l'apparence ; GPT Image et FLUX.2 les acceptent.
export async function generateImage(prompt: string, outFile: string, userId: string, engine?: string | null, refs: string[] = []) {
  const s = await getSettings();
  refs = refs.filter((f) => fs.existsSync(f));
  if (engine === "flux") {
    const input = replicateInput("flux", prompt, { aspect_ratio: "9:16" });
    if (refs.length) input.input_images = refs.map((f) => dataUri(f));
    const url = await replicateRun(TOOL_APPS.flux.model!, input);
    await download(url, outFile);
    await recordUsage({ userId, provider: "replicate", kind: "image", model: TOOL_APPS.flux.model, units: 1, unitLabel: "image", costUsd: priceOf("replicate:image", s.prices) });
    return outFile;
  }
  const model = engine === "gpt-image" && s.imageProvider !== "openai" ? "gpt-image-1" : s.imageModel || "gpt-image-1";
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
    for (const f of refs) fd.append("image[]", new Blob([fs.readFileSync(f)], { type: "image/png" }), path.basename(f));
    r = await fetch(`${base}/images/edits`, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd });
  } else {
    r = await fetch(`${base}/images/generations`, {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, prompt, size: "1024x1536", n: 1 }),
    });
  }
  const j = await r.json();
  if (!r.ok) throw apiError("OpenAI", r.status, j);
  const d = j.data?.[0];
  if (d?.b64_json) fs.writeFileSync(outFile, Buffer.from(d.b64_json, "base64"));
  else if (d?.url) await download(d.url, outFile);
  else throw new Error("Aucune image renvoyée");
  await recordUsage({ userId, provider: "openai", kind: "image", model, units: 1, unitLabel: "image", costUsd: priceOf(`openai:${model}`, s.prices) || 0.04 });
  return outFile;
}

// Nom du paramètre « image de départ » de chaque moteur vidéo sur Replicate.
const START_IMAGE: Record<string, string> = { kling: "start_image", veo: "image", seedance: "image" };

// Texte → vidéo sur Replicate : moteur de la vidéo (kling, veo, seedance), sinon le modèle de Réglages (ex. minimax/video-01).
// Pour une scène de vidéo IA : format vertical, sans son (la voix off est posée ensuite), et si possible
// à partir de l'image de la scène (`startImage`) : le prompt ne décrit alors que le mouvement.
export async function generateVideo(prompt: string, outFile: string, userId: string, engine?: string | null, startImage?: string) {
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
