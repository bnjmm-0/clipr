import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishTargets } from "@/lib/platforms";
import Poller from "@/components/Poller";
import PublishForm from "@/components/PublishForm";
import Icon from "@/components/Icon";
import { deleteEpisode, nextEpisode, retryEpisode, rewriteEpisode } from "@/app/actions";
import type { Script } from "@/lib/pipeline/episode";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const e = await prisma.episode.findFirst({ where: { id, userId: u.id }, include: { series: true, publications: true } });
  if (!e) notFound();
  const script = e.scriptJson ? (JSON.parse(e.scriptJson) as Script) : null;
  const busy = ["queued", "processing"].includes(e.status);
  const platforms = await publishTargets(u.id);
  return (
    <div className="page">
      <Poller active={busy} ms={4000} />
      <div className="pagehead">
        <div><Link href={e.origin === "remix" ? "/reprendre" : "/videos-ia"} className="xs muted">{e.series ? `${e.series.title} · épisode ${e.number}` : e.origin === "remix" ? "Reprendre une vidéo" : "Vidéos IA"}</Link><h1 style={{ marginTop: 4 }}>{e.title}</h1></div>
        <span className="sp" />
        {e.status === "failed" && <form action={retryEpisode.bind(null, e.id)}><button className="btn sm">Reprendre où ça s'est arrêté</button></form>}
        {!busy && <form action={rewriteEpisode.bind(null, e.id)}><button className="btn ghost sm">Réécrire et refaire</button></form>}
        {e.series && e.status === "ready" && <form action={nextEpisode.bind(null, e.series.id)}><button className="btn sm">Épisode suivant</button></form>}
        <form action={deleteEpisode.bind(null, e.id)}><button className="btn danger sm">Supprimer</button></form>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "320px minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        <div className="stack">
          {e.status === "ready" ? (
            <>
              <video src={`/api/files?episode=${e.id}`} poster={`/api/files?episode=${e.id}&kind=${e.coverPath ? "cover" : "thumb"}`} controls playsInline style={{ width: "100%", aspectRatio: "9/16", borderRadius: 14, background: "#000" }} />
              <div className="row" style={{ gap: 8 }}>
                <a className="btn sm" href={`/api/files?episode=${e.id}&dl=1`}><Icon name="download" size={16} />MP4</a>
                {e.coverPath && <a className="btn ghost sm" href={`/api/files?episode=${e.id}&kind=cover&dl=1`}>Miniature</a>}
              </div>
            </>
          ) : (
            <div className="placeholder" style={{ borderRadius: 14 }}>
              <div style={{ width: "70%" }} className="stack">
                <span className="tag"><span className={`dot ${e.status === "failed" ? "err" : "live"}`} />{e.status === "failed" ? "Échec" : e.status === "uploading" ? "En attente du fichier" : e.stage}</span>
                <div className="progress"><i style={{ transform: `scaleX(${e.progress / 100})` }} /></div>
              </div>
            </div>
          )}
          {e.coverPath && <img src={`/api/files?episode=${e.id}&kind=cover`} alt="Miniature" style={{ width: 120, borderRadius: 8 }} />}
        </div>
        <div className="stack-24">
          {e.error && <p className="alert">{e.error}</p>}
          {e.status === "ready" && <div className="panel"><h2>Publier</h2><PublishForm episodeId={e.id} caption={`${script?.hook ?? e.title} #ia`} platforms={platforms} />
            <p className="xs muted" style={{ marginTop: 12 }}>Vidéo générée par IA : indique-le lors de la publication.</p></div>}
          <div className="panel">
            <h2>Script</h2>
            <p className="xs muted" style={{ marginTop: 4 }}>{e.durationSec} s · {e.visualMode === "video" ? "plans vidéo IA" : "images animées"} · consigne : {e.brief.slice(0, 200)}</p>
            {!script && <p className="sec small" style={{ marginTop: 12 }}>Le script apparaîtra ici dès qu'il est écrit.</p>}
            {script && (
              <ol style={{ paddingLeft: 20, marginTop: 16 }} className="stack">
                {script.scenes.map((s, i) => <li key={i}><p>{s.narration}</p><p className="xs muted" style={{ marginTop: 4 }}>{s.visual}</p></li>)}
              </ol>
            )}
          </div>
          {e.publications.length > 0 && <div className="panel" style={{ padding: "8px 24px" }}><table><thead><tr><th>Plateforme</th><th>Prévue</th><th>État</th></tr></thead><tbody>
            {e.publications.map((p) => <tr key={p.id}><td>{p.platform === "facebook" ? "Facebook" : "TikTok"}{p.auto ? " · auto" : ""}</td><td className="num">{p.scheduledAt?.toLocaleString("fr-FR") ?? "immédiate"}</td><td>{p.state}{p.error ? ` · ${p.error}` : ""}</td></tr>)}
          </tbody></table></div>}
        </div>
      </div>
    </div>
  );
}
