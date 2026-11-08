import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import SideNav from "@/components/SideNav";
import Icon from "@/components/Icon";
import { logout } from "@/app/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const u = await requireUser();
  const f = (await getSettings()).features;
  const create = [
    f.clips && { href: "/tableau-de-bord", label: "Clips", icon: "clips" },
    f.aiVideos && { href: "/videos-ia", label: "Vidéos IA et séries", icon: "film" },
    f.aiVideos && { href: "/personnages", label: "Personnages", icon: "user" },
    f.aiVideos && { href: "/inspiration", label: "Inspiration fruits IA", icon: "layers" },
    f.remix && { href: "/reprendre", label: "Reprendre une vidéo", icon: "copy" },
    (f.textToImage || f.textToVideo) && { href: "/generer", label: "Images et vidéos", icon: "image" },
    { href: "/conseils-ia", label: "Conseils IA", icon: "spark" },
  ].filter(Boolean) as { href: string; label: string; icon: string }[];
  const grow = [
    f.trends && { href: "/tendances-du-moment", label: "Tendances", icon: "trend" },
    f.stats && { href: "/statistiques", label: "Statistiques", icon: "chart" },
    (f.tiktokPublish || f.facebookPublish || f.youtubePublish) && { href: "/comptes", label: "Comptes et publication", icon: "send" },
    f.tiktokCoach && { href: "/coach", label: "Coach TikTok", icon: "message" },
  ].filter(Boolean) as { href: string; label: string; icon: string }[];
  const admin = [
    { href: "/usage", label: "Usage", icon: "gauge" },
    ...(u.role === "admin" ? [{ href: "/reglages", label: "Réglages", icon: "settings" }] : []),
  ];
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="brand"><span className="mark"><i /></span>Clipr</Link>
        <SideNav groups={[{ title: "Créer", items: create }, { title: "Faire grandir", items: grow }, { title: "Compte", items: admin }]} />
        <div className="foot">
          <div className="xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
          <form action={logout}><button className="navlink" style={{ border: 0, background: "none", width: "100%", cursor: "pointer", marginTop: 8 }}><Icon name="logout" />Déconnexion</button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
