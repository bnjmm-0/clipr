import { platformLabel } from "@/lib/settings";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishTargets } from "@/lib/platforms";
import Poller from "@/components/Poller";
import PublishForm from "@/components/PublishForm";
import Icon from "@/components/Icon";
import fs from "node:fs";
import { approveEpisode, deleteEpisode, nextEpisode, redoSceneImage, retryEpisode, rewriteEpisode, updateScene } from "@/app/actions";
import { episodeDir, type Script } from "@/lib/pipeline/episode";
import { enginesSummary } from "@/lib/engines";
import { optionsSummary, parseOptions } from "@/lib/story-options";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const { id } = await params;
  const e = await prisma.episode.findFirst({ where: { id, userId: u.id }, include: { series: true, publications: true } });
  if (!e) notFound();
  const script = e.scriptJson ? (JSON.parse(e.scriptJson) as Script) : null;
  const busy = ["queued", "processing"].includes(e.status);
  const review = e.status === "review" || (busy && e.review && !e.approved);
  const hasImg = (i: number) => fs.existsSync(`${episodeDir(e.id)}/img_${i}.png`);
  const imgV = (i: number) => (hasImg(i) ? Math.round(fs.statSync(`${episodeDir(e.id)}/img_${i}.png`).mtimeMs) : 0);
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
                <span className="tag"><span className={`dot ${e.status === "failed" ? "err" : "live"}`} />{e.status === "failed" ? "Échec" : e.status === "uploading" ? "En attente du fichier" : e.status === "review" ? "À valider" : e.stage}</span>
                <div className="progress"><i style={{ transform: `scaleX(${e.progress / 100})` }} /></div>
              </div>
            </div>
          )}
          {e.coverPath && <img src={`/api/files?episode=${e.id}&kind=cover`} alt="Miniature" style={{ width: 120, borderRadius: 8 }} />}
        </div>
        <div className="stack-24">
          {e.error && <p className="alert">{e.error}</p>}
          {review && script && (
            <div className="panel">
              <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2>Storyboard à valider</h2>
                  <p className="sec small" style={{ marginTop: 6 }}>Relis chaque réplique et regarde chaque image. Corrige ou refais ce qui ne va pas : c'est gratuit comparé à la voix et à l'animation. Quand tout est bon, valide.</p>
                </div>
                {e.status === "review" && <form action={approveEpisode.bind(null, e.id)}><button className="btn accent">Valider et créer la vidéo</button></form>}
              </div>
              <div className="board">
                {script.scenes.map((sc, i) => (
                  <div key={i} className="raised shot">
                    {hasImg(i) ? <img src={`/api/files?episode=${e.id}&scene=${i}&v=${imgV(i)}`} alt={`Scène ${i + 1}`} /> : <span className="noimg">Image en cours…</span>}
                    <div className="row"><span className="xs muted num">Scène {i + 1}</span><span className="sp" />{sc.speaker && <span className="speaker">{sc.speaker}</span>}</div>
                    <form action={updateScene.bind(null, e.id, i)} className="stack-8">
                      <textarea name="narration" defaultValue={sc.narration} aria-label={`Réplique de la scène ${i + 1}`} disabled={e.status !== "review"} />
                      <details><summary className="xs muted" style={{ cursor: "pointer" }}>Description de l'image</summary><textarea name="visual" defaultValue={sc.visual} style={{ marginTop: 6 }} disabled={e.status !== "review"} /></details>
                      {e.status === "review" && <button className="btn ghost sm">Enregistrer</button>}
                    </form>
                    {e.status === "review" && <form action={redoSceneImage.bind(null, e.id, i)}><button className="btn quiet sm" style={{ width: "100%" }}>Refaire l'image</button></form>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {e.status === "ready" && <div className="panel"><h2>Publier</h2><PublishForm episodeId={e.id} caption={`${script?.hook ?? e.title} #ia`} platforms={platforms} />
            <p className="xs muted" style={{ marginTop: 12 }}>Vidéo générée par IA : indique-le lors de la publication.</p></div>}
          <div className="panel">
            <h2>Script</h2>
            <p className="xs muted" style={{ marginTop: 4 }}>{e.durationSec} s · {e.visualMode === "video" ? "plans vidéo IA" : "images animées"} · consigne : {e.brief.slice(0, 200)}</p>
            {enginesSummary(e) && <p className="xs muted" style={{ marginTop: 4 }}>IA utilisées : {enginesSummary(e)}</p>}
            {optionsSummary(parseOptions(e.optionsJson)) && <p className="xs muted" style={{ marginTop: 4 }}>Options : {optionsSummary(parseOptions(e.optionsJson))}</p>}
            {!script && <p className="sec small" style={{ marginTop: 12 }}>Le script apparaîtra ici dès qu'il est écrit.</p>}
            {script && !review && (
              <ol style={{ paddingLeft: 20, marginTop: 16 }} className="stack">
                {script.scenes.map((s, i) => <li key={i}><p>{s.speaker && <b style={{ color: "var(--accent)" }}>{s.speaker} : </b>}{s.narration}</p><p className="xs muted" style={{ marginTop: 4 }}>{s.visual}</p></li>)}
              </ol>
            )}
            {script && review && <p className="xs muted" style={{ marginTop: 12 }}>Le script se relit et se corrige dans le storyboard ci-dessus.</p>}
          </div>
          {e.publications.length > 0 && <div className="panel" style={{ padding: "8px 24px" }}><table><thead><tr><th>Plateforme</th><th>Prévue</th><th>État</th></tr></thead><tbody>
            {e.publications.map((p) => <tr key={p.id}><td>{platformLabel(p.platform)}{p.auto ? " · auto" : ""}</td><td className="num">{p.scheduledAt?.toLocaleString("fr-FR") ?? "immédiate"}</td><td>{p.state}{p.error ? ` · ${p.error}` : ""}</td></tr>)}
          </tbody></table></div>}
        </div>
      </div>
    </div>
  );
}
