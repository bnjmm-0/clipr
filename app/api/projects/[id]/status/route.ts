import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return new Response("Non connecté", { status: 401 });
  const { id } = await params;
  const p = await prisma.project.findFirst({ where: { id, userId: u.id }, select: { status: true, stage: true, progress: true, error: true, clips: { select: { status: true } } } });
  if (!p) return new Response("Introuvable", { status: 404 });
  return Response.json(p);
}
