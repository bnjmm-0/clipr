import { prisma } from "./db";
import { open, seal } from "./crypto";

export const CREDENTIALS = [
  { name: "openai", label: "OpenAI", help: "LLM (scoring, Coach), transcription Whisper, images", url: "https://platform.openai.com/api-keys" },
  { name: "anthropic", label: "Anthropic (Claude)", help: "LLM alternatif pour le scoring et le Coach", url: "https://console.anthropic.com/settings/keys" },
  { name: "google", label: "Google Gemini", help: "Une seule clé pour tout : scripts, analyse d'images, images (Nano Banana), voix off et plans vidéo (Omni)", url: "https://aistudio.google.com/apikey" },
  { name: "groq", label: "Groq", help: "Transcription Whisper rapide et peu chère (alternative à OpenAI)", url: "https://console.groq.com/keys" },
  { name: "xai", label: "xAI (Grok Imagine)", help: "Plans vidéo animés à partir des images des scènes, peu chers (payés à la seconde)", url: "https://console.x.ai" },
  { name: "replicate", label: "Replicate", help: "Génération d'images et de vidéos (modèles au choix)", url: "https://replicate.com/account/api-tokens" },
  { name: "tiktok_client_key", label: "TikTok — Client key", help: "De l'app développeur TikTok créée sous votre compte", url: "https://developers.tiktok.com/apps" },
  { name: "tiktok_client_secret", label: "TikTok — Client secret", help: "De la même app développeur TikTok", url: "https://developers.tiktok.com/apps" },
  { name: "meta_app_id", label: "Meta — App ID", help: "App développeur Meta (Facebook) créée sous votre compte", url: "https://developers.facebook.com/apps" },
  { name: "meta_app_secret", label: "Meta — App secret", help: "De la même app Meta", url: "https://developers.facebook.com/apps" },
  { name: "youtube", label: "YouTube Data API — Clé", help: "Clé Google Cloud pour relever les vidéos qui montent (Tendances)", url: "https://console.cloud.google.com/apis/credentials" },
  { name: "google_client_id", label: "YouTube — Client ID OAuth", help: "Du projet Google Cloud créé sous votre compte (publication des Shorts)", url: "https://console.cloud.google.com/apis/credentials" },
  { name: "google_client_secret", label: "YouTube — Client secret OAuth", help: "Du même identifiant OAuth Google", url: "https://console.cloud.google.com/apis/credentials" },
  { name: "elevenlabs", label: "ElevenLabs", help: "Voix off réalistes (outil ElevenLabs de Conseils IA)", url: "https://elevenlabs.io/app/settings/api-keys" },
] as const;
export type CredentialName = (typeof CREDENTIALS)[number]["name"];

export const FEATURES = [
  { key: "clips", label: "Clips automatiques", help: "Vidéo longue → clips verticaux sous-titrés" },
  { key: "textToImage", label: "Texte → image", help: "Génère des images à partir d'un texte" },
  { key: "textToVideo", label: "Texte → vidéo", help: "Génère de courtes vidéos IA (Replicate)" },
  { key: "tiktokCoach", label: "Coach TikTok", help: "Analyse du compte, planning, scripts" },
  { key: "tiktokPublish", label: "Publication TikTok", help: "Envoi direct et planifié des clips sur TikTok" },
  { key: "facebookPublish", label: "Publication Facebook", help: "Envoi des vidéos en Reels sur une Page Facebook" },
  { key: "youtubePublish", label: "Publication YouTube", help: "Envoi des clips en Shorts sur une chaîne YouTube" },
  { key: "autoPublish", label: "Publication automatique", help: "Chaque vidéo prête part seule sur les créneaux choisis" },
  { key: "aiVideos", label: "Vidéos IA et séries", help: "Personnages, épisodes générés et enregistrés automatiquement" },
  { key: "remix", label: "Reprendre une vidéo", help: "Analyse une vidéo existante et en écrit une version originale" },
  { key: "trends", label: "Tendances du moment", help: "Vidéos qui montent et idées, mises à jour toutes les 6 h" },
  { key: "stats", label: "Statistiques des comptes", help: "Abonnés, vues et meilleures vidéos TikTok, Facebook et YouTube" },
] as const;
export type FeatureKey = (typeof FEATURES)[number]["key"];

// Plateformes de publication : nom affiché et fonction de Réglages qui les active.
export const PLATFORMS = { tiktok: { label: "TikTok", feature: "tiktokPublish" }, facebook: { label: "Facebook", feature: "facebookPublish" }, youtube: { label: "YouTube", feature: "youtubePublish" } } as const satisfies Record<string, { label: string; feature: FeatureKey }>;
export type Platform = keyof typeof PLATFORMS;
export const isPlatform = (p: string): p is Platform => p in PLATFORMS;
export const platformLabel = (p: string) => (isPlatform(p) ? PLATFORMS[p].label : p);

export async function getSettings() {
  const s = await prisma.appSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  const defaults = { clips: true, trends: true } as Partial<Record<FeatureKey, boolean>>;
  return { ...s, features: { ...defaults, ...JSON.parse(s.featuresJson) } as Record<FeatureKey, boolean>, prices: JSON.parse(s.pricesJson) as Record<string, number> };
}

export async function featureEnabled(k: FeatureKey) {
  return Boolean((await getSettings()).features[k]);
}

// Serveur uniquement : déchiffre une clé pour un appel sortant.
export async function getCredential(name: CredentialName): Promise<string | null> {
  const row = await prisma.apiCredential.findUnique({ where: { name } });
  if (!row) return null;
  return open({ ciphertext: row.ciphertext, iv: row.iv, tag: row.tag }, `cred:${name}`);
}

export async function requireCredential(name: CredentialName) {
  const v = await getCredential(name);
  if (!v) throw new Error(`Clé API « ${name} » absente : ajoutez-la dans Réglages.`);
  return v;
}

export async function setCredential(name: CredentialName, value: string) {
  const s = seal(value, `cred:${name}`);
  const last4 = value.slice(-4);
  await prisma.apiCredential.upsert({ where: { name }, update: { ...s, last4 }, create: { name, ...s, last4 } });
}

export async function deleteCredential(name: CredentialName) {
  await prisma.apiCredential.deleteMany({ where: { name } });
}

// Ce que le navigateur a le droit de voir : présence + 4 derniers caractères.
export async function credentialStatus() {
  const rows = await prisma.apiCredential.findMany({ select: { name: true, last4: true, updatedAt: true } });
  return Object.fromEntries(rows.map((r) => [r.name, r]));
}
