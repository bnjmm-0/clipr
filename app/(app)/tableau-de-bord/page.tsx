import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NewProject from "@/components/NewProject";

const STATUS: Record<string, [string, string]> = { ready: ["Prêt", "ok"], failed: ["Échec", "err"] };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const u = await requireUser();
  const { url } = await searchParams;
  const projects = await prisma.project.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { clips: { select: { id: true, status: true } } } });
  const credits = await prisma.creditLedger.aggregate({ where: { userId: u.id }, _sum: { minutes: true } });
  return (
    <div className="page">
      <div className="pagehead">
        <div><h1>Clips</h1><p>Importe une vidéo longue : Clipr garde les meilleurs passages et les rend en vertical avec sous-titres animés et miniature.</p></div>
        <span className="sp" />
        <span className="tag">{u.role === "admin" ? "Minutes illimitées (admin)" : `${Math.max(0, credits._sum.minutes ?? 0)} min restantes`}</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.9fr)", alignItems: "start", gap: 24 }}>
        <NewProject defaultUrl={url} />
        <div className="panel" style={{ padding: "8px 24px" }}>
          <h2 style={{ padding: "16px 0 8px" }}>Projets</h2>
          {projects.length === 0 && <p className="sec small" style={{ paddingBottom: 16 }}>Aucun projet pour l'instant.</p>}
          {projects.map((p) => {
            const [label, cls] = STATUS[p.status] ?? [`${p.stage} · ${p.progress} %`, "live"];
            return (
              <Link key={p.id} href={`/projets/${p.id}`} className="cliprow" style={{ height: 56 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}<span className="xs muted" style={{ display: "block" }}>{p.clips.filter((c) => c.status === "ready").length} clips · {p.createdAt.toLocaleDateString("fr-FR")}</span></span>
                <span className="tag"><span className={`dot ${cls}`} />{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
