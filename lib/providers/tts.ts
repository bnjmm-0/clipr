import fs from "node:fs";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";
import { apiError } from "./errors";
import { ELEVEN_PREFIX, isElevenVoice } from "../engines";

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];
export const ELEVEN_URL = () => process.env.ELEVENLABS_BASE_URL ?? "https://api.elevenlabs.io/v1";

// Voix off avec la clé du client : OpenAI Text-to-Speech, ou ElevenLabs si la voix est "elevenlabs:<id>".
export async function speak(text: string, voice: string, outFile: string, userId: string, instructions?: string) {
  if (isElevenVoice(voice)) return speakEleven(text, voice.slice(ELEVEN_PREFIX.length), outFile, userId);
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
