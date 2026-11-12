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
  "openai:gpt-image-1": { price: 0.063, per: "image" },
  // Prix d'une image 1024×1536 selon la qualité (tarif OpenAI, à vérifier sur leur page).
  "openai:image:low": { price: 0.016, per: "image" },
  "openai:image:medium": { price: 0.063, per: "image" },
  "openai:image:high": { price: 0.25, per: "image" },
  // Grok Imagine (xAI), payé à la seconde de vidéo produite (tarifs « à partir de » de xAI, à vérifier).
  "xai:grok-imagine-video-1.5-lite": { price: 0.02, per: "seconde" },
  "xai:grok-imagine-video-1.5": { price: 0.08, per: "seconde" },
  "openai:gpt-4o-mini-tts": { price: 0.015, per: "minute" },
  "openai:tts-1": { price: 0.015 * 1.5, per: "minute" },
  "replicate:image": { price: 0.03, per: "image" },
  "replicate:video": { price: 0.5, per: "vidéo" },
  "replicate:kwaivgi/kling-lip-sync": { price: 0.014, per: "seconde" },
  // Google Gemini (tarifs publics AI Studio, novembre 2026)
  "google:gemini-3.8-flash:in": { price: 0.75, per: "1M tokens" },
  "google:gemini-3.8-flash:out": { price: 3.75, per: "1M tokens" },
  "google:gemini-3.5-flash-lite:in": { price: 0.3, per: "1M tokens" },
  "google:gemini-3.5-flash-lite:out": { price: 2.5, per: "1M tokens" },
  "google:gemini-3.1-pro-preview:in": { price: 2, per: "1M tokens" },
  "google:gemini-3.1-pro-preview:out": { price: 12, per: "1M tokens" },
  "google:gemini-nano-banana-2.1": { price: 0.0336, per: "image" },
  "google:gemini-3.1-flash-image": { price: 0.067, per: "image" },
  "google:gemini-3-pro-image": { price: 0.134, per: "image" },
  "google:gemini-3.8-flash-tts": { price: 9, per: "1M tokens audio" },
  "google:gemini-omni-1.2-flash": { price: 0.07, per: "seconde" },
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
