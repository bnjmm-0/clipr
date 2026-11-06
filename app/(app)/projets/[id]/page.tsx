import { platformLabel } from "@/lib/settings";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { wordsIn } from "@/lib/pipeline/candidates";
import { publishTargets } from "@/lib/platforms";
import Poller from "@/components/Poller";
import ClipCard from "@/components/ClipCard";
import { deleteProject, retryProject } from "@/app/actions";

const STAGES = ["import", "normalisation", "transcription", "analyse", "rendu"];

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
  const platforms = await publishTargets(u.id);
  const si = STAGES.indexOf(p.stage);
  const pubs = p.clips.flatMap((c) => c.publications.map((x) => ({ ...x, title: c.title })));
  return (
    <div className="page">
      <Poller active={busy} />
      <div className="pagehead">
        <div><Link href="/tableau-de-bord" className="xs muted">Clips</Link><h1 style={{ marginTop: 4 }}>{p.title}</h1></div>
        <span className="sp" />
        {p.status === "failed" && <form action={retryProject.bind(null, p.id)}><button className="btn sm">Relancer</button></form>}
        <form action={deleteProject.bind(null, p.id)}><button className="btn danger sm">Supprimer</button></form>
      </div>
      {p.status !== "ready" && (
        <div className="panel" style={{ marginBottom: 24, maxWidth: 720 }}>
          <div className="row"><h2>{p.status === "failed" ? "Le traitement a échoué" : p.status === "uploading" ? "En attente du fichier" : "Traitement en cours"}</h2><span className="sp" /><span className="sec num">{p.progress} %</span></div>
          <div className="progress" style={{ marginTop: 16 }}><i style={{ transform: `scaleX(${p.progress / 100})` }} /></div>
          <div className="steps">{STAGES.map((s, k) => <span key={s} className="tag"><span className={`dot ${k < si ? "ok" : k === si && p.status !== "failed" ? "live" : ""}`} />{s}</span>)}</div>
          {p.error && <p className="alert">{p.error}</p>}
          <p className="xs muted" style={{ marginTop: 16 }}>Tu peux fermer cette page, le traitement continue.</p>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
        {p.clips.map((c) => (
          <ClipCard key={c.id} platforms={platforms}
            c={{ id: c.id, title: c.title, score: c.score, reason: c.reason, startSec: c.startSec, endSec: c.endSec, style: c.style, cropOffset: c.cropOffset, status: c.status, hasCover: !!c.coverPath,
              caption: (c.captionOverride ? JSON.parse(c.captionOverride) : wordsIn(words, c.startSec, c.endSec)).map((w: { w: string }) => w.w).join(" ") }} />
        ))}
      </div>
      {pubs.length > 0 && (
        <div className="panel" style={{ marginTop: 32 }}><h2 style={{ marginBottom: 8 }}>Publications</h2>
          <table><thead><tr><th>Clip</th><th>Plateforme</th><th>Prévue</th><th>État</th></tr></thead><tbody>
            {pubs.map((x) => <tr key={x.id}><td>{x.title}</td><td>{platformLabel(x.platform)}</td><td className="num">{x.scheduledAt?.toLocaleString("fr-FR") ?? "immédiate"}</td><td>{x.state}{x.error ? ` · ${x.error}` : ""}</td></tr>)}
          </tbody></table></div>
      )}
    </div>
  );
}
