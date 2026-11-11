import { credentialStatus, getSettings } from "@/lib/settings";
import { ELEVEN_PREFIX, GEMINI_PREFIX, GEMINI_VOICES, IMAGE_ENGINES, SCRIPT_ENGINES, VIDEO_ENGINES, defaultImageEngine, defaultScriptEngine } from "@/lib/engines";
import { VOICES } from "@/lib/providers/tts";
import { listElevenVoices, type ElevenVoice } from "@/lib/providers/tools";

type Field = "script" | "voice" | "visuals" | "image";

// Voix ElevenLabs du compte, gardées 10 min pour ne pas appeler l'API à chaque affichage
// (une liste vide n'est pas gardée : une clé ajoutée ou corrigée est prise en compte tout de suite).
let eleven: { at: number; voices: ElevenVoice[] } | null = null;
async function elevenVoices(hasKey: boolean) {
  if (!hasKey) return [];
  if (!eleven || Date.now() - eleven.at > 600_000) {
    const voices = (await listElevenVoices()).voices;
    eleven = voices.length ? { at: Date.now(), voices } : null;
    return voices;
  }
  return eleven.voices;
}

// Voix proposée par défaut aux nouveaux personnages : une voix Gemini quand Gemini écrit les scripts.
export const defaultVoice = (s: { llmProvider: string }) => (s.llmProvider === "google" ? `${GEMINI_PREFIX}Kore` : "alloy");

// Options d'une liste « Voix off » : voix OpenAI, voix Gemini ("gemini:<nom>") et voix du compte ElevenLabs ("elevenlabs:<id>").
export async function VoiceOptions({ withDefault = false }: { withDefault?: boolean }) {
  const creds = await credentialStatus();
  const voices = await elevenVoices(!!creds.elevenlabs);
  return (
    <>
      {withDefault && <option value="">Voix du personnage</option>}
      <optgroup label="OpenAI">{VOICES.map((v) => <option key={v} value={v} disabled={!creds.openai}>{v}</option>)}</optgroup>
      <optgroup label={`Gemini${creds.google ? "" : " · clé à ajouter dans Réglages"}`}>{GEMINI_VOICES.map(([n, d]) => <option key={n} value={`${GEMINI_PREFIX}${n}`} disabled={!creds.google}>{n} · {d}</option>)}</optgroup>
      {voices.length > 0
        ? <optgroup label="ElevenLabs">{voices.map((v) => <option key={v.id} value={`${ELEVEN_PREFIX}${v.id}`}>{v.name}</option>)}</optgroup>
        : <option disabled>ElevenLabs · {creds.elevenlabs ? "aucune voix trouvée (vérifie la clé)" : "clé à ajouter dans Réglages"}</option>}
    </>
  );
}

// Listes « IA du script », « Voix off », « Visuels » et « IA des images » d'un formulaire de vidéo.
// Par défaut : les choix de Réglages ; une IA sans clé est grisée. Lu par readEngines (app/actions.ts).
export default async function EngineFields({ only = ["script", "voice", "visuals", "image"], scriptLabel = "IA du script" }: { only?: Field[]; scriptLabel?: string }) {
  const [s, creds] = await Promise.all([getSettings(), credentialStatus()]);
  const missing = (key: string) => !creds[key];
  const opt = (e: { id: string; label: string; key: string }, value = e.id, prefix = "") => (
    <option key={value} value={value} disabled={missing(e.key)}>{prefix}{e.label}{missing(e.key) ? " · clé à ajouter" : ""}</option>
  );
  return (
    <>
      {only.includes("script") && <div><label>{scriptLabel}</label><select name="engineScript" defaultValue={defaultScriptEngine(s)}>{SCRIPT_ENGINES.map((e) => opt(e))}</select></div>}
      {only.includes("voice") && <div><label>Voix off</label><select name="voice" defaultValue=""><VoiceOptions withDefault /></select></div>}
      {only.includes("visuals") && (
        <div><label>Visuels</label><select name="visuals" defaultValue="image">
          <option value="image">Photos avec zoom · les persos ne bougent pas (le moins cher)</option>
          <optgroup label="Vidéo animée · les persos bougent (payé à la seconde)">
            {s.videoModel && <option value="video" disabled={missing("replicate")}>{s.videoModel}</option>}
            {VIDEO_ENGINES.map((e) => opt(e, `video:${e.id}`))}
          </optgroup>
        </select></div>
      )}
      {only.includes("image") && <div><label>IA des images</label><select name="engineImage" defaultValue={defaultImageEngine(s)}>{IMAGE_ENGINES.map((e) => opt(e))}</select></div>}
    </>
  );
}
