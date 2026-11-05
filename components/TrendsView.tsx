import Link from "next/link";
import type { TrendIdea, TrendSearch, TrendVideo } from "@/lib/trends";
import { REFRESH_HOURS } from "@/lib/trends";

const n = (x: number) => x.toLocaleString("fr-FR");
const k = (x: number) => (x >= 1e6 ? `${(x / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M` : x >= 1e3 ? `${Math.round(x / 1e3)} k` : n(x));
const dur = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)} h ` : ""}${Math.floor((s % 3600) / 60)} min`;

export default function TrendsView({ t, app }: { t: { createdAt: Date; region: string; videos: TrendVideo[]; searches: TrendSearch[]; ideas: TrendIdea[]; error: string | null } | null; app: boolean }) {
  if (!t) return <p className="note">Premier relevé en cours. Il faut une clé YouTube Data API dans Réglages pour le classement des vidéos ; les recherches en hausse n'ont besoin d'aucune clé.</p>;
  const go = (path: string) => (app ? path : "/inscription");
  const rate = (v: TrendVideo) => v.growthPerHour ?? v.viewsPerHour;
  const max = Math.max(1, ...t.videos.map(rate));
  const [top, ...rest] = t.videos;
  const next = new Date(t.createdAt.getTime() + REFRESH_HOURS * 36e5);
  return (
    <div className="stack-24">
      <p className="xs muted num">Relevé sur YouTube {t.region === "FR" ? "France" : t.region} et Google Trends le {t.createdAt.toLocaleDateString("fr-FR")} à {t.createdAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · prochain relevé vers {next.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
      {t.error && app && <p className="alert">{t.error}</p>}

      {top && (
        <div className="panel" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 24, alignItems: "center" }}>
          <a href={top.url} target="_blank" rel="noreferrer"><img src={top.thumb} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 10 }} /></a>
          <div className="stack">
            <span className="tag"><span className="dot live" />N° 1 en ce moment{top.category ? ` · ${top.category}` : ""}</span>
            <h2 style={{ fontSize: 24, lineHeight: 1.25, fontFamily: "var(--display)" }}>{top.title}</h2>
            <p className="sec small">{top.channel} · {dur(top.durationSec)}</p>
            <div className="row" style={{ gap: 32 }}>
              <div className="stat"><div className="xs muted">Vues par heure</div><div className="v">+{k(rate(top))}</div></div>
              <div className="stat"><div className="xs muted">Vues au total</div><div className="v">{k(top.views)}</div></div>
            </div>
            <div className="row" style={{ gap: 8 }}><Link href={go(`/tableau-de-bord?url=${encodeURIComponent(top.url)}`)} className="btn accent">Clipper cette vidéo</Link><Link href={go(`/reprendre?url=${encodeURIComponent(top.url)}`)} className="btn ghost">Reprendre</Link></div>
            <p className="xs muted">Ne clippe que les chaînes qui l'autorisent ou les vidéos dont tu as les droits.</p>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        <div className="panel" style={{ padding: "8px 24px" }}>
          <h2 style={{ padding: "16px 0 8px" }}>Ça monte en ce moment</h2>
          {rest.length === 0 && <p className="sec small" style={{ paddingBottom: 16 }}>Classement indisponible sans clé YouTube.</p>}
          {rest.map((v, i) => (
            <div key={v.id} className="rank">
              <span className="muted num">{i + 2}</span>
              <a href={v.url} target="_blank" rel="noreferrer"><img src={v.thumb} alt="" /></a>
              <div style={{ minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
                <div className="xs muted num">{v.channel} · {dur(v.durationSec)} · {k(v.views)} vues{v.category ? ` · ${v.category}` : ""}</div>
                <div className={`growth ${i === 0 ? "top" : ""}`}><i style={{ width: `${(rate(v) / max) * 100}%` }} /></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num small">+{k(rate(v))}/h</div>
                <Link href={go(`/tableau-de-bord?url=${encodeURIComponent(v.url)}`)} className="btn ghost sm" style={{ marginTop: 8 }}>Clipper</Link>
              </div>
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding: "8px 24px" }}>
          <h2 style={{ padding: "16px 0 8px" }}>Recherches en hausse</h2>
          {t.searches.length === 0 && <p className="sec small" style={{ paddingBottom: 16 }}>Aucune donnée sur ce relevé.</p>}
          {t.searches.map((s, i) => (
            <div key={s.query} className="cliprow" style={{ height: "auto", padding: "8px 0", alignItems: "flex-start", gap: 12 }}>
              <span style={{ minWidth: 0 }}><span className="muted num" style={{ marginRight: 8 }}>{i + 1}</span>{s.query}{s.news && <span className="xs muted" style={{ display: "block", marginTop: 2 }}>{s.news}</span>}</span>
              {s.traffic && <span className="xs muted num" style={{ whiteSpace: "nowrap" }}>{s.traffic} recherches</span>}
            </div>
          ))}
        </div>
      </div>

      {t.ideas.length > 0 && (
        <div>
          <h2 style={{ marginBottom: 16 }}>Idées à produire aujourd'hui</h2>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
            {t.ideas.map((i) => (
              <div key={i.title} className="card idea">
                <span className="xs muted">{i.format}{i.source ? ` · d'après « ${i.source} »` : ""}</span>
                <h3>{i.title}</h3>
                <p className="small">« {i.hook} »</p>
                <p className="xs sec">{i.angle} {i.why}</p>
                <Link href={go(`/videos-ia?idee=${encodeURIComponent(`${i.title}. Accroche : ${i.hook}. Angle : ${i.angle}`)}`)} className="btn ghost sm" style={{ alignSelf: "flex-start", marginTop: 4 }}>Créer la vidéo</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
