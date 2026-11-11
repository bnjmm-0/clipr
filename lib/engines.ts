import type { CredentialName } from "./settings";

// IA au choix pour chaque vidéo. Une valeur vide reprend le choix de Réglages.
type Engine = { id: string; label: string; key: CredentialName };

export const SCRIPT_ENGINES: Engine[] = [
  { id: "gpt", label: "GPT (OpenAI)", key: "openai" },
  { id: "claude", label: "Claude (Anthropic)", key: "anthropic" },
  { id: "gemini", label: "Gemini (Google)", key: "google" },
];
export const IMAGE_ENGINES: Engine[] = [
  { id: "gpt-image", label: "GPT Image (OpenAI)", key: "openai" },
  { id: "flux", label: "FLUX.2 Pro (Replicate)", key: "replicate" },
  { id: "gemini-image", label: "Nano Banana 2.1 (Gemini)", key: "google" },
];
// Grok Imagine passe par l'API xAI ; les autres sont les outils vidéo de lib/ai-tools.ts (modèle et paramètres Replicate).
export const VIDEO_ENGINES: Engine[] = [
  { id: "grok", label: "Grok Imagine Lite (le moins cher)", key: "xai" },
  { id: "grokpro", label: "Grok Imagine 1.5", key: "xai" },
  { id: "kling", label: "Kling 3.0", key: "replicate" },
  { id: "veo", label: "Veo 3.1", key: "replicate" },
  { id: "seedance", label: "Seedance 2.0", key: "replicate" },
  { id: "omni", label: "Gemini Omni Flash", key: "google" },
];

export const pickEngine = (list: Engine[], v: unknown) => list.find((e) => e.id === v)?.id ?? null;

type LlmSettings = { llmProvider: string; llmModel: string };
// Fournisseur et modèle d'écriture : le choix de la vidéo, sinon celui de Réglages.
// Si le fournisseur choisi n'est pas celui de Réglages, on prend son modèle courant.
type Provider = "openai" | "anthropic" | "google";
const ENGINE_PROVIDER: Record<string, Provider> = { gpt: "openai", claude: "anthropic", gemini: "google" };
const DEFAULT_MODEL: Record<Provider, string> = { openai: "gpt-4o-mini", anthropic: "claude-sonnet-5-5", google: "gemini-3.8-flash" };
export function scriptModel(engine: string | null | undefined, s: LlmSettings) {
  const provider: Provider = ENGINE_PROVIDER[engine ?? ""] ?? (s.llmProvider in DEFAULT_MODEL ? (s.llmProvider as Provider) : "openai");
  const model = provider === s.llmProvider ? s.llmModel : DEFAULT_MODEL[provider];
  return { provider, model };
}
export const defaultScriptEngine = (s: LlmSettings) => (s.llmProvider === "anthropic" ? "claude" : s.llmProvider === "google" ? "gemini" : "gpt");
export const defaultImageEngine = (s: { imageProvider: string }) => (s.imageProvider === "replicate" ? "flux" : s.imageProvider === "google" ? "gemini-image" : "gpt-image");

// Voix off : un nom de voix OpenAI, ou "elevenlabs:<id>" pour une voix du compte ElevenLabs.
export const ELEVEN_PREFIX = "elevenlabs:";
export const isElevenVoice = (v?: string | null) => !!v?.startsWith(ELEVEN_PREFIX);

// Voix prêtes à l'emploi de Gemini TTS (elles parlent français : la langue est détectée dans le texte).
export const GEMINI_PREFIX = "gemini:";
export const GEMINI_VOICES: [string, string][] = [
  ["Kore", "ferme"], ["Puck", "énergique"], ["Zephyr", "lumineuse"], ["Charon", "posée"], ["Fenrir", "excitée"], ["Leda", "jeune"],
  ["Orus", "stable"], ["Aoede", "légère"], ["Callirrhoe", "détendue"], ["Autonoe", "claire"], ["Enceladus", "soufflée"], ["Iapetus", "nette"],
  ["Umbriel", "calme"], ["Algieba", "douce"], ["Despina", "veloutée"], ["Erinome", "limpide"], ["Algenib", "rauque"], ["Rasalgethi", "informative"],
  ["Laomedeia", "pétillante"], ["Achernar", "tendre"], ["Alnilam", "assurée"], ["Schedar", "égale"], ["Gacrux", "mûre"], ["Pulcherrima", "directe"],
  ["Achird", "amicale"], ["Zubenelgenubi", "décontractée"], ["Vindemiatrix", "délicate"], ["Sadachbia", "vive"], ["Sadaltager", "savante"], ["Sulafat", "chaleureuse"],
];
export const isGeminiVoice = (v?: string | null) => !!v?.startsWith(GEMINI_PREFIX) && GEMINI_VOICES.some(([n]) => n === v.slice(GEMINI_PREFIX.length));


// Nom lisible d'une voix : « ElevenLabs », « Gemini Kore » ou « OpenAI alloy ».
export const voiceLabel = (v?: string | null) => (!v ? "" : isElevenVoice(v) ? "ElevenLabs" : isGeminiVoice(v) ? `Gemini ${v.slice(GEMINI_PREFIX.length)}` : `OpenAI ${v}`);

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
    e.voice && `Voix : ${isElevenVoice(e.voice) ? "ElevenLabs" : isGeminiVoice(e.voice) ? `Gemini (${e.voice.slice(GEMINI_PREFIX.length)})` : `OpenAI (${e.voice})`}`,
    e.visualMode === "video" ? name(VIDEO_ENGINES, e.engineVideo) && `Vidéo : ${name(VIDEO_ENGINES, e.engineVideo)}` : name(IMAGE_ENGINES, e.engineImage) && `Images : ${name(IMAGE_ENGINES, e.engineImage)}`,
  ].filter(Boolean).join(" · ");
}
