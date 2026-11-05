import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import { projectDir } from "../storage";
import { normalize, probe, run, splitAudio } from "./ffmpeg";
import { transcribeFile, type Segment, type Word } from "../providers/stt";
import { chat, parseJsonLoose } from "../providers/llm";
import { buildCandidates, selectBest, wordsIn, type Scored } from "./candidates";
import { faceTrack, renderClip } from "./render";
import { getSettings } from "../settings";
import { makeCover } from "./cover";
import { scheduleAuto } from "../autopublish";

const stage = (id: string, s: string, progress: number) =>
  prisma.project.update({ where: { id }, data: { stage: s, progress, status: "processing" } });

// Pipeline complet d'un projet. Chaque étape vérifie si son résultat existe déjà :
// une reprise après échec repart de la dernière étape non terminée.
export async function processProject(projectId: string) {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { source: { include: { transcript: true } }, user: true } });
  const src = p.source!;
  const dir = projectDir(projectId);

  // 1. Import
  await stage(projectId, "import", 5);
  let original = src.originalPath;
  if (!original && src.kind === "url" && src.url) {
    original = path.join(dir, "original.mp4");
    await run("yt-dlp", ["-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4", "-o", original, src.url], { timeoutMs: 30 * 60_000 })
      .catch((e) => { throw new Error("Import par lien impossible (yt-dlp absent ou lien bloqué). Importez plutôt le fichier. " + e.message.slice(0, 200)); });
    await prisma.source.update({ where: { id: src.id }, data: { originalPath: original } });
  }
  if (!original || !fs.existsSync(original)) throw new Error("Fichier source introuvable");

  // 2. Normalisation + vérification des minutes disponibles
  await stage(projectId, "normalisation", 15);
  let { normalizedPath, audioPath } = src;
  if (!normalizedPath || !fs.existsSync(normalizedPath)) {
    const info = await probe(original);
    if (!info.hasAudio) throw new Error("La vidéo n'a pas de piste audio");
    await checkCredits(p.userId, p.user.role, info.duration / 60);
    normalizedPath = path.join(dir, "normalized.mp4");
    audioPath = path.join(dir, "audio.mp3");
    await normalize(original, normalizedPath, audioPath);
    const n = await probe(normalizedPath);
    await prisma.source.update({ where: { id: src.id }, data: { normalizedPath, audioPath, durationSec: n.duration, width: n.width, height: n.height, importState: "done" } });
    await prisma.creditLedger.create({ data: { userId: p.userId, minutes: -Math.ceil(n.duration / 60), reason: `Projet ${p.title}` } });
    src.durationSec = n.duration; src.width = n.width; src.height = n.height;
  }

  // 3. Transcription mot à mot (par morceaux de 20 min)
  await stage(projectId, "transcription", 30);
  let words: Word[], segments: Segment[];
  if (src.transcript) {
    words = JSON.parse(src.transcript.wordsJson); segments = JSON.parse(src.transcript.segmentsJson);
  } else {
    const chunkSec = 1200;
    const chunks: string[] = [];
    if ((src.durationSec ?? 0) > chunkSec) {
      await splitAudio(audioPath!, chunkSec, path.join(dir, "chunk_%03d.mp3"));
      chunks.push(...fs.readdirSync(dir).filter((f) => f.startsWith("chunk_")).sort().map((f) => path.join(dir, f)));
    } else chunks.push(audioPath!);
    words = []; segments = []; let text = "", lang: string | undefined;
    for (let i = 0; i < chunks.length; i++) {
      const d = (await probe(chunks[i])).duration;
      const r = await transcribeFile(chunks[i], { language: p.language, offset: i * chunkSec, userId: p.userId, minutes: d / 60 });
      words.push(...r.words); segments.push(...r.segments); text += " " + r.text; lang ??= r.language;
      await stage(projectId, "transcription", 30 + Math.round((20 * (i + 1)) / chunks.length));
    }
    await prisma.transcript.create({ data: { sourceId: src.id, language: lang, text: text.trim(), wordsJson: JSON.stringify(words), segmentsJson: JSON.stringify(segments) } });
  }
  if (!words.length) throw new Error("Aucune parole détectée dans la vidéo");

  // 4-6. Candidats, scoring LLM, sélection
  await stage(projectId, "analyse", 55);
  const existing = await prisma.clip.count({ where: { projectId } });
  if (!existing) {
    const cands = buildCandidates(segments, p.minClipSec, p.maxClipSec);
    if (!cands.length) cands.push({ id: 1, s: segments[0].s, e: Math.min(segments.at(-1)!.e, segments[0].s + p.maxClipSec), text: segments.map((g) => g.text).join(" ") });
    const scored: Scored[] = [];
    for (let i = 0; i < cands.length; i += 30) {
      const batch = cands.slice(i, i + 30);
      const out = await chat({
        userId: p.userId, purpose: "scoring", json: true, maxTokens: 3000,
        system: "Tu es un éditeur vidéo expert des formats courts (TikTok, Reels, Shorts). Tu notes des extraits de transcription pour savoir lesquels feront de bons clips viraux.",
        user: `Langue de la vidéo : ${p.language}. Pour chaque extrait, donne un score de 0 à 100 selon : accroche des 3 premières secondes, émotion ou surprise, compréhensible sans contexte, fin nette. Donne aussi un titre accrocheur court (max 60 caractères, dans la langue de la vidéo) et une raison en une phrase.
Réponds en JSON : {"clips":[{"id":1,"score":80,"title":"...","reason":"..."}]}

${batch.map((c) => `#${c.id} [${Math.round(c.e - c.s)}s] ${c.text.slice(0, 1200)}`).join("\n\n")}`,
      });
      const j = parseJsonLoose<{ clips: { id: number; score: number; title: string; reason: string }[] }>(out);
      for (const r of j.clips ?? []) {
        const c = batch.find((b) => b.id === Number(r.id));
        if (c) scored.push({ ...c, score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))), title: String(r.title ?? "").slice(0, 80), reason: String(r.reason ?? "") });
      }
    }
    const best = selectBest(scored, p.clipCount);
    await prisma.clip.createMany({ data: best.map((b) => ({ projectId, startSec: b.s, endSec: b.e, score: b.score, title: b.title, reason: b.reason, style: p.captionStyle })) });
  }

  // 7-9. Recadrage, sous-titres animés, export
  const clips = await prisma.clip.findMany({ where: { projectId, status: { in: ["pending", "failed", "rendering"] } }, orderBy: { startSec: "asc" } });
  const total = await prisma.clip.count({ where: { projectId } });
  let done = total - clips.length;
  for (const c of clips) {
    await stage(projectId, "rendu", 60 + Math.round((38 * done) / Math.max(1, total)));
    await renderOne(c.id, words);
    done++;
  }
  await prisma.project.update({ where: { id: projectId }, data: { status: "ready", stage: "terminé", progress: 100, error: null } });
  for (const c of await prisma.clip.findMany({ where: { projectId, status: "ready" } })) {
    const already = await prisma.publication.count({ where: { clipId: c.id } });
    if (!already) await scheduleAuto(p.userId, { clipId: c.id, caption: c.title });
  }
  // 10. Notification : visible dans l'appli (statut). Branchez Resend ici pour l'email.
}

export async function renderOne(clipId: string, words?: Word[]) {
  const c = await prisma.clip.findUniqueOrThrow({ where: { id: clipId }, include: { project: { include: { source: { include: { transcript: true } }, user: true } } } });
  const src = c.project.source!;
  words ??= JSON.parse(src.transcript!.wordsJson) as Word[];
  const clipWords: Word[] = c.captionOverride ? JSON.parse(c.captionOverride) : wordsIn(words, c.startSec, c.endSec);
  await prisma.clip.update({ where: { id: clipId }, data: { status: "rendering" } });
  const dir = projectDir(c.projectId);
  const outFile = path.join(dir, `clip_${c.id}.mp4`);
  const thumbFile = path.join(dir, `clip_${c.id}.jpg`);
  const settings = await getSettings();
  const watermark = c.project.user.role !== "admin" && c.project.user.plan === "free" && settings.freeMinutes > 0 ? "Essai gratuit" : undefined;
  const keyframes = c.project.cropMode === "center" && c.cropOffset === 0.5 ? await faceTrack(src.normalizedPath!, c.startSec, c.endSec) : [];
  try {
    await renderClip({
      src: src.normalizedPath!, srcW: src.width!, srcH: src.height!, s: c.startSec, e: c.endSec, words: clipWords, style: c.style, hook: c.title,
      cropMode: c.project.cropMode, cropOffset: c.cropOffset, keyframes, outFile, thumbFile, watermark,
    });
    const coverFile = path.join(dir, `clip_${c.id}_cover.jpg`);
    // Miniature tirée de la source (sans sous-titres incrustés), au même cadrage que le clip.
    const cw = Math.round((src.height! * 9) / 16 / 2) * 2;
    const x = Math.max(0, Math.min(src.width! - cw, Math.round((keyframes[0]?.x ?? c.cropOffset) * src.width! - cw / 2)));
    const vf = c.project.cropMode === "wide" || src.width! / src.height! < 0.7 ? "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" : `crop=${cw}:${src.height}:${x}:0,scale=1080:1920`;
    await makeCover(src.normalizedPath!, c.title, coverFile, { from: c.startSec, to: c.endSec, vf }).catch((e) => console.error("miniature", e.message));
    await prisma.clip.update({ where: { id: clipId }, data: { status: "ready", filePath: outFile, thumbPath: thumbFile, coverPath: fs.existsSync(coverFile) ? coverFile : null } });
  } catch (e) {
    await prisma.clip.update({ where: { id: clipId }, data: { status: "failed" } });
    throw e;
  }
}

async function checkCredits(userId: string, role: string, minutes: number) {
  if (role === "admin") return;
  const s = await getSettings();
  const agg = await prisma.creditLedger.aggregate({ where: { userId }, _sum: { minutes: true } });
  const left = (agg._sum.minutes ?? 0);
  if (left < Math.ceil(minutes)) throw new Error(`Minutes insuffisantes : ${left} disponibles, ${Math.ceil(minutes)} nécessaires (essai : ${s.freeMinutes} min).`);
}
