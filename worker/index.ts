// Worker : exécute les tâches lourdes en arrière-plan. Lancer avec `npm run worker`.
// File stockée dans la table jobs (PostgreSQL en prod) : pas besoin de Redis pour démarrer.
import path from "node:path";
import { prisma } from "../lib/db";
import { processProject, renderOne } from "../lib/pipeline/process";
import { generateImage, generateVideo } from "../lib/providers/media";
import { runTool } from "../lib/providers/tools";
import { publishVideo } from "../lib/providers/tiktok";
import { fbPublishReel } from "../lib/providers/facebook";
import { ytPublishShort } from "../lib/providers/youtube";
import { ensureCharacterRef, processEpisode } from "../lib/pipeline/episode";
import { refreshTrends, REFRESH_HOURS } from "../lib/trends";
import { snapshotUser } from "../lib/stats";
import { featureEnabled, getCredential } from "../lib/settings";
import { INSPIRATION_HOURS, analyzeInspiration, refreshInspiration } from "../lib/inspiration";
import { genDir } from "../lib/storage";
import { analyzeCharacter } from "../lib/character-import";

const MAX_ATTEMPTS = 3;

async function handle(job: { id: string; type: string; payload: string; projectId: string | null }) {
  const p = JSON.parse(job.payload);
  switch (job.type) {
    case "pipeline": return processProject(job.projectId!);
    case "render_clip": return renderOne(p.clipId);
    case "generate": {
      const g = await prisma.generation.findUniqueOrThrow({ where: { id: p.generationId } });
      await prisma.generation.update({ where: { id: g.id }, data: { status: "running" } });
      const base = path.join(genDir(), g.id);
      // Outil de Conseils IA (p.tool) : modèle et options dans la tâche ; sinon génération simple de Réglages.
      const out = p.tool ? await runTool(p.tool, p.input ?? {}, base, g.userId)
        : g.kind === "image" ? await generateImage(g.prompt, `${base}.png`, g.userId) : await generateVideo(g.prompt, `${base}.mp4`, g.userId);
      await prisma.generation.update({ where: { id: g.id }, data: { status: "ready", filePath: out } });
      return;
    }
    case "episode": return processEpisode(p.episodeId);
    case "character_ref": {
      const c = await prisma.character.findUnique({ where: { id: p.characterId } });
      if (c) await ensureCharacterRef(c, c.userId, p.engine, true, Number(p.variants) || 1);
      return;
    }
    case "character_analyze": await analyzeCharacter(p.characterId); return;
    case "trends": await refreshTrends(); return;
    case "inspiration": await refreshInspiration(); return;
    case "inspiration_analyze": await analyzeInspiration(p.videoId, p.userId); return;
    case "stats": await snapshotUser(p.userId); return;
    case "publish": {
      const pub = await prisma.publication.findUniqueOrThrow({ where: { id: p.publicationId }, include: { clip: { include: { project: true } }, episode: true } });
      if (pub.state === "sent" || pub.error === "Annulée") return;
      if (pub.clip?.status === "discarded") { await prisma.publication.update({ where: { id: pub.id }, data: { state: "failed", error: "Clip écarté : publication annulée" } }); return; }
      const userId = pub.clip?.project.userId ?? pub.episode?.userId ?? pub.userId!;
      const file = pub.clip?.filePath ?? pub.episode?.filePath;
      if (!file) throw new Error("Vidéo pas encore prête");
      const caption = pub.caption ?? pub.clip?.title ?? pub.episode?.title ?? "";
      await prisma.publication.update({ where: { id: pub.id }, data: { state: "sending" } });
      const id = pub.platform === "facebook" ? await fbPublishReel(userId, file, caption)
        : pub.platform === "youtube" ? await ytPublishShort(userId, file, caption, pub.privacy)
        : await publishVideo(userId, file, caption, p.privacy ?? pub.privacy);
      await prisma.publication.update({ where: { id: pub.id }, data: { state: "sent", externalId: id, error: null } });
      return;
    }
  }
}

async function onFail(job: { id: string; type: string; payload: string; projectId: string | null; attempts: number }, err: Error) {
  const final = job.attempts + 1 >= MAX_ATTEMPTS || /insuffisantes|absente|refusée|épuisé|Import par lien|pas de piste|non connecté|désactivée|Aucun modèle/.test(err.message);
  await prisma.job.update({
    where: { id: job.id },
    data: { state: final ? "failed" : "queued", error: err.message.slice(0, 2000), attempts: { increment: 1 }, runAfter: new Date(Date.now() + 30_000 * (job.attempts + 1)) },
  });
  if (!final) return;
  const p = JSON.parse(job.payload);
  if (job.type === "pipeline") await prisma.project.update({ where: { id: job.projectId! }, data: { status: "failed", error: err.message.slice(0, 1000) } });
  if (job.type === "generate") await prisma.generation.update({ where: { id: p.generationId }, data: { status: "failed", error: err.message.slice(0, 1000) } });
  if (job.type === "episode") await prisma.episode.update({ where: { id: p.episodeId }, data: { status: "failed", error: err.message.slice(0, 1000) } });
  if (job.type === "publish") await prisma.publication.update({ where: { id: p.publicationId }, data: { state: "failed", error: err.message.slice(0, 1000) } });
}

async function tick() {
  const job = await prisma.job.findFirst({ where: { state: "queued", runAfter: { lte: new Date() } }, orderBy: { createdAt: "asc" } });
  if (!job) return false;
  const claimed = await prisma.job.updateMany({ where: { id: job.id, state: "queued" }, data: { state: "running" } });
  if (!claimed.count) return true;
  console.log(`[worker] ${job.type} ${job.id}`);
  try {
    await handle(job);
    await prisma.job.update({ where: { id: job.id }, data: { state: "done", error: null } });
  } catch (e) {
    console.error(`[worker] échec ${job.id}:`, (e as Error).message);
    await onFail(job, e as Error);
  }
  return true;
}

// Tâches périodiques : tendances et statistiques toutes les 6 h.
let lastPeriodic = 0;
async function periodic() {
  if (Date.now() - lastPeriodic < 60_000) return;
  lastPeriodic = Date.now();
  const due = new Date(Date.now() - REFRESH_HOURS * 36e5);
  const pending = (type: string) => prisma.job.count({ where: { type, state: { in: ["queued", "running"] } } });
  if (await featureEnabled("trends")) {
    const last = await prisma.trendSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
    if ((!last || last.createdAt < due) && !(await pending("trends"))) await prisma.job.create({ data: { type: "trends" } });
  }
  // Inspiration (vidéos fruits IA qui marchent) : relevé YouTube toutes les 12 h si la clé YouTube est là.
  if ((await featureEnabled("aiVideos")) && (await getCredential("youtube").catch(() => null))) {
    const last = await prisma.inspirationVideo.findFirst({ orderBy: { fetchedAt: "desc" } });
    if ((!last || last.fetchedAt < new Date(Date.now() - INSPIRATION_HOURS * 36e5)) && !(await pending("inspiration"))) await prisma.job.create({ data: { type: "inspiration" } });
  }
  if (await featureEnabled("stats")) {
    const users = await prisma.socialAccount.findMany({ distinct: ["userId"], select: { userId: true } });
    for (const { userId } of users) {
      const last = await prisma.accountSnapshot.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
      const queued = await prisma.job.count({ where: { type: "stats", state: { in: ["queued", "running"] }, payload: { contains: userId } } });
      if ((!last || last.createdAt < due) && !queued) await prisma.job.create({ data: { type: "stats", payload: JSON.stringify({ userId }) } });
    }
  }
}

async function main() {
  // Au redémarrage, les tâches restées « running » sont remises en file.
  await prisma.job.updateMany({ where: { state: "running" }, data: { state: "queued" } });
  console.log("[worker] prêt");
  for (;;) {
    await periodic().catch((e) => console.error("[worker] tâches périodiques :", e.message));
    const worked = await tick().catch((e) => { console.error(e); return false; });
    if (!worked) await new Promise((r) => setTimeout(r, 2000));
  }
}
if (process.argv[1]?.includes("worker")) main();
