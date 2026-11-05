import fs from "node:fs";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];

// Voix off (OpenAI Text-to-Speech) avec la clé du client.
export async function speak(text: string, voice: string, outFile: string, userId: string, instructions?: string) {
  const s = await getSettings();
  const key = await requireCredential("openai");
  const r = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/audio/speech`, {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: s.ttsModel, voice: VOICES.includes(voice) ? voice : "alloy", input: text, response_format: "mp3", ...(instructions && s.ttsModel.includes("gpt") ? { instructions } : {}) }),
  });
  if (!r.ok) throw new Error(`Voix off : ${(await r.text()).slice(0, 200)}`);
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
  const minutes = text.split(/\s+/).length / 150;
  await recordUsage({ userId, provider: "openai", kind: "tts", model: s.ttsModel, units: minutes, unitLabel: "minutes", costUsd: minutes * priceOf(`openai:${s.ttsModel}`, s.prices) });
}
