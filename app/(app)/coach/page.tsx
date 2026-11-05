import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/settings";
import CoachForm from "@/components/CoachForm";

// Rendu Markdown minimal et sûr (le texte est échappé par React).
function Md({ text }: { text: string }) {
  return <div className="stack-8">{text.split("\n").map((l, i) => {
    const clean = l.replace(/\*\*/g, "");
    if (l.startsWith("## ")) return <h3 key={i} style={{ marginTop: 16 }}>{clean.slice(3)}</h3>;
    if (l.startsWith("# ")) return <h2 key={i}>{clean.slice(2)}</h2>;
    if (/^\s*[-*] /.test(l)) return <p key={i} className="small" style={{ paddingLeft: 16 }}>· {clean.replace(/^\s*[-*] /, "")}</p>;
    return l.trim() ? <p key={i} className="small sec">{clean}</p> : null;
  })}</div>;
}

export default async function Coach() {
  const u = await requireUser();
  if (!(await featureEnabled("tiktokCoach"))) return <div className="page"><p className="note">Fonction désactivée dans Réglages.</p></div>;
  const tt = await prisma.socialAccount.findFirst({ where: { userId: u.id, platform: "tiktok" } });
  const reports = await prisma.coachReport.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Coach TikTok</h1><p>Diagnostic de tes vidéos, planning de la semaine et trois scripts prêts à tourner.{tt ? ` Compte analysé : ${tt.displayName ?? "TikTok"}.` : ""}</p></div>
        <span className="sp" />{!tt && <Link href="/comptes" className="btn ghost sm">Connecter TikTok</Link>}</div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,.8fr) minmax(0,1.2fr)", gap: 24, alignItems: "start" }}>
        <CoachForm connected={!!tt} />
        <div className="stack-24">
          {reports.length === 0 && <div className="panel sec small">Tes rapports apparaîtront ici.</div>}
          {reports.map((r) => <div key={r.id} className="panel"><div className="xs muted num">{r.createdAt.toLocaleString("fr-FR")}</div><Md text={r.output} /></div>)}
        </div>
      </div>
    </div>
  );
}
