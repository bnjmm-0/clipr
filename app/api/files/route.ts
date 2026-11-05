import fs from "node:fs";
import { Readable } from "node:stream";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeResolve } from "@/lib/storage";

export const runtime = "nodejs";

// Sert un fichier (clip, vignette, génération) à son propriétaire, avec prise en charge du Range pour la lecture vidéo.
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return new Response("Non connecté", { status: 401 });
  const q = new URL(req.url).searchParams;
  let file: string | null | undefined, name = "fichier";
  if (q.get("clip")) {
    const c = await prisma.clip.findFirst({ where: { id: q.get("clip")!, project: { userId: u.id } } });
    file = q.get("kind") === "thumb" ? c?.thumbPath : c?.filePath;
    name = `${(c?.title || "clip").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 60)}.${q.get("kind") === "thumb" ? "jpg" : "mp4"}`;
  } else if (q.get("gen")) {
    const g = await prisma.generation.findFirst({ where: { id: q.get("gen")!, userId: u.id } });
    file = g?.filePath; name = `generation.${g?.kind === "image" ? "png" : "mp4"}`;
  }
  if (!file) return new Response("Introuvable", { status: 404 });
  const path = safeResolve(file);
  if (!fs.existsSync(path)) return new Response("Introuvable", { status: 404 });
  const size = fs.statSync(path).size;
  const type = path.endsWith(".mp4") ? "video/mp4" : path.endsWith(".png") ? "image/png" : "image/jpeg";
  const headers: Record<string, string> = { "content-type": type, "accept-ranges": "bytes", "cache-control": "private, max-age=60" };
  if (q.get("dl")) headers["content-disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    return new Response(Readable.toWeb(fs.createReadStream(path, { start, end })) as ReadableStream, {
      status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(path)) as ReadableStream, { headers: { ...headers, "content-length": String(size) } });
}
