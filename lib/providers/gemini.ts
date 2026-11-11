// Google Gemini (clé AI Studio) : texte, analyse d'images, images (Nano Banana), voix off (TTS) et plans vidéo (Omni),
// tous par l'Interactions API : POST /v1beta/interactions, réponse dans steps[].content[] (texte ou données en base64).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { requireCredential } from "../settings";
import { apiError } from "./errors";
export { GEMINI_PREFIX, GEMINI_VOICES, isGeminiVoice } from "../engines";

export const GEMINI_URL = () => process.env.GOOGLE_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_TEXT = "gemini-3.8-flash";
export const GEMINI_IMAGE = "gemini-nano-banana-2.1";
export const GEMINI_TTS = "gemini-3.8-flash-tts";
export const GEMINI_VIDEO = "gemini-omni-1.2-flash";

type Block = { type?: string; text?: string; data?: string; uri?: string; mime_type?: string };
export type Interaction = { status?: string; steps?: { type?: string; content?: Block[] }[]; outputs?: Block[]; usage?: { total_input_tokens?: number; total_output_tokens?: number; total_thought_tokens?: number } };

// Modèles de secours quand un modèle de texte est saturé chez Google (« high demand »).
const FALLBACK: Record<string, string[]> = { "gemini-3.8-flash": ["gemini-3.6-flash", "gemini-3.5-flash-lite"], "gemini-3.6-flash": ["gemini-3.5-flash-lite"] };
const WAIT_MS = [2000, 6000, 15000];
// Erreur passagère : coupure réseau, modèle saturé (429/500/503). On réessaie, puis on passe au modèle de secours.
class Busy extends Error {}

async function once(body: Record<string, unknown>, key: string): Promise<Interaction> {
  let r: Response;
  try {
    r = await fetch(`${GEMINI_URL()}/interactions`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json", "api-revision": "2026-05-20" },
      body: JSON.stringify({ store: false, ...body }),
    });
  } catch (e) {
    const code = (e as { cause?: { code?: string } }).cause?.code;
    throw new Busy(`Connexion à Gemini impossible${code ? ` (${code})` : ""} : vérifie ta connexion internet, puis relance.`);
  }
  const j = await r.json().catch(() => ({}));
  const raw = JSON.stringify(j);
  // Modèle absent de l'offre gratuite (« limit: 0 … Free Tier ») : réessayer ne sert à rien.
  if (r.status === 429 && /limit: 0|free tier/i.test(raw)) throw new Error(`Le modèle ${body.model} n'est pas inclus dans l'offre gratuite de Gemini : active la facturation sur aistudio.google.com (Billing), puis relance.`);
  if (r.status === 429) throw new Busy("Gemini limite le nombre de demandes : attends une minute (ou active la facturation sur AI Studio), puis relance.");
  if (r.status >= 500 || /high demand|overloaded|UNAVAILABLE/i.test(raw)) throw new Busy("Gemini est saturé en ce moment chez Google : relance dans quelques minutes.");
  if (!r.ok) throw apiError("Gemini", r.status, j);
  // « incomplete » : réponse coupée à la longueur maximale ; le texte reçu reste utilisable.
  if (j.status && j.status !== "completed" && j.status !== "incomplete") throw new Error(`Gemini : génération ${j.status === "failed" ? "refusée ou échouée" : j.status}`);
  return j;
}

export async function interact(body: Record<string, unknown>): Promise<Interaction> {
  const key = await requireCredential("google");
  const models = [String(body.model), ...(FALLBACK[String(body.model)] ?? [])];
  let last: Error = new Error("Gemini : aucune réponse");
  for (const model of models) {
    for (let i = 0; i <= WAIT_MS.length; i++) {
      try { return await once({ ...body, model }, key); } catch (e) {
        if (!(e instanceof Busy)) throw e;
        last = e;
        if (i < WAIT_MS.length) await new Promise((res) => setTimeout(res, WAIT_MS[i]));
      }
    }
  }
  throw last;
}

// Blocs produits par le modèle (on ignore ce qui a été envoyé, les étapes « user_input »).
export function outputBlocks(j: Interaction): Block[] {
  const fromSteps = (j.steps ?? []).filter((s) => s.type !== "user_input").flatMap((s) => s.content ?? []);
  return fromSteps.length ? fromSteps : j.outputs ?? [];
}
export const outputText = (j: Interaction) => outputBlocks(j).filter((b) => b.type === "text" && b.text).map((b) => b.text).join("");

// Écrit le premier fichier produit (image, audio ou vidéo) : en base64 dans la réponse, ou à télécharger avec la clé.
export async function saveOutput(j: Interaction, kind: "image" | "audio" | "video", outFile: string) {
  const b = outputBlocks(j).find((x) => x.type === kind && (x.data || x.uri));
  if (!b) throw new Error(`Gemini n'a renvoyé aucun${kind === "image" ? "e image" : kind === "audio" ? " son" : "e vidéo"} (contenu refusé ? reformule la demande).`);
  if (b.data) { fs.writeFileSync(outFile, Buffer.from(b.data, "base64")); return b.mime_type ?? ""; }
  const key = await requireCredential("google");
  const r = await fetch(b.uri!, { headers: { "x-goog-api-key": key } });
  if (!r.ok) throw new Error(`Gemini : téléchargement impossible (${r.status})`);
  fs.writeFileSync(outFile, Buffer.from(await r.arrayBuffer()));
  return b.mime_type ?? "";
}

// Image jointe à une demande (référence de personnage, image de départ) : JPEG de 1080 px au plus pour rester légère.
export function imagePart(file: string) {
  const jpg = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", "scale='min(1080,iw)':-2", "-q:v", "3", "-f", "image2pipe", "-vcodec", "mjpeg", "-"], { maxBuffer: 32 << 20 });
  return { type: "image", mime_type: "image/jpeg", data: jpg.toString("base64") };
}
