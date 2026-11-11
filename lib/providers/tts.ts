import fs from "node:fs";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";
import { apiError } from "./errors";
import { ELEVEN_PREFIX, GEMINI_PREFIX, isElevenVoice, isGeminiVoice } from "../engines";
import { run } from "../pipeline/ffmpeg";
import { GEMINI_TTS, interact, saveOutput } from "./gemini";

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];
export const ELEVEN_URL = () => process.env.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io/v1";

// Une voix est valable si c'est une voix OpenAI, ElevenLabs ("elevenlabs:<id>") ou Gemini ("gemini:<nom>").
export const isKnownVoice = (v: string) => VOICES.includes(v) || isElevenVoice(v) || isGeminiVoice(v);

// Voix off avec la clé du client : OpenAI Text-to-Speech, ElevenLabs si la voix est "elevenlabs:<id>", Gemini si "gemini:<nom>".
export async function speak(text: string, voice: string, outFile: string, userId: string, instructions?: string) {
  if (isElevenVoice(voice)) return speakEleven(text, voice.slice(ELEVEN_PREFIX.length), outFile, userId);
  if (isGeminiVoice(voice)) return speakGemini(text, voice.slice(GEMINI_PREFIX.length), outFile, userId, instructions);
  const s = await getSettings();
  const key = await requireCredential("openai");
  const r = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/audio/speech`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: s.ttsModel, voice: VOICES.includes(voice) ? voice : "alloy", input: text, response_format: "mp3", ...(instructions && s.ttsModel.includes("gpt") ? { instructions } : {}) }),
  });
  if (!r.ok) throw apiError("OpenAI", r.status, await r.text());
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
  const minutes = text.split(/\s+/).length / 150;
  await recordUsage({ userId, provider: "openai", kind: "tts", model: s.ttsModel, units: minutes, unitLabel: "minutes", costUsd: minutes * priceOf(`openai:${s.ttsModel}`, s.prices) });
}

async function speakEleven(text: string, voiceId: string, outFile: string, userId: string) {
  const s = await getSettings();
  const key = await requireCredential("elevenlabs");
  const model = "eleven_multilingual_v2";
  const r = await fetch(`${ELEVEN_URL()}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.45, similarity_boost: 0.75 } }),
  });
  if (!r.ok) throw apiError("ElevenLabs", r.status, await r.text());
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
  await recordUsage({ userId, provider: "elevenlabs", kind: "tts", model, units: text.length, unitLabel: "caractères", costUsd: text.length * priceOf(`elevenlabs:${model}`, s.prices) });
}

// Gemini TTS : renvoie un WAV 24 kHz mono, converti en MP3 comme les autres voix. La direction de jeu
// (ton, émotion) passe en « style » ; la langue est détectée dans le texte. Payé aux tokens audio produits.
async function speakGemini(text: string, voice: string, outFile: string, userId: string, instructions?: string) {
  const s = await getSettings();
  const j = await interact({
    model: GEMINI_TTS,
    input: [{ type: "user_input", content: [{ type: "text", text, ...(instructions ? { annotations: [{ type: "speech_metadata", style: instructions.slice(0, 500) }] } : {}) }] }],
    response_format: { type: "audio" },
    generation_config: { speech_config: [{ voice }] },
  });
  const wav = `${outFile}.wav`;
  await saveOutput(j, "audio", wav);
  try { await run("ffmpeg", ["-y", "-v", "error", "-i", wav, "-ac", "1", "-b:a", "128k", outFile]); } finally { fs.rmSync(wav, { force: true }); }
  const tokens = j.usage?.total_output_tokens ?? 0;
  await recordUsage({ userId, provider: "google", kind: "tts", model: GEMINI_TTS, units: tokens, unitLabel: "tokens audio", costUsd: (tokens * priceOf(`google:${GEMINI_TTS}`, s.prices)) / 1e6, meta: { voice } });
}
