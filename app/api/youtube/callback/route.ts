import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { ytExchangeCode } from "@/lib/providers/youtube";

export async function GET(req: Request) {
  const u = await currentUser();
  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  if (q.get("error")) return Response.redirect(new URL("/comptes", process.env.APP_URL ?? req.url));
  if (!u || !q.get("code") || q.get("state") !== jar.get("yt_state")?.value) return new Response("Requête YouTube invalide", { status: 400 });
  jar.delete("yt_state");
  try { await ytExchangeCode(q.get("code")!, u.id); }
  catch (e) { return new Response((e as Error).message, { status: 400 }); }
  return Response.redirect(new URL("/comptes", process.env.APP_URL ?? req.url));
}
