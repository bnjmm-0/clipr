import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/settings";
import CoachForm from "@/components/CoachForm";
import { disconnectTikTok } from "@/app/actions";

// Rendu Markdown minimal et sûr (texte échappé par React).
function Md({ text }: { text: string }) {
  return <div>{text.split("\n").map((l, i) => {
    if (l.startsWith("## ")) return <h3 key={i} style={{ marginTop: 18 }}>{l.slice(3)}</h3>;
    if (l.startsWith("# ")) return <h2 key={i}>{l.slice(2)}</h2>;
    if (/^\s*[-*] /.test(l)) return <li key={i} style={{ marginLeft: 18 }}>{l.replace(/^\s*[-*] /, "").replace(/\*\*/g, "")}</li>;
    return l.trim() ? <p key={i} style={{ margin: "6px 0" }}>{l.replace(/\*\*/g, "")}</p> : null;
  })}</div>;
}

export default async function Coach() {
  const u = await requireUser();
  if (!(await featureEnabled("tiktokCoach"))) return <main className="wrap page"><p className="note">Fonction désactivée dans Réglages.</p></main>;
  const tt = await prisma.socialAccount.findFirst({ where: { userId: u.id, platform: "tiktok" } });
  const reports = await prisma.coachReport.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <main className="wrap page">
      <h1 className="reveal">Coach TikTok</h1>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="card reveal">
            <h2>Compte TikTok</h2>
            {tt ? (
              <div className="row">{tt.avatarUrl && <img src={tt.avatarUrl} alt="" width={40} height={40} style={{ borderRadius: 99 }} />}<b>{tt.displayName ?? "Compte connecté"}</b><span className="sp" />
                <form action={disconnectTikTok}><button className="btn ghost sm">Déconnecter</button></form></div>
            ) : (<><p className="small muted">Connexion via l'app développeur TikTok configurée dans Réglages.</p><a className="btn" href="/api/tiktok/connect">Connecter TikTok</a></>)}
          </div>
          <CoachForm connected={!!tt} />
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          {reports.length === 0 && <div className="card muted">Vos rapports apparaîtront ici.</div>}
          {reports.map((r, i) => <div key={r.id} className="card reveal" style={{ animationDelay: `${i * 0.06}s` }}><div className="small muted">{r.createdAt.toLocaleString("fr-FR")}</div><Md text={r.output} /></div>)}
        </div>
      </div>
    </main>
  );
}
