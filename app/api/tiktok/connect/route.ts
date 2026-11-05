import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { authorizeUrl } from "@/lib/providers/tiktok";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return Response.redirect(new URL("/connexion", req.url));
  const state = randomToken(16);
  (await cookies()).set("tt_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  try { return Response.redirect(await authorizeUrl(state)); }
  catch (e) { return new Response((e as Error).message, { status: 400 }); }
}
