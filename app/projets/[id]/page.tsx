import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { featureEnabled } from "@/lib/settings";
import { wordsIn } from "@/lib/pipeline/candidates";
import Poller from "@/components/Poller";
import ClipCard from "@/components/ClipCard";
import { deleteProject, retryProject } from "@/app/actions";

const STAGES = ["import", "normalisation", "transcription", "analyse", "rendu", "terminé"];

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const p = await prisma.project.findFirst({
    where: { id, userId: u.id },
    include: { clips: { orderBy: { score: "desc" }, include: { publications: true } }, source: { include: { transcript: true } } },
  });
  if (!p) notFound();
  const words = p.source?.transcript ? JSON.parse(p.source.transcript.wordsJson) : [];
  const busy = ["queued", "processing", "uploading"].includes(p.status) || p.clips.some((c) => ["pending", "rendering"].includes(c.status));
  const canPublish = await featureEnabled("tiktokPublish");
  const tt = await prisma.socialAccount.findFirst({ where: { userId: u.id, platform: "tiktok" } });
  const si = STAGES.indexOf(p.stage);
  const pubs = p.clips.flatMap((c) => c.publications.map((x) => ({ ...x, title: c.title })));
  return (
    <main className="wrap page">
      <Poller active={busy} />
      <div className="row"><h1>{p.title}</h1><span className="sp" />
        {p.status === "failed" && <form action={retryProject.bind(null, p.id)}><button className="btn sm">Relancer</button></form>}
        <form action={deleteProject.bind(null, p.id)}><button className="btn ghost sm">Supprimer</button></form>
      </div>
      {p.status !== "ready" && (
        <div className="card reveal" style={{ margin: "16px 0 24px" }}>
          <div className="row"><b>{p.status === "failed" ? "Le traitement a échoué" : p.status === "uploading" ? "En attente du fichier…" : "Traitement en cours"}</b><span className="sp" /><span className="muted small">{p.progress} %</span></div>
          <div className="progress" style={{ marginTop: 10 }}><i style={{ width: `${p.progress}%` }} /></div>
          <div className="steps">{STAGES.slice(0, 5).map((s, k) => <span key={s} className={`s ${k < si ? "done" : k === si && p.status !== "failed" ? "on" : ""}`}>{k < si ? "✓ " : ""}{s}</span>)}</div>
          {p.error && <p className="alert" style={{ marginTop: 12 }}>{p.error}</p>}
          <p className="small muted">Vous pouvez fermer cette page : le traitement continue en arrière-plan.</p>
        </div>
      )}
      <div className="grid g3" style={{ marginTop: 20 }}>
        {p.clips.map((c, i) => (
          <ClipCard key={c.id} i={i} canPublish={canPublish} tiktokConnected={!!tt}
            c={{ id: c.id, title: c.title, score: c.score, reason: c.reason, startSec: c.startSec, endSec: c.endSec, style: c.style, cropOffset: c.cropOffset, status: c.status,
              caption: (c.captionOverride ? JSON.parse(c.captionOverride) : wordsIn(words, c.startSec, c.endSec)).map((w: { w: string }) => w.w).join(" ") }} />
        ))}
      </div>
      {pubs.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}><h3>Publications TikTok</h3>
          <table><thead><tr><th>Clip</th><th>Prévue</th><th>État</th></tr></thead><tbody>
            {pubs.map((x) => <tr key={x.id}><td>{x.title}</td><td>{x.scheduledAt?.toLocaleString("fr-FR") ?? "immédiate"}</td><td>{x.state}{x.error ? ` — ${x.error}` : ""}</td></tr>)}
          </tbody></table></div>
      )}
    </main>
  );
}
