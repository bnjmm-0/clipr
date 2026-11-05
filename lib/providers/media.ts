import fs from "node:fs";
import path from "node:path";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";

// Texte → image : OpenAI Images ou Replicate (modèle choisi dans Réglages).
export async function generateImage(prompt: string, outFile: string, userId: string) {
  const s = await getSettings();
  if (s.imageProvider === "replicate") {
    const url = await replicateRun(s.imageModel || "black-forest-labs/flux-schnell", { prompt, aspect_ratio: "9:16" });
    await download(url, outFile);
    await recordUsage({ userId, provider: "replicate", kind: "image", model: s.imageModel, units: 1, unitLabel: "image", costUsd: priceOf("replicate:image", s.prices) });
    return outFile;
  }
  const key = await requireCredential("openai");
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: s.imageModel || "gpt-image-1", prompt, size: "1024x1536", n: 1 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`OpenAI Images : ${j?.error?.message ?? r.status}`);
  const d = j.data?.[0];
  if (d?.b64_json) fs.writeFileSync(outFile, Buffer.from(d.b64_json, "base64"));
  else if (d?.url) await download(d.url, outFile);
  else throw new Error("Aucune image renvoyée");
  await recordUsage({ userId, provider: "openai", kind: "image", model: s.imageModel, units: 1, unitLabel: "image", costUsd: priceOf(`openai:${s.imageModel}`, s.prices) || 0.04 });
  return outFile;
}

// Texte → vidéo : modèle Replicate choisi par le client (ex. minimax/video-01).
export async function generateVideo(prompt: string, outFile: string, userId: string) {
  const s = await getSettings();
  if (!s.videoModel) throw new Error("Aucun modèle vidéo choisi : renseignez-le dans Réglages.");
  const url = await replicateRun(s.videoModel, { prompt });
  await download(url, outFile);
  await recordUsage({ userId, provider: "replicate", kind: "video", model: s.videoModel, units: 1, unitLabel: "vidéo", costUsd: priceOf("replicate:video", s.prices) });
  return outFile;
}

async function replicateRun(model: string, input: Record<string, unknown>): Promise<string> {
  const key = await requireCredential("replicate");
  const h = { authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "wait" };
  let r = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, { method: "POST", headers: h, body: JSON.stringify({ input }) });
  let j = await r.json();
  if (!r.ok) throw new Error(`Replicate : ${j?.detail ?? r.status}`);
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

async function download(url: string, outFile: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Téléchargement : ${r.status}`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
}
