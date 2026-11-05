// Worker : exécute les tâches lourdes en arrière-plan. Lancer avec `npm run worker`.
// File stockée dans la table jobs (PostgreSQL en prod) : pas besoin de Redis pour démarrer.
import path from "node:path";
import { prisma } from "../lib/db";
import { processProject, renderOne } from "../lib/pipeline/process";
import { generateImage, generateVideo } from "../lib/providers/media";
import { publishVideo } from "../lib/providers/tiktok";
import { genDir } from "../lib/storage";

const MAX_ATTEMPTS = 3;

async function handle(job: { id: string; type: string; payload: string; projectId: string | null }) {
  const p = JSON.parse(job.payload);
  switch (job.type) {
    case "pipeline": return processProject(job.projectId!);
    case "render_clip": return renderOne(p.clipId);
    case "generate": {
      const g = await prisma.generation.findUniqueOrThrow({ where: { id: p.generationId } });
      await prisma.generation.update({ where: { id: g.id }, data: { status: "running" } });
      const out = path.join(genDir(), `${g.id}.${g.kind === "image" ? "png" : "mp4"}`);
      await (g.kind === "image" ? generateImage(g.prompt, out, g.userId) : generateVideo(g.prompt, out, g.userId));
      await prisma.generation.update({ where: { id: g.id }, data: { status: "ready", filePath: out } });
      return;
    }
    case "publish": {
      const pub = await prisma.publication.findUniqueOrThrow({ where: { id: p.publicationId }, include: { clip: { include: { project: true } } } });
      await prisma.publication.update({ where: { id: pub.id }, data: { state: "sending" } });
      const id = await publishVideo(pub.clip.project.userId, pub.clip.filePath!, pub.caption ?? pub.clip.title, p.privacy);
      await prisma.publication.update({ where: { id: pub.id }, data: { state: "sent", externalId: id } });
      return;
    }
  }
}

async function onFail(job: { id: string; type: string; payload: string; projectId: string | null; attempts: number }, err: Error) {
  const final = job.attempts + 1 >= MAX_ATTEMPTS || /insuffisantes|absente|Import par lien|pas de piste/.test(err.message);
  await prisma.job.update({
    where: { id: job.id },
    data: { state: final ? "failed" : "queued", error: err.message.slice(0, 2000), attempts: { increment: 1 }, runAfter: new Date(Date.now() + 30_000 * (job.attempts + 1)) },
  });
  if (!final) return;
  const p = JSON.parse(job.payload);
  if (job.type === "pipeline") await prisma.project.update({ where: { id: job.projectId! }, data: { status: "failed", error: err.message.slice(0, 1000) } });
  if (job.type === "generate") await prisma.generation.update({ where: { id: p.generationId }, data: { status: "failed", error: err.message.slice(0, 1000) } });
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

async function main() {
  // Au redémarrage, les tâches restées « running » sont remises en file.
  await prisma.job.updateMany({ where: { state: "running" }, data: { state: "queued" } });
  console.log("[worker] prêt");
  for (;;) {
    const worked = await tick().catch((e) => { console.error(e); return false; });
    if (!worked) await new Promise((r) => setTimeout(r, 2000));
  }
}
if (process.argv[1]?.includes("worker")) main();
