import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Poller from "@/components/Poller";
import { analyzeInspirationVideo, remakeFromInspiration } from "@/app/actions";
import { overSubs, viewsPerDay, type Analysis } from "@/lib/inspiration";
import { optionsSummary } from "@/lib/story-options";
import { fmt } from "@/lib/analytics";

export default async function InspirationVideo({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const v = await prisma.inspirationVideo.findUnique({ where: { id } });
  if (!v) notFound();
  const job = await prisma.job.findFirst({ where: { type: "inspiration_analyze", payload: { contains: id } }, orderBy: { createdAt: "desc" } });
  const busy = !!job && ["queued", "running"].includes(job.state);
  const a = v.analysisJson ? (JSON.parse(v.analysisJson) as Analysis) : null;
  const r = overSubs(v);
  const stats: [string, string][] = [["Vues", fmt(v.views)], ["Vues par jour", fmt(viewsPerDay(v))], ["J'aime", fmt(v.likes)], ["Commentaires", fmt(v.comments)],
    ["Abonnés de la chaîne", fmt(v.channelSubs)], ["Surperformance", `×${r.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`], ["Durée", `${v.durationSec} s`]];
  return (
    <div className="page">
      <Poller active={busy} ms={4000} />
      <div className="pagehead">
        <div><Link href="/inspiration" className="xs muted">Inspiration fruits IA</Link><h1 style={{ marginTop: 4 }}>{v.title}</h1><p>{v.channel} · publiée le {v.publishedAt.toLocaleDateString("fr-FR")}</p></div>
      </div>
      <div className="grid inspdetail">
        <div className="stack">
          <div className="inspplayer"><iframe src={`https://www.youtube-nocookie.com/embed/${v.id}`} title={v.title} allow="encrypted-media; picture-in-picture" allowFullScreen /></div>
          <div className="panel" style={{ padding: "8px 16px" }}>
            {stats.map(([l, x]) => <div key={l} className="row inspstat"><span className="xs muted">{l}</span><span className="sp" /><b className="num">{x}</b></div>)}
          </div>
          <a className="btn ghost sm" href={`https://www.youtube.com/shorts/${v.id}`} target="_blank" rel="noreferrer">Voir sur YouTube</a>
        </div>

        <div className="stack-24">
          {!a && (
            <div className="panel">
              <h2>Comment elle a été faite</h2>
              <p className="sec small" style={{ marginTop: 8 }}>Clipr récupère les paroles (sous-titres automatiques) et 4 images de la vidéo, puis ton IA de texte décortique : l'accroche, la structure plan par plan, les personnages, le style, la voix, le montage, les outils probables et pourquoi elle marche. Coût : quelques centimes sur ta clé IA.</p>
              {job?.state === "failed" && <p className="alert">{job.error}</p>}
              <form action={analyzeInspirationVideo.bind(null, v.id)} style={{ marginTop: 16 }}><button className="btn accent" disabled={busy}>{busy ? "Analyse en cours… (environ une minute)" : "Analyser cette vidéo"}</button></form>
            </div>
          )}
          {a && (
            <>
              <div className="panel">
                <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}><h2>Comment elle a été faite</h2><p className="sec" style={{ marginTop: 8 }}>{a.resume}</p></div>
                  <form action={remakeFromInspiration.bind(null, v.id)}><button className="btn accent">Refaire dans Clipr</button></form>
                </div>
                <div className="inspfacts">
                  <div><span className="xs muted">Format</span><p>{a.format}</p></div>
                  <div><span className="xs muted">Accroche (2 premières secondes)</span><p>{a.accroche}</p></div>
                  <div><span className="xs muted">Style visuel</span><p>{a.style}</p></div>
                  <div><span className="xs muted">Voix</span><p>{a.voix}</p></div>
                  <div><span className="xs muted">Montage</span><p>{a.montage}</p></div>
                  <div><span className="xs muted">Outils probables</span><p>{a.outils}</p></div>
                </div>
              </div>
              {a.structure?.length > 0 && (
                <div className="panel"><h2>Plan par plan</h2>
                  <ol className="inspsteps">{a.structure.map((s, i) => <li key={i}><b className="num">{s.moment}</b><span>{s.quoi}</span></li>)}</ol></div>
              )}
              {a.pourquoi?.length > 0 && <div className="panel insights"><h2>Pourquoi elle marche</h2><ul>{a.pourquoi.map((p, i) => <li key={i}><span className="ic">✓</span><span>{p}</span></li>)}</ul></div>}
              {a.personnages?.length > 0 && (
                <div className="panel"><h2>Personnages</h2>
                  <div className="inspchars">{a.personnages.map((c, i) => <div key={i} className="raised" style={{ padding: 12 }}><h3>{c.nom}</h3><p className="xs sec" style={{ marginTop: 4 }}>{c.apparence}</p><p className="xs muted" style={{ marginTop: 4 }}>{c.personnalite}</p></div>)}</div></div>
              )}
              <div className="panel">
                <h2>Ta version originale</h2>
                <p className="sec small" style={{ marginTop: 8 }}>Même mécanique, autres personnages ou autre intrigue : on s'inspire, on ne copie pas.</p>
                <p style={{ marginTop: 12 }}>{a.recette.brief}</p>
                <p className="xs muted" style={{ marginTop: 8 }}>{a.recette.format === "dialogue" ? "Dialogue" : "Narration"} · {a.recette.durationSec} s{optionsSummary(a.recette.options) ? ` · ${optionsSummary(a.recette.options)}` : ""}</p>
                {a.recette.characters.length > 0 && <p className="xs muted" style={{ marginTop: 4 }}>Personnages créés pour toi : {a.recette.characters.map((c) => c.name).join(", ")} (chacun reçoit sa fiche de référence).</p>}
                <div className="row" style={{ gap: 8, marginTop: 16 }}>
                  <form action={remakeFromInspiration.bind(null, v.id)}><button className="btn accent">Refaire dans Clipr</button></form>
                  <form action={analyzeInspirationVideo.bind(null, v.id)}><button className="btn ghost" disabled={busy}>{busy ? "Analyse en cours…" : "Analyser à nouveau"}</button></form>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
