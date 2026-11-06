import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import LineChart from "@/components/LineChart";
import Poller from "@/components/Poller";
import { refreshStats } from "@/app/actions";

const n = (x: number) => x.toLocaleString("fr-FR");
const LABEL: Record<string, string> = { tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube" };

export default async function Stats({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const u = await requireUser();
  if (!(await getSettings()).features.stats) return <div className="page"><p className="note">Fonction désactivée dans Réglages.</p></div>;
  const accounts = await prisma.socialAccount.findMany({ where: { userId: u.id } });
  const platform = (await searchParams).p ?? accounts[0]?.platform ?? "tiktok";
  const snaps = await prisma.accountSnapshot.findMany({ where: { userId: u.id, platform }, orderBy: { createdAt: "asc" }, take: 400 });
  const running = await prisma.job.count({ where: { type: "stats", state: { in: ["queued", "running"] }, payload: { contains: u.id } } });
  const last = snaps.at(-1);
  const weekAgo = [...snaps].reverse().find((s) => s.createdAt.getTime() <= Date.now() - 7 * 864e5) ?? snaps[0];
  const delta = (k: "followers" | "likes" | "videos" | "views") => (last && weekAgo && last !== weekAgo ? last[k] - weekAgo[k] : null);
  const top: { title: string; views: number; likes: number; date: string }[] = last ? JSON.parse(last.topJson) : [];
  const cards: [string, "followers" | "likes" | "videos" | "views"][] = [["Abonnés", "followers"], ["Vues des 20 dernières vidéos", "views"], ["J'aime", "likes"], ["Vidéos", "videos"]];
  return (
    <div className="page">
      <Poller active={running > 0} ms={4000} />
      <div className="pagehead">
        <div><h1>Statistiques</h1><p>Relevées toutes les 6 h sur les comptes connectés.</p></div>
        <span className="sp" />
        <div className="seg">{accounts.map((a) => <Link key={a.id} href={`?p=${a.platform}`} className={`btn sm ${a.platform === platform ? "" : "ghost"}`}>{LABEL[a.platform]}{a.displayName ? ` · ${a.displayName}` : ""}</Link>)}</div>
        {accounts.length > 0 && <form action={refreshStats}><button className="btn ghost sm" disabled={running > 0}>{running ? "Relevé en cours" : "Relever maintenant"}</button></form>}
      </div>
      {accounts.length === 0 ? <p className="note">Connecte un compte TikTok, une Page Facebook ou une chaîne YouTube dans <Link href="/comptes" style={{ textDecoration: "underline" }}>Comptes et publication</Link>.</p> : (
        <div className="stack-24">
          <div className="grid" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
            {cards.map(([label, key]) => {
              const d = delta(key);
              return (
                <div key={key} className="card stat">
                  <div className="xs muted">{label}</div>
                  <div className="v">{last ? n(last[key]) : "–"}</div>
                  <div className="d num">{d === null ? "Pas encore de comparaison" : `${d >= 0 ? "+" : ""}${n(d)} sur 7 jours`}</div>
                </div>
              );
            })}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
            <div className="panel"><h2 style={{ marginBottom: 16 }}>Abonnés</h2><LineChart points={snaps.map((s) => ({ t: s.createdAt, v: s.followers }))} /></div>
            <div className="panel" style={{ padding: "8px 24px" }}>
              <h2 style={{ padding: "16px 0 8px" }}>Meilleures vidéos</h2>
              {top.length === 0 && <p className="sec small" style={{ paddingBottom: 16 }}>Aucune vidéo relevée.</p>}
              {top.slice(0, 8).map((v, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <div className="row" style={{ flexWrap: "nowrap" }}><span className="small" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title || "Sans titre"}</span><span className="small num">{n(v.views)}</span></div>
                  <div className="growth" style={{ maxWidth: "none" }}><i style={{ width: `${(v.views / Math.max(1, top[0].views)) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
