import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";

const COOKIE = "cs_session";
const DAYS = 30;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + DAYS * 864e5);
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) await prisma.session.deleteMany({ where: { id: sha256(t) } });
  jar.delete(COOKIE);
}

export async function currentUser() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const s = await prisma.session.findUnique({ where: { id: sha256(t) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/connexion");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/tableau-de-bord");
  return u;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);
