import { prisma } from "./db";
import type { StatVideo } from "./analytics";
import { accountSnapshot } from "./providers/tiktok";
import { fbSnapshot } from "./providers/facebook";
import { ytSnapshot } from "./providers/youtube";

// Relevé des statistiques de tous les comptes connectés d'un utilisateur (toutes les 6 h par le worker).
export async function snapshotUser(userId: string) {
  const accounts = await prisma.socialAccount.findMany({ where: { userId } });
  const errors: string[] = [];
  for (const a of accounts) {
    try {
      if (a.platform === "tiktok") {
        const s = await accountSnapshot(userId);
        const vids: StatVideo[] = (s.videos as Record<string, any>[]).map((v) => ({
          id: String(v.id ?? ""), title: v.title || v.video_description || "", date: v.create_time ? new Date(v.create_time * 1000).toISOString() : "", duration: Number(v.duration ?? 0),
          cover: v.cover_image_url ?? "", url: v.share_url ?? "",
          views: Number(v.view_count ?? 0), likes: Number(v.like_count ?? 0), comments: Number(v.comment_count ?? 0), shares: Number(v.share_count ?? 0),
        }));
        // Les 20 dernières vidéos sont gardées entières : la page calcule engagement, meilleur jour et vidéo star.
        await prisma.accountSnapshot.create({ data: { userId, platform: "tiktok", followers: Number(s.user?.follower_count ?? 0), likes: Number(s.user?.likes_count ?? 0), videos: Number(s.user?.video_count ?? 0), views: vids.reduce((x, v) => x + v.views, 0), topJson: JSON.stringify(vids) } });
        if (s.user?.avatar_url || s.user?.display_name) await prisma.socialAccount.update({ where: { id: a.id }, data: { avatarUrl: s.user.avatar_url ?? a.avatarUrl, displayName: s.user.display_name ?? a.displayName } });
      } else if (a.platform === "facebook") {
        const s = await fbSnapshot(userId);
        await prisma.accountSnapshot.create({ data: { userId, platform: "facebook", followers: s.followers, likes: s.likes, videos: s.videos, views: s.views, topJson: JSON.stringify(s.top) } });
      } else if (a.platform === "youtube") {
        const s = await ytSnapshot(userId);
        await prisma.accountSnapshot.create({ data: { userId, platform: "youtube", followers: s.followers, likes: s.likes, videos: s.videos, views: s.views, topJson: JSON.stringify(s.top) } });
      }
    } catch (e) { errors.push(`${a.platform} : ${(e as Error).message}`); }
  }
  return errors;
}
