import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PEPITE, PERIODS, analyse, fmt, pct, signed, type StatVideo } from "@/lib/analytics";
import TrendChart from "@/components/TrendChart";
import BarsChart from "@/components/BarsChart";
import Thumb from "@/components/Thumb";
import Poller from "@/components/Poller";
import AiCardFx from "@/components/AiCardFx";
import { refreshStats } from "@/app/actions";

const LABEL: Record<string, string> = { tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube" };
// Ce qu'il faut pour relier chaque réseau (API officielles, clés saisies par l'administrateur dans Réglages).
const SETUP: Record<string, { gives: string; api: string; how: string }> = {
  tiktok: { gives: "Abonnés, j'aime, vidéos, et pour chaque vidéo : vues, j'aime, commentaires, partages.", api: "App TikTok for Developers avec Login Kit (autorisations user.info.basic, user.info.stats, video.list).", how: "Client key et Client secret dans Réglages, puis Connecter dans Comptes. Tant que l'app n'est pas validée, ajoute ton compte comme testeur." },
  facebook: { gives: "Abonnés de la Page, et pour chaque Reel : vues, réactions, commentaires, partages.", api: "App Meta for Developers (autorisations pages_show_list, pages_read_engagement, read_insights).", how: "App ID et App secret dans Réglages, puis Connecter ta Page (pas un profil perso) dans Comptes." },
  youtube: { gives: "Abonnés de la chaîne, et pour chaque vidéo : vues, j'aime, commentaires.", api: "Projet Google Cloud avec YouTube Data API v3 et identifiants OAuth.", how: "Client ID et Client secret dans Réglages, puis Connecter ta chaîne dans Comptes." },
};
const ago = (d: Date) => { const m = Math.round((Date.now() - d.getTime()) / 6e4); return m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `le ${d.toLocaleDateString("fr-FR")}`; };
const dur = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

export default async function Stats({ searchParams }: { searchParams: Promise<{ p?: string; periode?: string; tri?: string }> }) {
  const u = await requireUser();
  const s = await getSettings();
  if (!s.features.stats) return <div className="page"><p className="note">Fonction désactivée dans Réglages{u.role === "admin" ? " : active « Statistiques des comptes »." : "."}</p></div>;
  const sp = await searchParams;
  const accounts = await prisma.socialAccount.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } });
  const platform = accounts.some((a) => a.platform === sp.p) ? sp.p! : accounts[0]?.platform ?? "tiktok";
  const account = accounts.find((a) => a.platform === platform);
  const period = PERIODS.find(([k]) => k === sp.periode) ?? PERIODS[1];
  const sort = sp.tri === "vues" ? "vues" : "recentes";
  const q = (o: Record<string, string>) => `?${new URLSearchParams({ p: platform, periode: period[0], tri: sort, ...o })}`;

  const snaps = await prisma.accountSnapshot.findMany({ where: { userId: u.id, platform }, orderBy: { createdAt: "asc" }, take: 2000 });
  const a = analyse(snaps, period[2]);
  const running = await prisma.job.count({ where: { type: "stats", state: { in: ["queued", "running"] }, payload: { contains: u.id } } });
  // Comparaison des comptes : dernier relevé et progression sur 7 jours.
  const compare = accounts.length > 1 ? await Promise.all(accounts.map(async (acc) => {
    const list = await prisma.accountSnapshot.findMany({ where: { userId: u.id, platform: acc.platform }, orderBy: { createdAt: "asc" }, take: 2000 });
    return { acc, x: analyse(list, 7) };
  })) : [];
  const videos: StatVideo[] = a ? (sort === "vues" ? [...a.videos].sort((x, y) => y.views - x.views) : a.videos) : [];

  return (
    <div className="page">
      <Poller active={running > 0} ms={4000} />
      <AiCardFx />
      <div className="panel aitool aiproject clipshero">
        <span className="aibg" style={{ backgroundImage: "url(/stats/hero.webp)" }} aria-hidden />
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div style={{ maxWidth: 560 }}>
            <h1>Statistiques</h1>
            <p className="sec" style={{ marginTop: 8 }}>Abonnés, vues, engagement et meilleures vidéos de tes comptes TikTok, Facebook et YouTube, relevés automatiquement toutes les 6 h.</p>
          </div>
          <span className="sp" />
          {accounts.length > 0 && (
            <div className="stack-8" style={{ textAlign: "right" }}>
              <form action={refreshStats}><button className="btn accent sm" disabled={running > 0}>{running ? "Relevé en cours…" : "Relever maintenant"}</button></form>
              {a && <span className="xs muted">Dernier relevé {ago(a.last.createdAt)}</span>}
            </div>
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <>
          <h2 style={{ marginBottom: 16 }}>Connecte tes comptes pour commencer</h2>
          <div className="steps3">
            {Object.entries(SETUP).map(([id, x], i) => (
              <div key={id} className="card aitool stack-8 platcard" style={{ animationDelay: `${i * 80}ms` }}>
                <span className="aibg" style={{ backgroundImage: `url(/stats/${id}.webp)` }} aria-hidden />
                <div className="row" style={{ gap: 10 }}><img className="ailogo" src={`/stats/logo-${id}.png`} alt="" /><b>{LABEL[id]}</b></div>
                <p className="small">{x.gives}</p>
                <p className="xs sec"><b style={{ color: "var(--text)" }}>API :</b> {x.api}</p>
                <p className="xs sec">{x.how}</p>
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <Link href="/comptes" className="btn accent sm">Connecter</Link>
                  {u.role === "admin" && <Link href="/reglages" className="btn quiet sm">Réglages</Link>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="stack-24">
          <div className="row" style={{ gap: 12, justifyContent: "space-between" }}>
            <div className="ptabs">
              {accounts.map((acc) => (
                <Link key={acc.id} href={`?${new URLSearchParams({ p: acc.platform, periode: period[0], tri: sort })}`} className={`ptab ${acc.platform === platform ? "on" : ""}`}>
                  {acc.avatarUrl ? <img className="pavatar" src={acc.avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
                  <img className="plogo" src={`/stats/logo-${acc.platform}.png`} alt="" />
                  <span>{LABEL[acc.platform]}{acc.displayName ? <span className="xs muted"> · {acc.displayName}</span> : null}</span>
                </Link>
              ))}
            </div>
            <div className="chips">
              {PERIODS.map(([k, l]) => <Link key={k} href={q({ periode: k })} className={`chip ${k === period[0] ? "on" : ""}`}>{l}</Link>)}
            </div>
          </div>

          {!a ? (
            <div className="panel emptystate">
              <img src={`/stats/${platform}.webp`} alt="" />
              <p><b>Premier relevé {running ? "en cours…" : "pas encore fait"}</b></p>
              <p className="small sec">Clique sur « Relever maintenant » : les chiffres de {LABEL[platform]}{account?.displayName ? ` (${account.displayName})` : ""} arrivent en quelques secondes.</p>
            </div>
          ) : (
            <div className="swap stack-24" key={`${platform}-${period[0]}`}>
              <div className="kpis">
                {([
                  ["Abonnés", fmt(a.last.followers), a.delta("followers")],
                  ["Vues des dernières vidéos", fmt(a.last.views), a.delta("views")],
                  ["J'aime", fmt(a.last.likes), a.delta("likes")],
                  ["Vidéos publiées", fmt(a.last.videos), a.delta("videos")],
                ] as [string, string, number | null][]).map(([label, v, d], i) => (
                  <div key={label} className="card kpi" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="xs muted">{label}</div>
                    <div className="v num">{v}</div>
                    {d === null ? <div className="xs muted">Comparaison au prochain relevé</div>
                      : <div className={`delta ${d > 0 ? "up" : d < 0 ? "down" : ""}`}><span aria-hidden>{d > 0 ? "▲" : d < 0 ? "▼" : "■"}</span> {signed(d)} <span className="muted">{a.covers ? `sur ${period[1]}` : `depuis le ${a.base.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`}</span></div>}
                  </div>
                ))}
                <div className="card kpi" style={{ animationDelay: "200ms" }}>
                  <div className="xs muted">Taux d'engagement</div>
                  <div className="v num">{a.engagement === null ? "–" : pct(a.engagement)}</div>
                  <div className="xs muted">(j'aime + commentaires + partages) ÷ vues</div>
                </div>
                <div className="card kpi" style={{ animationDelay: "250ms" }}>
                  <div className="xs muted">Vues moyennes par vidéo</div>
                  <div className="v num">{fmt(a.avgViews)}</div>
                  <div className="xs muted">sur les {a.videos.length} dernières vidéos</div>
                </div>
              </div>

              <div className="panel insights">
                <h2>Ce qu'il faut retenir</h2>
                <ul>
                  {a.perDay !== null && (
                    <li><span className="ic">📈</span><span>{a.perDay >= 0 ? "Tu gagnes" : "Tu perds"} <b>{fmt(Math.abs(a.perDay))} abonné{Math.abs(a.perDay) >= 2 ? "s" : ""} par jour</b> en moyenne{a.projection30 !== null && a.perDay > 0 ? <> : à ce rythme, <b>{fmt(a.projection30)} abonnés</b> dans 30 jours.</> : "."}</span></li>
                  )}
                  {a.star && a.star.views > 0 && <li><span className="ic">⭐</span><span>Ta vidéo star : <b>« {a.star.title || "Sans titre"} »</b> avec {fmt(a.star.views)} vues{a.avgViews ? `, soit ${(a.star.views / a.avgViews).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} × ta moyenne` : ""}.</span></li>}
                  {a.bestDay && <li><span className="ic">📅</span><span>Tes vidéos publiées le <b>{a.bestDay.full}</b> font le plus de vues ({fmt(a.bestDay.v)} en moyenne sur {a.bestDay.n} vidéo{a.bestDay.n > 1 ? "s" : ""}).</span></li>}
                  {a.bestSlot && <li><span className="ic">🕒</span><span>Le meilleur moment de publication : <b>{a.bestSlot.full}</b> ({fmt(a.bestSlot.v)} vues en moyenne).</span></li>}
                  {a.pepites.length > 0 && <li><span className="ic">💎</span><span><b>{a.pepites.length} pépite{a.pepites.length > 1 ? "s" : ""}</b> : {a.pepites.slice(0, 2).map((v) => `« ${v.title || "Sans titre"} » (×${Math.round(a.score(v))})`).join(", ")} {a.pepites.length > 1 ? "ont" : "a"} fait au moins {PEPITE} × tes vues habituelles ({fmt(a.usual)}). Refais-{a.pepites.length > 1 ? "les" : "la"} : même sujet, même accroche, en mieux.</span></li>}
                  {a.usual > 0 && a.pepites.length === 0 && <li><span className="ic">💎</span><span>Aucune vidéo n'a encore fait {PEPITE} × tes vues habituelles ({fmt(a.usual)}) : teste d'autres accroches dans les 2 premières secondes.</span></li>}
                  {a.dated && <li><span className="ic">🗓️</span><span><b>{a.week} vidéo{a.week > 1 ? "s" : ""}</b> publiée{a.week > 1 ? "s" : ""} ces 7 derniers jours ({a.perWeek4.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} par semaine sur un mois). {a.week < 3 ? "Vise 3 à 7 par semaine : la régularité compte plus que la perfection." : a.week > 7 ? "Beau rythme : garde la qualité de l'accroche à chaque vidéo." : "C'est la bonne zone (3 à 7 par semaine), garde ce rythme."}</span></li>}
                  {a.engagement !== null && <li><span className="ic">💬</span><span>Sur 100 personnes qui regardent, environ <b>{(a.engagement * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</b> aiment, commentent ou partagent.</span></li>}
                </ul>
                {!a.rich && <p className="xs muted" style={{ marginTop: 12 }}>Miniatures, commentaires et partages apparaîtront au prochain relevé.</p>}
              </div>

              <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
                <div className="panel"><h2 style={{ marginBottom: 16 }}>Abonnés</h2><TrendChart label="Abonnés" points={a.series.map((x) => ({ t: x.t, v: x.followers }))} /></div>
                <div className="panel"><h2 style={{ marginBottom: 16 }}>Vues par vidéo</h2>
                  <BarsChart unit="vues" height={220} showLabels={false} bars={[...a.videos].reverse().map((v) => ({ label: "", v: v.views, tip: `${v.title || "Sans titre"} · ${v.date ? new Date(v.date).toLocaleDateString("fr-FR") : ""}` }))} />
                  <p className="xs muted" style={{ marginTop: 8 }}>De la plus ancienne à la plus récente</p>
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24 }}>
                <div className="panel"><h2 style={{ marginBottom: 16 }}>Vues moyennes selon le jour</h2><BarsChart unit="vues en moyenne" bars={a.byDay.map((d) => ({ label: d.label, v: d.v, n: d.n }))} /></div>
                <div className="panel"><h2 style={{ marginBottom: 16 }}>Selon le moment de la journée</h2><BarsChart unit="vues en moyenne" bars={a.bySlot.map((d) => ({ label: d.label, v: d.v, n: d.n }))} /></div>
              </div>

              <div className="panel" style={{ padding: "8px 24px 16px" }}>
                <div className="row" style={{ padding: "16px 0 8px", justifyContent: "space-between" }}>
                  <h2>Tes vidéos</h2>
                  <div className="chips"><Link href={q({ tri: "recentes" })} className={`chip ${sort === "recentes" ? "on" : ""}`}>Récentes</Link><Link href={q({ tri: "vues" })} className={`chip ${sort === "vues" ? "on" : ""}`}>Plus vues</Link></div>
                </div>
                {videos.length === 0 && <p className="sec small">Aucune vidéo relevée sur ce compte.</p>}
                {videos.length > 0 && (
                  <div className="vtable">
                    <div className="vrow vhead xs muted"><span /><span>Vidéo</span><span>Vues</span><span>J'aime</span><span>Comm.</span><span>Partages</span><span>Engag.</span></div>
                    {videos.map((v, i) => {
                      const e = v.views ? (v.likes + (v.comments ?? 0) + (v.shares ?? 0)) / v.views : null;
                      const isStar = a.star === v || (a.star?.id && a.star.id === v.id);
                      return (
                        <div key={v.id ?? i} className="vrow">
                          <span className="vthumb"><Thumb src={v.cover} platform={platform} />{v.duration ? <span className="d num">{dur(v.duration)}</span> : null}</span>
                          <span className="vinfo">
                            <span className="t">{isStar && <span className="star">⭐ </span>}{a.score(v) >= PEPITE && <span className="pepite" title={`${Math.round(a.score(v))} × tes vues habituelles`}>×{Math.round(a.score(v))}</span>}{v.url ? <a href={v.url} target="_blank" rel="noreferrer">{v.title || "Sans titre"}</a> : v.title || "Sans titre"}</span>
                            <span className="xs muted num">{v.date ? new Date(v.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : ""}</span>
                          </span>
                          <span className="num"><b>{fmt(v.views)}</b></span>
                          <span className="num">{fmt(v.likes)}</span>
                          <span className="num">{v.comments ? fmt(v.comments) : "–"}</span>
                          <span className="num">{v.shares ? fmt(v.shares) : "–"}</span>
                          <span className="num">{e === null ? "–" : pct(e)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {compare.length > 1 && (
            <div className="panel" style={{ padding: "8px 24px 16px" }}>
              <h2 style={{ padding: "16px 0 8px" }}>Tous tes comptes</h2>
              <div className="ctable">
                {compare.map(({ acc, x }) => (
                  <Link key={acc.id} href={`?${new URLSearchParams({ p: acc.platform, periode: period[0], tri: sort })}`} className="crow">
                    <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}><img className="plogo" src={`/stats/logo-${acc.platform}.png`} alt="" /><span>{LABEL[acc.platform]}<span className="xs muted" style={{ display: "block" }}>{acc.displayName ?? ""}</span></span></span>
                    <span><span className="xs muted">Abonnés</span><b className="num">{x ? fmt(x.last.followers) : "–"}</b></span>
                    <span><span className="xs muted">7 jours</span><b className={`num ${x?.delta("followers") ? (x.delta("followers")! > 0 ? "upc" : "downc") : ""}`}>{x?.delta("followers") != null ? signed(x.delta("followers")!) : "–"}</b></span>
                    <span><span className="xs muted">Vues récentes</span><b className="num">{x ? fmt(x.last.views) : "–"}</b></span>
                    <span><span className="xs muted">Engagement</span><b className="num">{x?.engagement != null ? pct(x.engagement) : "–"}</b></span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
