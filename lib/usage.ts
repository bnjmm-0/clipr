import { prisma } from "./db";

// Tarifs indicatifs (USD) pour estimer la dépense. Modifiables dans Réglages (pricesJson),
// car les prix des fournisseurs changent : à vérifier sur leurs pages de tarifs.
export const DEFAULT_PRICES: Record<string, { price: number; per: string }> = {
  "openai:gpt-4o-mini:in": { price: 0.15, per: "1M tokens" },
  "openai:gpt-4o-mini:out": { price: 0.6, per: "1M tokens" },
  "openai:gpt-4o:in": { price: 2.5, per: "1M tokens" },
  "openai:gpt-4o:out": { price: 10, per: "1M tokens" },
  "anthropic:claude-haiku-5-5:in": { price: 1, per: "1M tokens" },
  "anthropic:claude-haiku-5-5:out": { price: 5, per: "1M tokens" },
  "anthropic:claude-sonnet-5-5:in": { price: 3, per: "1M tokens" },
  "anthropic:claude-sonnet-5-5:out": { price: 15, per: "1M tokens" },
  "openai:whisper-1": { price: 0.006, per: "minute" },
  "groq:whisper-large-v3-turbo": { price: 0.04 / 60, per: "minute" },
  "openai:gpt-image-1": { price: 0.04, per: "image" },
  "openai:gpt-4o-mini-tts": { price: 0.015, per: "minute" },
  "openai:tts-1": { price: 0.015 * 1.5, per: "minute" },
  "replicate:image": { price: 0.03, per: "image" },
  "replicate:video": { price: 0.5, per: "vidéo" },
};

export function priceOf(key: string, overrides: Record<string, number> = {}) {
  if (key in overrides) return overrides[key];
  return DEFAULT_PRICES[key]?.price ?? 0;
}

export async function recordUsage(e: {
  userId?: string | null; provider: string; kind: string; model?: string; units: number; unitLabel: string; costUsd: number; meta?: unknown;
}) {
  await prisma.usageEvent.create({
    data: { ...e, userId: e.userId ?? null, costUsd: Math.round(e.costUsd * 1e6) / 1e6, meta: e.meta ? JSON.stringify(e.meta) : null },
  });
}
