import { prisma } from "./db";
import { featureEnabled } from "./settings";
// Plateformes sur lesquelles l'utilisateur peut publier maintenant (compte connecté + fonction active).
export async function publishTargets(userId: string) {
  const acc = await prisma.socialAccount.findMany({ where: { userId } });
  const out: { id: string; label: string }[] = [];
  if (acc.some((a) => a.platform === "tiktok") && (await featureEnabled("tiktokPublish"))) out.push({ id: "tiktok", label: "TikTok" });
  const fb = acc.find((a) => a.platform === "facebook");
  if (fb && (await featureEnabled("facebookPublish"))) out.push({ id: "facebook", label: `Facebook · ${fb.displayName ?? "Page"}` });
  return out;
}
