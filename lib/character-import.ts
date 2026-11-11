// Personnage importé : une image faite ailleurs (Midjourney, Magnific…) devient directement sa fiche de référence,
// sans génération payante. Une seule analyse visuelle (image réduite à 512 px, mode « low » ≈ 85 tokens)
// en tire une description courte, reprise ensuite dans chaque prompt d'image : moins de tokens à chaque scène.
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { STORAGE_DIR } from "./storage";
import { run } from "./pipeline/ffmpeg";
import { chat, parseJsonLoose } from "./providers/llm";

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024; // le navigateur réduit l'image avant l'envoi (limite des server actions)
export const IMPORT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const LOOK_MAX = 300; // caractères : la description est envoyée avec chaque image générée

export const importedRef = (id: string) => path.join(STORAGE_DIR, "characters", `${id}_import.png`);
export const isImported = (c: { id: string; refImagePath: string | null }) => c.refImagePath === importedRef(c.id);
// Échantillon de voix d'un personnage (bouton « Écouter » de sa fiche) et la dernière erreur éventuelle.
export const voiceSample = (id: string) => path.join(STORAGE_DIR, "characters", `${id}_voice.mp3`);
export const voiceSampleError = (id: string) => `${voiceSample(id)}.erreur.txt`;

// Enregistre l'image envoyée en PNG (format attendu par les modèles d'image comme référence), 1024 px max.
export async function saveCharacterImage(id: string, file: Blob) {
  const out = importedRef(id);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.upload`;
  fs.writeFileSync(tmp, Buffer.from(await file.arrayBuffer()));
  try { await run("ffmpeg", ["-y", "-i", tmp, "-vf", "scale='min(1024,iw)':-2", "-frames:v", "1", out]); } finally { fs.rmSync(tmp, { force: true }); }
  return out;
}

const SYSTEM = `Tu décris des personnages de vidéos courtes (fruits et objets anthropomorphes) pour un générateur d'images qui recevra aussi l'image de référence.
Décris uniquement ce qui le rend reconnaissable : le fruit ou l'objet, les couleurs, la forme du corps, les yeux, la bouche, la tenue, les accessoires, la texture et le style de rendu.
N'écris rien sur le décor, la pose, la lumière ou le cadrage. Pas de phrases : des groupes de mots séparés par des virgules, en français.`;

type Analysis = { name?: string; look?: string; personality?: string; style?: string };

export async function analyzeCharacter(characterId: string) {
  const c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
  if (!c.refImagePath || !fs.existsSync(c.refImagePath)) throw new Error("Image du personnage introuvable : importe-la à nouveau.");
  // Miniature JPEG 512 px : l'analyse en mode « low » n'a pas besoin de plus.
  const thumb = `${c.refImagePath}.analyse.jpg`;
  await run("ffmpeg", ["-y", "-i", c.refImagePath, "-vf", "scale=512:512:force_original_aspect_ratio=decrease", "-q:v", "4", "-frames:v", "1", thumb]);
  try {
    const raw = await chat({
      system: SYSTEM, json: true, maxTokens: 400, images: [thumb], userId: c.userId, purpose: "analyse personnage importé",
      user: `Analyse ce personnage et réponds en JSON :
{"name": "un prénom court et drôle lié au fruit", "look": "description visuelle en ${LOOK_MAX} caractères maximum", "personality": "2 ou 3 traits de caractère que son allure suggère", "style": "le style de rendu en quelques mots (ex. 3D hyperréaliste façon film d'animation)"}`,
    });
    const a = parseJsonLoose<Analysis>(raw);
    const look = String(a.look ?? "").replace(/\s+/g, " ").trim().slice(0, LOOK_MAX);
    if (!look) throw new Error("L'analyse n'a rien décrit : relance-la, ou essaie une image plus nette.");
    await prisma.character.update({ where: { id: c.id }, data: {
      look,
      // Ce que la personne a écrit garde la priorité sur les suggestions de l'analyse.
      name: c.name || String(a.name ?? "").trim().slice(0, 60) || "Personnage",
      personality: c.personality || String(a.personality ?? "").trim().slice(0, 600),
      visualStyle: String(a.style ?? "").trim().slice(0, 120) || c.visualStyle,
    } });
  } finally { fs.rmSync(thumb, { force: true }); }
}
