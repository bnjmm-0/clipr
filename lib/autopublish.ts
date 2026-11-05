import { prisma } from "./db";
import { enqueue } from "./jobs";
import { featureEnabled } from "./settings";

export type AutoPublish = { enabled: boolean; platforms: string[]; times: string[]; clips: boolean; episodes: boolean; privacy: string };

export function parseAuto(json: string): AutoPublish {
  const a = JSON.parse(json || "{}");
  return { enabled: !!a.enabled, platforms: a.platforms ?? ["tiktok"], times: (a.times ?? []).filter((t: string) => /^\d{2}:\d{2}$/.test(t)).sort(), clips: !!a.clips, episodes: a.episodes !== false, privacy: a.privacy ?? "SELF_ONLY" };
}

// Prochain créneau libre (heure locale du serveur) qui n'est pas déjà pris par une publication automatique.
export function nextSlot(times: string[], taken: Date[], from = new Date()): Date | null {
  if (!times.length) return null;
  const used = new Set(taken.map((d) => d.getTime()));
  for (let day = 0; day < 60; day++) {
    for (const t of times) {
      const [h, m] = t.split(":").map(Number);
      const d = new Date(from); d.setDate(d.getDate() + day); d.setHours(h, m, 0, 0);
      if (d.getTime() > from.getTime() + 60_000 && !used.has(d.getTime())) return d;
    }
  }
  return null;
}

// Appelé quand un clip ou un épisode est prêt : le place sur le prochain créneau de chaque plateforme connectée.
export async function scheduleAuto(userId: string, item: { clipId?: string; episodeId?: string; caption?: string }) {
  if (!(await featureEnabled("autoPublish"))) return [];
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { social: true } });
  const a = parseAuto(u.autoPublishJson);
  if (!a.enabled || (item.clipId && !a.clips) || (item.episodeId && !a.episodes)) return [];
  const created = [];
  for (const platform of a.platforms) {
    if (!u.social.some((s) => s.platform === platform)) continue;
    if (!(await featureEnabled(platform === "facebook" ? "facebookPublish" : "tiktokPublish"))) continue;
    const taken = await prisma.publication.findMany({ where: { userId, platform, auto: true, state: { in: ["scheduled", "sending"] } }, select: { scheduledAt: true } });
    const when = nextSlot(a.times, taken.map((t) => t.scheduledAt!).filter(Boolean));
    if (!when) continue;
    const pub = await prisma.publication.create({ data: { userId, platform, clipId: item.clipId, episodeId: item.episodeId, caption: item.caption, privacy: a.privacy, auto: true, scheduledAt: when } });
    await enqueue("publish", { publicationId: pub.id }, undefined, when);
    created.push(pub);
  }
  return created;
}
