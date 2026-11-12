import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { credentialStatus, getSettings } from "@/lib/settings";
import Poller from "@/components/Poller";
import AiCardFx from "@/components/AiCardFx";
import { TroupeLoop } from "@/components/PageHero";
import { refreshInspirationNow } from "@/app/actions";
import { overSubs, viewsPerDay } from "@/lib/inspiration";
import { fmt } from "@/lib/analytics";

const SORTS: [string, string][] = [["perf", "Surperformance"], ["jour", "Vues par jour"], ["vues", "Vues totales"], ["recentes", "Récentes"]];
const ago = (d: Date) => { const m = Math.round((Date.now() - d.getTime()) / 6e4); return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };

export default async function Inspiration({ searchParams }: { searchParams: Promise<{ tri?: string }> }) {
  await requireUser();
  const s = await getSettings();
  if (!s.features.aiVideos) return <div className="page"><p className="note">Fonction désactivée dans Réglages (Vidéos IA et séries).</p></div>;
  const creds = await credentialStatus();
  const { tri } = await searchParams;
  const sort = SORTS.find(([k]) => k === tri)?.[0] ?? "perf";
  const [all, job] = await Promise.all([
    prisma.inspirationVideo.findMany({ take: 200 }),
    prisma.job.findFirst({ where: { type: "inspiration" }, orderBy: { createdAt: "desc" } }),
  ]);
  const busy = !!job && ["queued", "running"].includes(job.state);
  const score = (v: (typeof all)[number]) => sort === "perf" ? overSubs(v) ?? 0 : sort === "jour" ? viewsPerDay(v) : sort === "vues" ? v.views : v.publishedAt.getTime();
  const videos = [...all].sort((a, b) => score(b) - score(a)).slice(0, 60);
  const last = all.reduce<Date | null>((m, v) => (!m || v.fetchedAt > m ? v.fetchedAt : m), null);
  return (
    <div className="page">
      <Poller active={busy} ms={5000} />
      <AiCardFx />
      <div className="panel aitool aiproject clipshero troupehero">
        <span className="aibg" style={{ backgroundImage: "url(/troupe/inspiration.webp)" }} aria-hidden><TroupeLoop name="inspiration" /></span>
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div style={{ maxWidth: 600 }}>
            <h1>Inspiration fruits IA</h1>
            <p className="sec" style={{ marginTop: 8 }}>Les Shorts de fruits et personnages IA qui marchent le mieux sur YouTube ces 60 derniers jours. Ouvre une vidéo pour voir comment elle a été faite, puis crée ta propre version en un clic.</p>
          </div>
          <span className="sp" />
          {creds.youtube && (
            <div className="stack-8" style={{ textAlign: "right" }}>
              <form action={refreshInspirationNow}><button className="btn accent sm" disabled={busy}>{busy ? "Recherche en cours…" : "Actualiser"}</button></form>
              {last && <span className="xs muted">Dernier relevé {ago(last)} · toutes les 12 h</span>}
            </div>
          )}
        </div>
      </div>

      {!creds.youtube ? (
        <p className="note">Ajoute la clé « YouTube Data API » dans Réglages : Clipr s'en sert pour trouver les vidéos qui marchent.</p>
      ) : videos.length === 0 ? (
        <div className="emptystate troupe"><img src="/troupe/vide-videos.webp" alt="" /><p><b>{busy ? "Recherche des vidéos qui marchent…" : "Aucune vidéo pour l'instant"}</b></p><p className="small sec">{busy ? "Environ une minute." : "Clique sur Actualiser pour lancer la recherche."}</p></div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 16, gap: 12 }}>
            <div className="chips">{SORTS.map(([k, l]) => <Link key={k} href={`?tri=${k}`} className={`chip ${k === sort ? "on" : ""}`}>{l}</Link>)}</div>
            <span className="sp" />
            <span className="xs muted">{sort === "perf" ? "Vues rapportées aux abonnés de la chaîne : plus c'est haut, plus la vidéo a touché au-delà de son public." : `${videos.length} vidéos`}</span>
          </div>
          <div className="inspgrid">
            {videos.map((v, i) => {
              const r = overSubs(v);
              return (
                <Link key={v.id} href={`/inspiration/${v.id}`} className="inspcard" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                  <span className="inspthumb">
                    <img src={v.thumb} alt="" loading="lazy" />
                    {r >= 1 && <span className="inspbadge num" title="Vues rapportées aux abonnés de la chaîne">×{r >= 10 ? Math.round(r) : r.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</span>}
                    {v.analysisJson && <span className="inspdone">Analysée</span>}
                  </span>
                  <span className="insptitle">{v.title}</span>
                  <span className="xs muted inspmeta"><b className="num">{fmt(v.views)}</b> vues · <span className="num">{fmt(viewsPerDay(v))}</span>/jour</span>
                  <span className="xs muted inspmeta">{v.channel} · {ago(v.publishedAt)}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
