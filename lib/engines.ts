import type { CredentialName } from "./settings";

// IA au choix pour chaque vidéo. Une valeur vide reprend le choix de Réglages.
type Engine = { id: string; label: string; key: CredentialName };

export const SCRIPT_ENGINES: Engine[] = [
  { id: "gpt", label: "GPT (OpenAI)", key: "openai" },
  { id: "claude", label: "Claude (Anthropic)", key: "anthropic" },
];
export const IMAGE_ENGINES: Engine[] = [
  { id: "gpt-image", label: "GPT Image (OpenAI)", key: "openai" },
  { id: "flux", label: "FLUX.2 Pro (Replicate)", key: "replicate" },
];
// Grok Imagine passe par l'API xAI ; les autres sont les outils vidéo de lib/ai-tools.ts (modèle et paramètres Replicate).
export const VIDEO_ENGINES: Engine[] = [
  { id: "grok", label: "Grok Imagine Lite (le moins cher)", key: "xai" },
  { id: "grokpro", label: "Grok Imagine 1.5", key: "xai" },
  { id: "kling", label: "Kling 3.0", key: "replicate" },
  { id: "veo", label: "Veo 3.1", key: "replicate" },
  { id: "seedance", label: "Seedance 2.0", key: "replicate" },
];

export const pickEngine = (list: Engine[], v: unknown) => list.find((e) => e.id === v)?.id ?? null;

type LlmSettings = { llmProvider: string; llmModel: string };
// Fournisseur et modèle d'écriture : le choix de la vidéo, sinon celui de Réglages.
// Si le fournisseur choisi n'est pas celui de Réglages, on prend son modèle courant.
export function scriptModel(engine: string | null | undefined, s: LlmSettings) {
  const provider: "openai" | "anthropic" = engine === "claude" ? "anthropic" : engine === "gpt" ? "openai" : s.llmProvider === "anthropic" ? "anthropic" : "openai";
  const model = provider === s.llmProvider ? s.llmModel : provider === "anthropic" ? "claude-sonnet-5-5" : "gpt-4o-mini";
  return { provider, model };
}
export const defaultScriptEngine = (s: LlmSettings) => (s.llmProvider === "anthropic" ? "claude" : "gpt");
export const defaultImageEngine = (s: { imageProvider: string }) => (s.imageProvider === "replicate" ? "flux" : "gpt-image");

// Voix off : un nom de voix OpenAI, ou "elevenlabs:<id>" pour une voix du compte ElevenLabs.
export const ELEVEN_PREFIX = "elevenlabs:";
export const isElevenVoice = (v?: string | null) => !!v?.startsWith(ELEVEN_PREFIX);

// Liste « Visuels » : "image", "video" (modèle de Réglages) ou "video:<moteur>".
export function parseVisuals(v: unknown) {
  const [mode, engine] = String(v || "image").split(":");
  return mode === "video" ? { visualMode: "video", engineVideo: pickEngine(VIDEO_ENGINES, engine) } : { visualMode: "image", engineVideo: null };
}

// Libellé lisible des IA d'une vidéo (page de l'épisode).
export function enginesSummary(e: { engineScript?: string | null; voice?: string | null; engineImage?: string | null; engineVideo?: string | null; visualMode?: string }) {
  const name = (list: Engine[], id?: string | null) => list.find((x) => x.id === id)?.label;
  return [
    name(SCRIPT_ENGINES, e.engineScript) && `Script : ${name(SCRIPT_ENGINES, e.engineScript)}`,
    e.voice && `Voix : ${isElevenVoice(e.voice) ? "ElevenLabs" : `OpenAI (${e.voice})`}`,
    e.visualMode === "video" ? name(VIDEO_ENGINES, e.engineVideo) && `Vidéo : ${name(VIDEO_ENGINES, e.engineVideo)}` : name(IMAGE_ENGINES, e.engineImage) && `Images : ${name(IMAGE_ENGINES, e.engineImage)}`,
  ].filter(Boolean).join(" · ");
}
