import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { fbExchangeCode } from "@/lib/providers/facebook";

export async function GET(req: Request) {
  const u = await currentUser();
  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  if (!u || !q.get("code") || q.get("state") !== jar.get("fb_state")?.value) return new Response("Requête Facebook invalide", { status: 400 });
  jar.delete("fb_state");
  try { await fbExchangeCode(q.get("code")!, u.id); }
  catch (e) { return new Response((e as Error).message, { status: 400 }); }
  return Response.redirect(new URL("/comptes", process.env.APP_URL ?? req.url));
}
