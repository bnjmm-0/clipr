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

export type Script = { title: string; hook: string; summary: string; scenes: { narration: string; visual: string }[] };

export function episodeDir(id: string) {
  const d = path.join(STORAGE_DIR, "episodes", id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

const stage = (id: string, s: string, progress: number) => prisma.episode.update({ where: { id }, data: { stage: s, progress, status: "processing" } });

export function sceneCount(durationSec: number) {
  return Math.max(3, Math.min(60, Math.round(durationSec / 6)));
}

// Répartit les mots d'une narration sur sa durée, au prorata de leur longueur (sous-titres mot à mot sans coût de transcription).
export function timeWords(text: string, start: number, dur: number): Word[] {
  const ws = text.split(/\s+/).filter(Boolean);
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

export async function writeScript(episodeId: string): Promise<Script> {
  const ep = await prisma.episode.findUniqueOrThrow({ where: { id: episodeId }, include: { series: { include: { character: true } } } });
  const character = ep.series?.character ?? (ep.characterId ? await prisma.character.findUnique({ where: { id: ep.characterId } }) : null);
  const n = sceneCount(ep.durationSec);
  const words = Math.round(ep.durationSec * 2.4);
  let context = "";
  if (ep.series) {
    const prev = await prisma.episode.findMany({ where: { seriesId: ep.seriesId, number: { lt: ep.number }, scriptJson: { not: null } }, orderBy: { number: "desc" }, take: 6 });
    context += `\nSérie « ${ep.series.title} » : ${ep.series.premise}\nÉpisode n°${ep.number}.`;
    if (prev.length) context += `\nÉpisodes précédents (du plus récent au plus ancien) :\n${prev.map((p) => `- n°${p.number} « ${p.title} » : ${(JSON.parse(p.scriptJson!) as Script).summary}`).join("\n")}\nFais avancer l'histoire sans répéter ces épisodes.`;
  }
  if (ep.origin === "remix") {
    const t = await sourceTranscript(ep);
    context += `\nVIDÉO À REPRENDRE (transcription, ${Math.round(t.duration)} s) :\n${t.text.slice(0, 14000)}\nAnalyse sa structure (accroche, enchaînement, rythme, chute) et écris une version ORIGINALE qui reprend cette mécanique, avec tes propres phrases et le personnage ci-dessous. Ne recopie aucune phrase.`;
  }
  if (character) context += `\nPersonnage principal : ${character.name}. Apparence : ${character.look}. Personnalité : ${character.personality || "à ta guise"}.`;
  const out = await chat({
    userId: ep.userId, purpose: "script vidéo IA", json: true, maxTokens: Math.min(12000, 1500 + n * 160),
    system: "Tu es scénariste de vidéos verticales courtes (TikTok, Reels, Shorts). Accroche forte dans les 3 premières secondes, phrases courtes à l'oral, une idée par scène, chute nette.",
    user: `Langue : ${ep.language}. Durée visée : ${ep.durationSec} s, environ ${words} mots de narration au total, en ${n} scènes.
Consigne : ${ep.brief}${context}
Pour chaque scène : "narration" (texte lu en voix off) et "visual" (description en anglais d'une image verticale 9:16 pour un générateur d'images : sujet, action, cadrage, lumière${character ? `, et reprends toujours l'apparence exacte du personnage : ${character.look}` : ""}${character?.visualStyle ? `, style ${character.visualStyle}` : ""}). Pas de texte dans les images.
JSON : {"title":"titre court","hook":"accroche affichée au début (max 8 mots)","summary":"résumé en 2 phrases pour la mémoire de la série","scenes":[{"narration":"...","visual":"..."}]}`,
  });
  const s = parseJsonLoose<Script>(out);
  if (!s.scenes?.length) throw new Error("Le script généré est vide");
  return s;
}

export async function processEpisode(episodeId: string) {
  let ep = await prisma.episode.findUniqueOrThrow({ where: { id: episodeId }, include: { series: { include: { character: true } } } });
  const dir = episodeDir(ep.id);
  const character = ep.series?.character ?? (ep.characterId ? await prisma.character.findUnique({ where: { id: ep.characterId } }) : null);

  // 1. Script (enregistré : une reprise après échec ne le régénère pas)
  await stage(ep.id, ep.origin === "remix" ? "analyse de la vidéo" : "script", 5);
  if (!ep.scriptJson) {
    const s = await writeScript(ep.id);
    ep = await prisma.episode.update({ where: { id: ep.id }, data: { scriptJson: JSON.stringify(s), title: s.title?.slice(0, 120) || ep.title }, include: { series: { include: { character: true } } } });
  }
  const script = JSON.parse(ep.scriptJson!) as Script;
  const n = script.scenes.length;

  // 2. Voix off et 3. visuels, scène par scène
  const words: Word[] = [];
  const parts: string[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const sc = script.scenes[i];
    const voice = path.join(dir, `voice_${i}.mp3`);
    await stage(ep.id, `voix et visuels ${i + 1}/${n}`, 10 + Math.round((70 * i) / n));
    if (!fs.existsSync(voice)) await speak(sc.narration, character?.voice ?? "alloy", voice, ep.userId, "Ton dynamique de créateur de contenu, rythme soutenu.");
    const dur = (await probe(voice)).duration + 0.12;
    words.push(...timeWords(sc.narration, t, dur - 0.12));
    const part = path.join(dir, `scene_${i}.mp4`);
    if (!fs.existsSync(part)) {
      const prompt = `${sc.visual}. Vertical 9:16 composition, no text, no watermark.`;
      if (ep.visualMode === "video") {
        const raw = path.join(dir, `raw_${i}.mp4`);
        if (!fs.existsSync(raw)) await generateVideo(prompt, raw, ep.userId);
        await run("ffmpeg", ["-y", "-v", "error", "-stream_loop", "-1", "-i", raw, "-t", dur.toFixed(2), "-an",
          "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", part]);
      } else {
        const img = path.join(dir, `img_${i}.png`);
        if (!fs.existsSync(img)) await generateImage(prompt, img, ep.userId);
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
    // Voix collée à la scène
    const av = path.join(dir, `av_${i}.mp4`);
    if (!fs.existsSync(av)) await run("ffmpeg", ["-y", "-v", "error", "-i", part, "-i", voice, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-af", "apad", "-t", dur.toFixed(2), av]);
    parts.push(av);
    t += dur;
  }

  // 4. Montage, sous-titres animés, titre d'accroche, barre de progression
  await stage(ep.id, "montage", 85);
  const list = path.join(dir, "concat.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const joined = path.join(dir, "joined.mp4");
  await run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
  const out = path.join(dir, "episode.mp4");
  const thumb = path.join(dir, "thumb.jpg");
  await renderClip({ src: joined, srcW: 1080, srcH: 1920, s: 0, e: t, words, style: ep.captionStyle, hook: script.hook, cropMode: "none", cropOffset: 0.5, keyframes: [], outFile: out, thumbFile: thumb });

  // 5. Miniature
  await stage(ep.id, "miniature", 95);
  const cover = path.join(dir, "cover.jpg");
  await makeCover(joined, script.hook || ep.title, cover).catch((e) => console.error("miniature", e.message));
  await prisma.episode.update({ where: { id: ep.id }, data: { status: "ready", stage: "terminé", progress: 100, filePath: out, thumbPath: thumb, coverPath: fs.existsSync(cover) ? cover : null, error: null } });
  await scheduleAuto(ep.userId, { episodeId: ep.id });
}
