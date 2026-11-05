import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NewProject from "@/components/NewProject";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const u = await requireUser();
  const { url } = await searchParams;
  const projects = await prisma.project.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { clips: { select: { id: true, status: true } } } });
  const credits = await prisma.creditLedger.aggregate({ where: { userId: u.id }, _sum: { minutes: true } });
  return (
    <main className="wrap page">
      <div className="row" style={{ marginBottom: 20 }}>
        <h1>Mes projets</h1><span className="sp" />
        <span className="pill">{u.role === "admin" ? "Minutes illimitées (admin)" : `${Math.max(0, credits._sum.minutes ?? 0)} min restantes`}</span>
      </div>
      <div className="grid g2">
        <NewProject defaultUrl={url} />
        <div className="grid" style={{ alignContent: "start" }}>
          {projects.length === 0 && <div className="card muted">Aucun projet pour l'instant.</div>}
          {projects.map((p, i) => (
            <Link key={p.id} href={`/projets/${p.id}`} className="card feature reveal" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="row"><b>{p.title}</b><span className="sp" />
                <span className={`pill ${p.status === "ready" ? "ok" : p.status === "failed" ? "err" : "run"}`}>{p.status === "ready" ? "Prêt" : p.status === "failed" ? "Échec" : `${p.stage} · ${p.progress} %`}</span>
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>{p.clips.filter((c) => c.status === "ready").length} clips · {p.createdAt.toLocaleDateString("fr-FR")}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
