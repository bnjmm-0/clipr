import type { Segment, Word } from "../providers/stt";

export type Candidate = { id: number; s: number; e: number; text: string };

const SENTENCE_END = /[.!?…»"]$/;

// Fenêtres calées sur des fins de phrase, de minSec à maxSec.
export function buildCandidates(segments: Segment[], minSec: number, maxSec: number, maxCount = 120): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < segments.length; i++) {
    const start = segments[i].s;
    let text = "";
    let best: Candidate | null = null;
    for (let j = i; j < segments.length; j++) {
      const dur = segments[j].e - start;
      if (dur > maxSec) break;
      text += (text ? " " : "") + segments[j].text;
      if (dur >= minSec && (SENTENCE_END.test(segments[j].text) || j === segments.length - 1)) {
        best = { id: 0, s: start, e: segments[j].e, text };
        if (dur >= (minSec + maxSec) / 2) break;
      }
    }
    if (best && !out.some((c) => Math.abs(c.s - best!.s) < minSec / 3)) out.push(best);
  }
  // Si trop de candidats, on en garde un échantillon régulier.
  const step = Math.max(1, Math.ceil(out.length / maxCount));
  return out.filter((_, k) => k % step === 0).map((c, k) => ({ ...c, id: k + 1 }));
}

export type Scored = Candidate & { score: number; title: string; reason: string };

export function selectBest(scored: Scored[], n: number): Scored[] {
  const picked: Scored[] = [];
  for (const c of [...scored].sort((a, b) => b.score - a.score)) {
    if (picked.length >= n) break;
    if (picked.some((p) => c.s < p.e && p.s < c.e)) continue;
    picked.push(c);
  }
  return picked.sort((a, b) => a.s - b.s);
}

export const wordsIn = (words: Word[], s: number, e: number) => words.filter((w) => w.s >= s - 0.05 && w.e <= e + 0.05);
