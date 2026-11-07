import fs from "node:fs";
import path from "node:path";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";
import { TOOL_APPS, withStyle } from "../ai-tools";
import { download, replicateRun } from "./media";
import { apiError } from "./errors";

const OPENAI = () => process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const ELEVEN = "https://api.elevenlabs.io/v1";

// Exécute un outil de Conseils IA (image, vidéo ou voix) et écrit le résultat à côté de `base` (sans extension).
// Retourne le chemin du fichier créé.
export async function runTool(toolId: string, input: Record<string, string>, base: string, userId: string): Promise<string> {
  const t = TOOL_APPS[toolId];
  if (!t || t.kind === "text") throw new Error("Outil inconnu");
  const s = await getSettings();
  const prompt = withStyle(input.prompt ?? "", input.style);
  fs.mkdirSync(path.dirname(base), { recursive: true });

  if (toolId === "gpt-image") {
    const key = await requireCredential("openai");
    const r = await fetch(`${OPENAI()}/images/generations`, {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: t.model, prompt, size: input.format, quality: input.quality, n: 1 }),
    });
    const j = await r.json();
    if (!r.ok) throw apiError("OpenAI", r.status, j);
    const out = `${base}.png`, d = j.data?.[0];
    if (d?.b64_json) fs.writeFileSync(out, Buffer.from(d.b64_json, "base64"));
    else if (d?.url) await download(d.url, out);
    else throw new Error("Aucune image renvoyée");
    await recordUsage({ userId, provider: "openai", kind: "image", model: t.model, units: 1, unitLabel: "image", costUsd: priceOf(`openai:${t.model}`, s.prices) || 0.04 });
    return out;
  }

  if (toolId === "elevenlabs") {
    const key = await requireCredential("elevenlabs");
    const r = await fetch(`${ELEVEN}/text-to-speech/${encodeURIComponent(input.voice_id)}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text: input.prompt, model_id: input.model_id || "eleven_multilingual_v2", voice_settings: { stability: Number(input.stability), similarity_boost: 0.75, speed: Number(input.speed) } }),
    });
    if (!r.ok) throw apiError("ElevenLabs", r.status, await r.text());
    const out = `${base}.mp3`;
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    await recordUsage({ userId, provider: "elevenlabs", kind: "tts", model: input.model_id, units: (input.prompt ?? "").length, unitLabel: "caractères", costUsd: 0 });
    return out;
  }

  // Modèles Replicate : chaque modèle a ses propres paramètres (noms vérifiés sur replicate.com).
  const params: Record<string, Record<string, unknown>> = {
    flux: { prompt, aspect_ratio: input.aspect_ratio, resolution: input.resolution, output_format: "png" },
    kling: { prompt, duration: Number(input.duration), aspect_ratio: input.aspect_ratio, mode: input.mode, generate_audio: input.generate_audio === "true" },
    veo: { prompt, duration: Number(input.duration), aspect_ratio: input.aspect_ratio, resolution: input.resolution, generate_audio: input.generate_audio === "true" },
    seedance: { prompt, duration: Number(input.duration), aspect_ratio: input.aspect_ratio, resolution: input.resolution, generate_audio: input.generate_audio === "true" },
  };
  if (!params[toolId] || !t.model) throw new Error("Outil inconnu");
  const url = await replicateRun(t.model, params[toolId]);
  const ext = path.extname(new URL(url).pathname) || (t.kind === "video" ? ".mp4" : ".png");
  const out = `${base}${ext}`;
  await download(url, out);
  await recordUsage({ userId, provider: "replicate", kind: t.kind, model: t.model, units: 1, unitLabel: t.kind === "video" ? "vidéo" : "image", costUsd: priceOf(`replicate:${t.kind}`, s.prices) });
  return out;
}

// Listes affichées dans les formulaires, lues sur le compte du client (aucun nom de modèle deviné).
export async function listTextModels(provider: "openai" | "anthropic"): Promise<string[]> {
  try {
    if (provider === "anthropic") {
      const key = await requireCredential("anthropic");
      const r = await fetch("https://api.anthropic.com/v1/models?limit=50", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
      const j = await r.json();
      return r.ok ? (j.data ?? []).map((m: { id: string }) => m.id) : [];
    }
    const key = await requireCredential("openai");
    const r = await fetch(`${OPENAI()}/models`, { headers: { authorization: `Bearer ${key}` } });
    const j = await r.json();
    if (!r.ok) return [];
    return (j.data ?? []).map((m: { id: string }) => m.id)
      .filter((id: string) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(image|audio|realtime|tts|transcribe|embedding|search|instruct|moderation|codex)/.test(id))
      .sort().reverse();
  } catch { return []; }
}

export type ElevenVoice = { id: string; name: string };
export async function listElevenVoices(): Promise<{ voices: ElevenVoice[]; models: string[] }> {
  try {
    const key = await requireCredential("elevenlabs");
    const h = { "xi-api-key": key };
    const [rv, rm] = await Promise.all([fetch(`${ELEVEN}/voices`, { headers: h }), fetch(`${ELEVEN}/models`, { headers: h })]);
    const jv = rv.ok ? await rv.json() : { voices: [] };
    const jm = rm.ok ? await rm.json() : [];
    const voices = (jv.voices ?? []).map((v: { voice_id: string; name: string; labels?: Record<string, string> }) => ({ id: v.voice_id, name: [v.name, v.labels?.gender, v.labels?.accent].filter(Boolean).join(" · ") }));
    const models = (Array.isArray(jm) ? jm : [])
      .filter((m: { can_do_text_to_speech?: boolean; languages?: { language_id: string }[] }) => m.can_do_text_to_speech && (m.languages ?? []).some((l) => l.language_id === "fr"))
      .map((m: { model_id: string }) => m.model_id);
    return { voices, models };
  } catch { return { voices: [], models: [] }; }
}
