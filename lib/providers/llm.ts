import { getSettings, requireCredential } from "../settings";
import { priceOf, recordUsage } from "../usage";
import { apiError } from "./errors";

export type ChatOpts = {
  system: string; user: string; json?: boolean; maxTokens?: number; userId?: string | null; purpose?: string;
  provider?: "openai" | "anthropic"; model?: string; // par défaut : ceux de Réglages
};

// Appel LLM via la clé du client (OpenAI ou Anthropic selon Réglages). Retourne le texte.
export async function chat(o: ChatOpts): Promise<string> {
  const s = await getSettings();
  const provider = o.provider ?? s.llmProvider;
  const model = o.model ?? s.llmModel;
  let text = "", tin = 0, tout = 0;
  if (provider === "anthropic") {
    const key = await requireCredential("anthropic");
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: o.maxTokens ?? 2000, system: o.system + (o.json ? "\nRéponds uniquement avec du JSON valide, sans texte autour." : ""),
        messages: [{ role: "user", content: o.user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw apiError("Anthropic", r.status, j);
    text = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
    tin = j.usage?.input_tokens ?? 0; tout = j.usage?.output_tokens ?? 0;
  } else {
    const key = await requireCredential("openai");
    const r = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model, max_completion_tokens: o.maxTokens ?? 2000,
        ...(o.json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "system", content: o.system }, { role: "user", content: o.user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw apiError("OpenAI", r.status, j);
    text = j.choices?.[0]?.message?.content ?? "";
    tin = j.usage?.prompt_tokens ?? 0; tout = j.usage?.completion_tokens ?? 0;
  }
  const p = provider;
  const cost = (tin * priceOf(`${p}:${model}:in`, s.prices) + tout * priceOf(`${p}:${model}:out`, s.prices)) / 1e6;
  await recordUsage({ userId: o.userId, provider: p, kind: "llm", model, units: tin + tout, unitLabel: "tokens", costUsd: cost, meta: { purpose: o.purpose, tin, tout } });
  return text;
}

export function parseJsonLoose<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t) as T; } catch {
    const m = t.match(/[\[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Réponse LLM non JSON");
  }
}
