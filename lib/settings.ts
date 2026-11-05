import { prisma } from "./db";
import { open, seal } from "./crypto";

export const CREDENTIALS = [
  { name: "openai", label: "OpenAI", help: "LLM (scoring, Coach), transcription Whisper, images" },
  { name: "anthropic", label: "Anthropic (Claude)", help: "LLM alternatif pour le scoring et le Coach" },
  { name: "groq", label: "Groq", help: "Transcription Whisper rapide et peu chère (alternative à OpenAI)" },
  { name: "replicate", label: "Replicate", help: "Génération d'images et de vidéos (modèles au choix)" },
  { name: "tiktok_client_key", label: "TikTok — Client key", help: "De l'app développeur TikTok créée sous votre compte" },
  { name: "tiktok_client_secret", label: "TikTok — Client secret", help: "De la même app développeur TikTok" },
] as const;
export type CredentialName = (typeof CREDENTIALS)[number]["name"];

export const FEATURES = [
  { key: "clips", label: "Clips automatiques", help: "Vidéo longue → clips verticaux sous-titrés" },
  { key: "textToImage", label: "Texte → image", help: "Génère des images à partir d'un texte" },
  { key: "textToVideo", label: "Texte → vidéo", help: "Génère de courtes vidéos IA (Replicate)" },
  { key: "tiktokCoach", label: "Coach TikTok", help: "Analyse du compte, planning, scripts" },
  { key: "tiktokPublish", label: "Publication TikTok", help: "Envoi direct et planifié des clips sur TikTok" },
] as const;
export type FeatureKey = (typeof FEATURES)[number]["key"];

export async function getSettings() {
  const s = await prisma.appSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  return { ...s, features: JSON.parse(s.featuresJson) as Record<FeatureKey, boolean>, prices: JSON.parse(s.pricesJson) as Record<string, number> };
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
