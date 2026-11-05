import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { episodeDir } from "@/lib/pipeline/episode";
import { enqueue } from "@/lib/jobs";

export const runtime = "nodejs";

// Fichier source d'une vidéo à reprendre, envoyé en flux.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new Response("Non connecté", { status: 401 });
  const { id } = await params;
  const ep = await prisma.episode.findFirst({ where: { id, userId: u.id, origin: "remix" } });
  if (!ep || !req.body) return new Response("Introuvable", { status: 404 });
  const ext = (path.extname(new URL(req.url).searchParams.get("name") || "") || ".mp4").replace(/[^.a-z0-9]/gi, "").slice(0, 6);
  await pipeline(Readable.fromWeb(req.body as never), fs.createWriteStream(path.join(episodeDir(id), `source${ext}`)));
  await prisma.episode.update({ where: { id }, data: { status: "queued" } });
  await enqueue("episode", { episodeId: id });
  return Response.json({ ok: true });
}
