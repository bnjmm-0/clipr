import { prisma } from "./db";
import { open, seal } from "./crypto";

export const CREDENTIALS = [
  { name: "openai", label: "OpenAI", help: "LLM (scoring, Coach), transcription Whisper, images" },
  { name: "anthropic", label: "Anthropic (Claude)", help: "LLM alternatif pour le scoring et le Coach" },
  { name: "groq", label: "Groq", help: "Transcription Whisper rapide et peu chère (alternative à OpenAI)" },
  { name: "replicate", label: "Replicate", help: "Génération d'images et de vidéos (modèles au choix)" },
  { name: "tiktok_client_key", label: "TikTok — Client key", help: "De l'app développeur TikTok créée sous votre compte" },
  { name: "tiktok_client_secret", label: "TikTok — Client secret", help: "De la même app développeur TikTok" },
  { name: "meta_app_id", label: "Meta — App ID", help: "App développeur Meta (Facebook) créée sous votre compte" },
  { name: "meta_app_secret", label: "Meta — App secret", help: "De la même app Meta" },
  { name: "youtube", label: "YouTube Data API", help: "Clé Google Cloud pour relever les vidéos qui montent (Tendances)" },
  { name: "elevenlabs", label: "ElevenLabs", help: "Voix off réalistes (outil ElevenLabs de Conseils IA)" },
] as const;
export type CredentialName = (typeof CREDENTIALS)[number]["name"];

export const FEATURES = [
  { key: "clips", label: "Clips automatiques", help: "Vidéo longue → clips verticaux sous-titrés" },
  { key: "textToImage", label: "Texte → image", help: "Génère des images à partir d'un texte" },
  { key: "textToVideo", label: "Texte → vidéo", help: "Génère de courtes vidéos IA (Replicate)" },
  { key: "tiktokCoach", label: "Coach TikTok", help: "Analyse du compte, planning, scripts" },
  { key: "tiktokPublish", label: "Publication TikTok", help: "Envoi direct et planifié des clips sur TikTok" },
  { key: "facebookPublish", label: "Publication Facebook", help: "Envoi des vidéos en Reels sur une Page Facebook" },
  { key: "autoPublish", label: "Publication automatique", help: "Chaque vidéo prête part seule sur les créneaux choisis" },
  { key: "aiVideos", label: "Vidéos IA et séries", help: "Personnages, épisodes générés et enregistrés automatiquement" },
  { key: "remix", label: "Reprendre une vidéo", help: "Analyse une vidéo existante et en écrit une version originale" },
  { key: "trends", label: "Tendances du moment", help: "Vidéos qui montent et idées, mises à jour toutes les 6 h" },
  { key: "stats", label: "Statistiques des comptes", help: "Abonnés, vues et meilleures vidéos TikTok et Facebook" },
] as const;
export type FeatureKey = (typeof FEATURES)[number]["key"];

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
