import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { projectDir } from "@/lib/storage";
import { enqueue } from "@/lib/jobs";

export const runtime = "nodejs";
const MAX_BYTES = 4 * 1024 ** 3; // 4 Go

// Envoi direct du fichier vidéo en flux (pas de chargement en mémoire).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new Response("Non connecté", { status: 401 });
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, userId: u.id }, include: { source: true } });
  if (!p?.source || p.source.kind !== "upload") return new Response("Projet introuvable", { status: 404 });
  if (!req.body) return new Response("Fichier manquant", { status: 400 });
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return new Response("Fichier trop gros (4 Go max)", { status: 413 });
  const ext = (path.extname(new URL(req.url).searchParams.get("name") || "") || ".mp4").replace(/[^.a-z0-9]/gi, "").slice(0, 6);
  const dest = path.join(projectDir(id), `original${ext}`);
  let total = 0;
  const src = Readable.fromWeb(req.body as never);
  src.on("data", (c: Buffer) => { total += c.length; if (total > MAX_BYTES) src.destroy(new Error("Trop gros")); });
  await pipeline(src, fs.createWriteStream(dest));
  await prisma.source.update({ where: { id: p.source.id }, data: { originalPath: dest } });
  await prisma.project.update({ where: { id }, data: { status: "queued" } });
  await enqueue("pipeline", {}, id);
  return Response.json({ ok: true });
}
