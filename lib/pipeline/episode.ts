import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import { STORAGE_DIR } from "../storage";
import { probe, run, splitAudio } from "./ffmpeg";
import { chat, parseJsonLoose } from "../providers/llm";
import { speak } from "../providers/tts";
import { generateImage, generateVideo } from "../providers/media";
import { transcribeFile, type Word } from "../providers/stt";
import { renderClip } from "./render";
import { makeCover } from "./cover";
import { scheduleAuto } from "../autopublish";
import { getSettings } from "../settings";
import { scriptModel } from "../engines";
import { MOTION_RULES, SCRIPT_RULES, SERIES_RULES, VISUAL_RULES, referencePrompt, voiceDirection } from "../prompting";
import type { Character } from "@prisma/client";
import { optionsPrompt, parseOptions, secondsPerScene, styleOverride } from "../story-options";

// speaker : nom du personnage qui dit la réplique (format dialogue) ; motion : prompt de mouvement (plans vidéo).
export type Scene = { speaker?: string; narration: string; visual: string; motion?: string };
export type Script = { title: string; hook: string; summary: string; scenes: Scene[] };

export function episodeDir(id: string) {
  const d = path.join(STORAGE_DIR, "episodes", id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const stage = (id: string, s: string, progress: number) => prisma.episode.update({ where: { id }, data: { stage: s, progress, status: "processing" } });

// Nombre de scènes : une toutes les `perScene` secondes (rythme choisi dans les options, 6 s par défaut).
export function sceneCount(durationSec: number, perScene = 6) {
  return Math.max(3, Math.min(60, Math.round(durationSec / perScene)));
}

// Répartit les mots d'une narration sur sa durée, au prorata de leur longueur (sous-titres mot à mot sans coût de transcription).
export function timeWords(text: string, start: number, dur: number): Word[] {
  // En français, « ? », « ! », « : » ou « » » sont précédés d'une espace : on les recolle au mot d'avant
  // pour qu'ils ne s'affichent pas seuls en sous-titre.
  const ws = text.split(/\s+/).filter(Boolean).reduce<string[]>((a, w) => {
    if (a.length && /^[?!:;»…]+$/.test(w)) a[a.length - 1] += `\u00a0${w}`; else a.push(w);
    return a;
  }, []);
  const weight = ws.map((w) => w.length + 2);
  const total = weight.reduce((a, b) => a + b, 0) || 1;
  let t = start;
  return ws.map((w, i) => { const d = (weight[i] / total) * dur; const o = { w, s: t, e: t + d * 0.92 }; t += d; return o; });
}

async function sourceTranscript(ep: { id: string; sourceUrl: string | null; userId: string; language: string }) {
  const dir = episodeDir(ep.id);
  let src = fs.readdirSync(dir).find((f) => f.startsWith("source."));
  if (!src) {
    if (!ep.sourceUrl) throw new Error("Aucune vidéo à reprendre : importez un fichier ou un lien");
    await run("yt-dlp", ["-f", "ba/b", "-x", "--audio-format", "mp3", "-o", path.join(dir, "source.%(ext)s"), ep.sourceUrl], { timeoutMs: 20 * 60_000 })
      .catch((e) => { throw new Error("Lien inaccessible (yt-dlp absent ou bloqué). Importez plutôt le fichier. " + e.message.slice(0, 160)); });
    src = fs.readdirSync(dir).find((f) => f.startsWith("source."))!;
  }
  const audio = path.join(dir, "source_audio.mp3");
  if (!fs.existsSync(audio)) await run("ffmpeg", ["-y", "-v", "error", "-i", path.join(dir, src), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audio]);
  const { duration } = await probe(audio);
  const files = [audio];
  if (duration > 1200) { await splitAudio(audio, 1200, path.join(dir, "src_chunk_%03d.mp3")); files.splice(0, 1, ...fs.readdirSync(dir).filter((f) => f.startsWith("src_chunk_")).sort().map((f) => path.join(dir, f))); }
  let text = "";
  for (let i = 0; i < files.length; i++) {
    const d = (await probe(files[i])).duration;
    text += " " + (await transcribeFile(files[i], { language: ep.language, offset: i * 1200, userId: ep.userId, minutes: d / 60 })).text;
  }
  return { text: text.trim(), duration };
}

type EpisodeWithSeries = NonNullable<Awaited<ReturnType<typeof loadEpisode>>>;
const loadEpisode = (id: string) => prisma.episode.findUniqueOrThrow({ where: { id }, include: { series: { include: { character: true } } } });

// Distribution : les personnages choisis (castJson), sinon le personnage de la série ou de la vidéo.
export async function loadCast(ep: EpisodeWithSeries): Promise<Character[]> {
  const ids: string[] = ep.castJson ? JSON.parse(ep.castJson) : [ep.series?.characterId ?? ep.characterId].filter((x): x is string => !!x);
  const rows = await prisma.character.findMany({ where: { id: { in: ids }, userId: ep.userId } });
  return ids.map((id) => rows.find((r) => r.id === id)).filter((c): c is Character => !!c);
}

// Personnages présents dans une scène : celui qui parle et ceux nommés dans la description de l'image.
export function castIn(scene: Scene, cast: Character[]) {
  const text = `${scene.speaker ?? ""} ${scene.visual}`.toLowerCase();
  const present = cast.filter((c) => text.includes(c.name.toLowerCase()));
  return present.length || cast.length !== 1 ? present : cast;
}

// Fiche de référence d'un personnage (générée une fois, puis jointe à chaque image où il apparaît).
// Avec `variants` > 1 (créateur de personnages), plusieurs propositions : la première est retenue en attendant le choix.
export async function ensureCharacterRef(c: Character, userId: string, engine?: string | null, force = false, variants = 1) {
  if (!force && c.refImagePath && fs.existsSync(c.refImagePath)) return c.refImagePath;
  const dir = path.join(STORAGE_DIR, "characters");
  fs.mkdirSync(dir, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < Math.max(1, Math.min(4, variants)); i++) {
    const file = path.join(dir, variants > 1 ? `${c.id}_v${i}.png` : `${c.id}.png`);
    await generateImage(referencePrompt(c), file, userId, engine);
    files.push(file);
  }
  await prisma.character.update({ where: { id: c.id }, data: { refImagePath: files[0], variantsJson: files.length > 1 ? JSON.stringify(files) : null } });
  c.refImagePath = files[0];
  return files[0];
}

export async function writeScript(episodeId: string): Promise<Script> {
  const ep = await loadEpisode(episodeId);
  const cast = await loadCast(ep);
  const dialogue = ep.format === "dialogue" && cast.length > 0;
  const opts = parseOptions(ep.optionsJson);
  const n = sceneCount(ep.durationSec, secondsPerScene(opts));
  const words = Math.round(ep.durationSec * 2.4);
  let context = "";
  if (ep.series) {
    const prev = await prisma.episode.findMany({ where: { seriesId: ep.seriesId, number: { lt: ep.number }, scriptJson: { not: null } }, orderBy: { number: "desc" }, take: 6 });
    context += `\nSérie « ${ep.series.title} » : ${ep.series.premise}\nÉpisode n°${ep.number}.\n${SERIES_RULES}`;
    if (prev.length) context += `\nÉpisodes précédents (du plus récent au plus ancien) :\n${prev.map((p) => `- n°${p.number} « ${p.title} » : ${(JSON.parse(p.scriptJson!) as Script).summary}`).join("\n")}\nFais avancer l'histoire sans répéter ces épisodes.`;
  }
  if (ep.origin === "remix") {
    const t = await sourceTranscript(ep);
    context += `\nVIDÉO À REPRENDRE (transcription, ${Math.round(t.duration)} s) :\n${t.text.slice(0, 14000)}\nAnalyse sa structure (accroche, enchaînement, rythme, chute) et écris une version ORIGINALE qui reprend cette mécanique, avec tes propres phrases et les personnages ci-dessous. Ne recopie aucune phrase.`;
  }
  if (cast.length) context += `\nPersonnages (chacun a une image de référence qui fixe son apparence) :\n${cast.map((c) => `- ${c.name} : ${c.look}. Personnalité : ${c.personality || "à ta guise"}.`).join("\n")}`;
  const style = styleOverride(opts) ?? cast.find((c) => c.visualStyle)?.visualStyle;
  const video = ep.visualMode === "video";
  const sceneShape = `{${dialogue ? `"speaker":"nom exact du personnage qui parle, ou Narrateur",` : ""}"narration":"${dialogue ? "réplique dite par ce personnage" : "texte lu en voix off"}","visual":"..."${video ? ',"motion":"..."' : ""}}`;
  const out = await chat({
    userId: ep.userId, purpose: "script vidéo IA", json: true, maxTokens: Math.min(12000, 1500 + n * 220), ...scriptModel(ep.engineScript, await getSettings()),
    system: `Tu es scénariste et réalisateur de vidéos verticales courtes (TikTok, Reels, Shorts), spécialiste des mini-feuilletons de personnages IA (fruits, objets, animaux qui parlent).\n${SCRIPT_RULES}\n${VISUAL_RULES}${video ? `\n${MOTION_RULES}` : ""}`,
    user: `Langue des répliques : ${ep.language}. Durée visée : ${ep.durationSec} s, environ ${words} mots ${dialogue ? "de dialogue" : "de narration"} au total, en ${n} scènes.
Consigne : ${ep.brief}${context}${optionsPrompt(opts)}
${dialogue ? `Format DIALOGUE : chaque scène est une réplique d'un seul personnage, qui est au centre de l'image en train de parler ; alterne les personnages comme dans une scène de série ; "Narrateur" seulement si c'est indispensable.` : "Format NARRATION : une voix off raconte, les images montrent l'action."}
Dans "visual", nomme les personnages présents par leur nom exact${style ? ` ; style visuel : ${style}` : ""}.
JSON : {"title":"titre court","hook":"accroche affichée au début (max 8 mots)","summary":"résumé en 2 phrases pour la mémoire de la série","scenes":[${sceneShape}]}`,
  });
  const s = parseJsonLoose<Script>(out);
  if (!s.scenes?.length) throw new Error("Le script généré est vide");
  return s;
}

// Prompt d'image d'une scène : annonce les références jointes, puis la description écrite par le scénariste.
export function scenePrompt(sc: Scene, present: Character[]) {
  const refs = present.filter((c) => c.refImagePath);
  const lock = refs.length ? `Reference images: ${refs.map((c, i) => `image ${i + 1} = ${c.name}`).join(", ")}. Keep each character 100% identical to their reference image (shape, colors, face, outfit). ` : "";
  return `${lock}${sc.visual}. Vertical 9:16 composition, no text, no watermark.`;
}

export async function processEpisode(episodeId: string) {
  let ep = await loadEpisode(episodeId);
  const dir = episodeDir(ep.id);
  const cast = await loadCast(ep);

  // 1. Script (enregistré : une reprise après échec ne le régénère pas)
  await stage(ep.id, ep.origin === "remix" ? "analyse de la vidéo" : "script", 5);
  if (!ep.scriptJson) {
    const s = await writeScript(ep.id);
    ep = await prisma.episode.update({ where: { id: ep.id }, data: { scriptJson: JSON.stringify(s), title: s.title?.slice(0, 120) || ep.title }, include: { series: { include: { character: true } } } });
  }
  const script = JSON.parse(ep.scriptJson!) as Script;
  const n = script.scenes.length;

  // 2. Fiches des personnages, puis l'image de chaque scène (elle sert aussi d'image de départ aux plans vidéo)
  await stage(ep.id, "fiches des personnages", 8);
  for (const c of cast) await ensureCharacterRef(c, ep.userId, ep.engineImage);
  for (let i = 0; i < n; i++) {
    const img = path.join(dir, `img_${i}.png`);
    if (fs.existsSync(img)) continue;
    await stage(ep.id, `images ${i + 1}/${n}`, 10 + Math.round((35 * i) / n));
    const present = castIn(script.scenes[i], cast);
    await generateImage(scenePrompt(script.scenes[i], present), img, ep.userId, ep.engineImage, present.map((c) => c.refImagePath!).filter(Boolean));
  }

  // 3. Validation : on s'arrête avant la voix et la vidéo (la partie la plus chère) tant que le storyboard n'est pas validé.
  if (ep.review && !ep.approved) {
    await prisma.episode.update({ where: { id: ep.id }, data: { status: "review", stage: "à valider", progress: 45 } });
    return;
  }

  // 4. Voix (celle du personnage qui parle) et visuels, scène par scène
  const words: Word[] = [];
  const parts: string[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const sc = script.scenes[i];
    const voice = path.join(dir, `voice_${i}.mp3`);
    await stage(ep.id, `voix et animation ${i + 1}/${n}`, 45 + Math.round((40 * i) / n));
    const speaker = ep.format === "dialogue" ? cast.find((c) => c.name.toLowerCase() === (sc.speaker ?? "").toLowerCase()) : cast[0];
    const voiceId = ep.format === "dialogue" ? speaker?.voice ?? (ep.voice || "alloy") : ep.voice || speaker?.voice || "alloy";
    if (!fs.existsSync(voice)) await speak(sc.narration, voiceId, voice, ep.userId, voiceDirection(speaker));
    const dur = (await probe(voice)).duration + 0.12;
    words.push(...timeWords(sc.narration, t, dur - 0.12));
    const img = path.join(dir, `img_${i}.png`);
    const part = path.join(dir, `scene_${i}.mp4`);
    if (!fs.existsSync(part)) {
      if (ep.visualMode === "video") {
        const raw = path.join(dir, `raw_${i}.mp4`);
        const motion = sc.motion || `${sc.visual}. Slow push-in, the characters move naturally. Keep everything exactly as in the starting image. No text, no logo.`;
        if (!fs.existsSync(raw)) await generateVideo(motion, raw, ep.userId, ep.engineVideo, img, dur);
        await run("ffmpeg", ["-y", "-v", "error", "-stream_loop", "-1", "-i", raw, "-t", dur.toFixed(2), "-an",
          "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", part]);
      } else {
        const frames = Math.ceil(dur * 30);
        // Mouvement de caméra lent (zoom avant, zoom arrière ou travelling) qui change à chaque scène.
        const moves = [
          `z='min(1+0.10*on/${frames},1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
          `z='max(1.12-0.10*on/${frames},1.02)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
          `z='1.12':x='(iw-iw/zoom)*on/${frames}':y='ih/2-(ih/zoom/2)'`,
          `z='1.12':x='(iw-iw/zoom)*(1-on/${frames})':y='(ih-ih/zoom)*0.3'`,
        ];
        await run("ffmpeg", ["-y", "-v", "error", "-loop", "1", "-i", img, "-t", dur.toFixed(2),
          "-vf", `scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=${moves[i % moves.length]}:d=${frames}:s=1080x1920:fps=30,setsar=1`,
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", part]);
      }
    }
    // Voix collée à la scène, toujours au même format audio (48 kHz stéréo) : les voix d'OpenAI, de Gemini et
    // d'ElevenLabs n'ont pas la même fréquence, et le montage recolle les scènes sans réencoder le son.
    const av = path.join(dir, `av_${i}.mp4`);
    if (!fs.existsSync(av)) await run("ffmpeg", ["-y", "-v", "error", "-i", part, "-i", voice, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-af", "apad", "-t", dur.toFixed(2), av]);
    parts.push(av);
    t += dur;
  }

  // 5. Montage, sous-titres animés, titre d'accroche, barre de progression
  await stage(ep.id, "montage", 87);
  const list = path.join(dir, "concat.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const joined = path.join(dir, "joined.mp4");
  await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  const out = path.join(dir, "episode.mp4");
  const thumb = path.join(dir, "thumb.jpg");
  // Option « numéro d'épisode » : l'accroche affichée commence par « Épisode N ».
  const hook = parseOptions(ep.optionsJson).episodeLabel && ep.seriesId ? `Épisode ${ep.number} · ${script.hook}` : script.hook;
  await renderClip({ src: joined, srcW: 1080, srcH: 1920, s: 0, e: t, words, style: ep.captionStyle, hook, cropMode: "none", cropOffset: 0.5, keyframes: [], outFile: out, thumbFile: thumb });

  // 6. Miniature
  await stage(ep.id, "miniature", 95);
  const cover = path.join(dir, "cover.jpg");
  await makeCover(joined, script.hook || ep.title, cover).catch((e) => console.error("miniature", e.message));
  await prisma.episode.update({ where: { id: ep.id }, data: { status: "ready", stage: "terminé", progress: 100, filePath: out, thumbPath: thumb, coverPath: fs.existsSync(cover) ? cover : null, error: null } });
  await scheduleAuto(ep.userId, { episodeId: ep.id });
}
