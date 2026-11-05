import { cookies } from "next/headers";
import { currentUser } from "@/lib/auth";
import { exchangeCode } from "@/lib/providers/tiktok";

export async function GET(req: Request) {
  const u = await currentUser();
  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  if (!u || !q.get("code") || q.get("state") !== jar.get("tt_state")?.value) return new Response("Requête TikTok invalide", { status: 400 });
  jar.delete("tt_state");
  try { await exchangeCode(q.get("code")!, u.id); }
  catch (e) { return new Response((e as Error).message, { status: 400 }); }
  return Response.redirect(new URL("/coach?connecte=1", process.env.APP_URL ?? req.url));
}
