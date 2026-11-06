// Outils de la page Conseils IA utilisables directement dans Clipr (« Utiliser ici »).
// Chaque outil passe par une API officielle avec la clé du client : OpenAI, Anthropic, Replicate ou ElevenLabs.
// Modèles Replicate vérifiés en novembre 2026 (pages llms.txt de replicate.com) ; les coûts affichés sont indicatifs.
import type { CredentialName, FeatureKey } from "./settings";

export type ToolChoice = { v: string; label: string };
export type ToolField = { name: string; label: string; choices: ToolChoice[] };
export type ToolKind = "text" | "image" | "video" | "audio";
export type ToolApp = {
  id: string;
  name: string;
  kind: ToolKind;
  key: CredentialName;
  feature?: FeatureKey; // fonction à activer dans Réglages (images et vidéos)
  intro: string;
  placeholder: string;
  cost: string;
  fields: ToolField[];
  model?: string; // modèle Replicate ou OpenAI
};

const c = (...xs: (string | [string, string])[]): ToolChoice[] => xs.map((x) => (Array.isArray(x) ? { v: x[0], label: x[1] } : { v: x, label: x }));

const STYLE: ToolField = { name: "style", label: "Style", choices: c(["", "Libre"], "photo réaliste", "3D façon film d'animation", "illustration", "anime", "pâte à modeler", "peinture numérique", "cinématique") };
const TEXT_FIELDS: ToolField[] = [
  { name: "type", label: "Type de texte", choices: c("script de vidéo courte", "dialogues d'un épisode", "10 idées de vidéos", "5 accroches pour les 3 premières secondes", "légende et hashtags") },
  { name: "length", label: "Durée visée", choices: c("15 secondes", "30 secondes", "60 secondes", "3 minutes") },
  { name: "tone", label: "Ton", choices: c("drôle", "dramatique", "éducatif", "motivant", "mystérieux") },
  { name: "platform", label: "Plateforme", choices: c("TikTok", "YouTube Shorts", "Instagram Reels") },
];

export const TOOL_APPS: Record<string, ToolApp> = {
  chatgpt: {
    id: "chatgpt", name: "ChatGPT", kind: "text", key: "openai",
    intro: "Écris ton sujet : ChatGPT rédige le texte selon les options choisies.",
    placeholder: "Une série où des fruits vivent dans un frigo et se disputent la place au soleil",
    cost: "Quelques centimes par texte, sur ta clé OpenAI.",
    fields: TEXT_FIELDS,
  },
  claude: {
    id: "claude", name: "Claude", kind: "text", key: "anthropic",
    intro: "Écris ton sujet : Claude rédige le texte selon les options choisies.",
    placeholder: "L'histoire vraie d'un phare abandonné en Bretagne, racontée comme un mystère",
    cost: "Quelques centimes par texte, sur ta clé Anthropic.",
    fields: TEXT_FIELDS,
  },
  "gpt-image": {
    id: "gpt-image", name: "GPT Image 2", kind: "image", key: "openai", feature: "textToImage", model: "gpt-image-2",
    intro: "Décris l'image : GPT Image 2 suit très fidèlement les détails du prompt.",
    placeholder: "Une fraise en colère avec de grands yeux, au bord d'une piscine, lumière dorée",
    cost: "Quelques centimes par image selon la qualité, sur ta clé OpenAI.",
    fields: [
      STYLE,
      { name: "format", label: "Format", choices: c(["1024x1536", "Vertical 9:16"], ["1024x1024", "Carré 1:1"], ["1536x1024", "Horizontal 16:9"]) },
      { name: "quality", label: "Qualité", choices: c(["medium", "Moyenne"], ["high", "Haute"], ["low", "Rapide"]) },
    ],
  },
  flux: {
    id: "flux", name: "FLUX.2 Pro", kind: "image", key: "replicate", feature: "textToImage", model: "black-forest-labs/flux-2-pro",
    intro: "Décris l'image : FLUX.2 est très bon en photo réaliste et en rendu produit.",
    placeholder: "Un ananas en lunettes de soleil sur une plage, photo réaliste, fond flou",
    cost: "Quelques centimes par image, sur ton compte Replicate.",
    fields: [
      STYLE,
      { name: "aspect_ratio", label: "Format", choices: c(["9:16", "Vertical 9:16"], ["1:1", "Carré 1:1"], ["16:9", "Horizontal 16:9"]) },
      { name: "resolution", label: "Résolution", choices: c(["1 MP", "Standard (1 MP)"], ["2 MP", "Haute (2 MP)"]) },
    ],
  },
  kling: {
    id: "kling", name: "Kling 3.0", kind: "video", key: "replicate", feature: "textToVideo", model: "kwaivgi/kling-v3-video",
    intro: "Décris la vidéo : l'action, les personnages, le mouvement de caméra. Mets les dialogues entre guillemets.",
    placeholder: "La fraise se tourne vers la banane et crie « Tu m'as menti ! », la caméra se rapproche",
    cost: "Plusieurs dizaines de centimes à quelques dollars par vidéo selon la durée et la qualité, sur ton compte Replicate.",
    fields: [
      STYLE,
      { name: "duration", label: "Durée", choices: c(["5", "5 s"], ["10", "10 s"], ["15", "15 s"]) },
      { name: "aspect_ratio", label: "Format", choices: c(["9:16", "Vertical 9:16"], ["1:1", "Carré 1:1"], ["16:9", "Horizontal 16:9"]) },
      { name: "mode", label: "Qualité", choices: c(["standard", "Standard (720p)"], ["pro", "Pro (1080p)"]) },
      { name: "generate_audio", label: "Son", choices: c(["true", "Avec son et voix"], ["false", "Sans son"]) },
    ],
  },
  veo: {
    id: "veo", name: "Veo 3.1", kind: "video", key: "replicate", feature: "textToVideo", model: "google/veo-3.1",
    intro: "Décris la vidéo : Veo 3.1 est le plus réaliste et génère le son (voix, bruitages, ambiance).",
    placeholder: "Un podcasteur éclate de rire face caméra dans un studio aux néons roses",
    cost: "Environ 0,40 $ par seconde avec le son (indicatif), sur ton compte Replicate.",
    fields: [
      STYLE,
      { name: "duration", label: "Durée", choices: c(["4", "4 s"], ["6", "6 s"], ["8", "8 s"]) },
      { name: "aspect_ratio", label: "Format", choices: c(["9:16", "Vertical 9:16"], ["16:9", "Horizontal 16:9"]) },
      { name: "resolution", label: "Qualité", choices: c(["720p", "720p"], ["1080p", "1080p"]) },
      { name: "generate_audio", label: "Son", choices: c(["true", "Avec son"], ["false", "Sans son"]) },
    ],
  },
  seedance: {
    id: "seedance", name: "Seedance 2.0", kind: "video", key: "replicate", feature: "textToVideo", model: "bytedance/seedance-2.0",
    intro: "Décris la vidéo : Seedance 2.0 garde bien les personnages et gère dialogues et musique.",
    placeholder: "Deux avocats dansent dans une cuisine sur une musique entraînante, plan large",
    cost: "Environ 0,15 à 0,20 $ par seconde (indicatif), sur ton compte Replicate.",
    fields: [
      STYLE,
      { name: "duration", label: "Durée", choices: c(["5", "5 s"], ["10", "10 s"], ["-1", "Automatique"]) },
      { name: "aspect_ratio", label: "Format", choices: c(["9:16", "Vertical 9:16"], ["1:1", "Carré 1:1"], ["16:9", "Horizontal 16:9"]) },
      { name: "resolution", label: "Qualité", choices: c(["720p", "720p"], ["480p", "480p (moins cher)"]) },
      { name: "generate_audio", label: "Son", choices: c(["true", "Avec son"], ["false", "Sans son"]) },
    ],
  },
  elevenlabs: {
    id: "elevenlabs", name: "ElevenLabs", kind: "audio", key: "elevenlabs",
    intro: "Colle le texte à lire : ElevenLabs le transforme en voix off naturelle.",
    placeholder: "Ce matin-là, personne n'aurait pu imaginer ce qui se cachait derrière la porte du phare…",
    cost: "Selon ton forfait ElevenLabs (facturé au nombre de caractères).",
    fields: [
      { name: "speed", label: "Vitesse", choices: c(["1", "Normale"], ["0.9", "Plus lente"], ["1.1", "Plus rapide"]) },
      { name: "stability", label: "Interprétation", choices: c(["0.5", "Naturelle"], ["0.3", "Expressive"], ["0.75", "Posée"]) },
    ],
  },
};

// Valeurs choisies dans le formulaire, limitées aux choix proposés (première valeur par défaut).
export function pickOptions(t: ToolApp, get: (name: string) => string | null): Record<string, string> {
  return Object.fromEntries(t.fields.map((f) => {
    const v = get(f.name) ?? "";
    return [f.name, f.choices.some((ch) => ch.v === v) ? v : f.choices[0].v];
  }));
}

export const withStyle = (prompt: string, style?: string) => (style ? `Style ${style}. ${prompt}` : prompt);
