import fs from "node:fs";
import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";
import { apiError } from "./errors";

export type Word = { w: string; s: number; e: number };
export type Segment = { text: string; s: number; e: number };

// Transcription mot à mot (Whisper) via OpenAI ou Groq, avec la clé du client.
export async function transcribeFile(file: string, opts: { language?: string; offset?: number; userId?: string | null; minutes: number }) {
  const s = await getSettings();
  const groq = s.sttProvider === "groq";
  const key = await requireCredential(groq ? "groq" : "openai");
  const model = groq ? "whisper-large-v3-turbo" : "whisper-1";
  const url = groq ? `${process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1"}/audio/transcriptions` : `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/audio/transcriptions`;
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), "audio.mp3");
  fd.append("model", model);
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  fd.append("timestamp_granularities[]", "segment");
  if (opts.language && opts.language !== "auto") fd.append("language", opts.language);
  const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: fd });
  const j = await r.json();
  if (!r.ok) throw apiError(groq ? "Groq" : "OpenAI", r.status, j);
  const off = opts.offset ?? 0;
  const words: Word[] = (j.words ?? []).map((w: { word: string; start: number; end: number }) => ({ w: w.word.trim(), s: w.start + off, e: w.end + off }));
  const segments: Segment[] = (j.segments ?? []).map((g: { text: string; start: number; end: number }) => ({ text: g.text.trim(), s: g.start + off, e: g.end + off }));
  await recordUsage({ userId: opts.userId, provider: groq ? "groq" : "openai", kind: "transcription", model, units: opts.minutes, unitLabel: "minutes", costUsd: opts.minutes * priceOf(`${groq ? "groq" : "openai"}:${model}`, s.prices) });
  return { words, segments, language: j.language as string | undefined, text: (j.text as string) ?? "" };
}
