import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { YT_DAILY_QUOTA, YT_QUOTA, quotaDayStart } from "@/lib/providers/youtube";
import BarsChart from "@/components/BarsChart";
import AiCardFx from "@/components/AiCardFx";

const usd = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: n > 0 && n < 0.01 ? 4 : 2 })} $`;
const num = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
const PERIODS = [7, 30, 90];

// Familles de services : chaque UsageEvent.kind est rangé dans une carte (visuels Magnific dans public/usage/).
// Le quota YouTube (kind "quota", gratuit) a sa propre carte plus bas.
const FAMILIES = [
  { id: "llm", kinds: ["llm", "text"], t: "Texte IA", d: "Scénarios, idées, analyses et réponses des modèles de langage.", glow: "245 200 80" },
  { id: "transcription", kinds: ["transcription"], t: "Transcription", d: "Conversion de la parole en texte, mot à mot, pour trouver les clips.", glow: "245 217 10" },
  { id: "image", kinds: ["image"], t: "Images", d: "Illustrations des épisodes, miniatures et images générées.", glow: "255 140 90" },
  { id: "video", kinds: ["video"], t: "Vidéos", d: "Plans animés et vidéos générées par IA.", glow: "255 190 110" },
  { id: "voix", kinds: ["tts", "audio"], t: "Voix et audio", d: "Voix off, doublage et effets sonores.", glow: "190 140 255" },
  { id: "publication", kinds: ["tiktok", "publication"], t: "Publications", d: "Envois vers TikTok et Facebook (gratuits, comptés pour le suivi).", glow: "255 210 90" },
];
const familyOf = (kind: string) => FAMILIES.find((f) => f.kinds.includes(kind));

export default async function Usage({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  const u = await requireUser();
  const admin = u.role === "admin";
  const j = Number((await searchParams).j);
  const days = PERIODS.includes(j) ? j : 30;
  const now = Date.now(), since = new Date(now - days * 864e5), before = new Date(now - 2 * days * 864e5);
  const mine = admin ? {} : { userId: u.id };

  const [events, prev, recent, credits, yt, ytConnected] = await Promise.all([
    prisma.usageEvent.findMany({ where: { ...mine, createdAt: { gte: since } }, select: { kind: true, provider: true, model: true, units: true, unitLabel: true, costUsd: true, createdAt: true } }),
    prisma.usageEvent.aggregate({ where: { ...mine, createdAt: { gte: before, lt: since } }, _sum: { costUsd: true } }),
    prisma.usageEvent.findMany({ where: { ...mine, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { email: true } } } }),
    prisma.creditLedger.aggregate({ where: { userId: u.id }, _sum: { minutes: true } }),
    // Le quota YouTube est commun à tout le projet Google : on l'affiche pour tous les utilisateurs confondus.
    prisma.usageEvent.aggregate({ where: { provider: "youtube", kind: "quota", createdAt: { gte: quotaDayStart() } }, _sum: { units: true } }),
    prisma.socialAccount.count({ where: { platform: "youtube" } }).then((n) => n > 0),
  ]);

  const paid = events.filter((e) => e.kind !== "quota");
  const total = paid.reduce((a, e) => a + e.costUsd, 0);
  const prevTotal = prev._sum.costUsd ?? 0;
  const minutes = paid.filter((e) => e.kind === "transcription").reduce((a, e) => a + e.units, 0);

  // Par jour (30 barres au plus : les 30 derniers jours de la période).
  const shown = Math.min(days, 30);
  const perDay = new Map<string, number>();
  for (const e of paid) { const d = e.createdAt.toISOString().slice(0, 10); perDay.set(d, (perDay.get(d) ?? 0) + e.costUsd); }
  const bars = [...Array(shown)].map((_, i) => {
    const date = new Date(now - (shown - 1 - i) * 864e5), d = date.toISOString().slice(0, 10);
    return { label: String(date.getDate()), tip: date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }), v: perDay.get(d) ?? 0 };
  });

  // Par famille : coût, appels, volumes par unité et modèles les plus coûteux.
  const fams = FAMILIES.map((f) => {
    const list = paid.filter((e) => f.kinds.includes(e.kind));
    const cost = list.reduce((a, e) => a + e.costUsd, 0);
    const volume = new Map<string, number>(), models = new Map<string, { cost: number; n: number }>();
    for (const e of list) {
      volume.set(e.unitLabel, (volume.get(e.unitLabel) ?? 0) + e.units);
      const k = `${e.provider}${e.model ? ` · ${e.model}` : ""}`, m = models.get(k) ?? { cost: 0, n: 0 };
      m.cost += e.costUsd; m.n++; models.set(k, m);
    }
    return { ...f, cost, n: list.length, volume: [...volume], models: [...models].sort((a, b) => b[1].cost - a[1].cost || b[1].n - a[1].n).slice(0, 3) };
  });
  const top = fams.reduce((a, f) => (f.cost > a.cost ? f : a), fams[0]);

  const ytUsed = yt._sum.units ?? 0, ytPct = Math.min(100, (ytUsed / YT_DAILY_QUOTA) * 100);
  const left = Math.max(0, credits._sum.minutes ?? 0);
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  return (
    <div className="page">
      <AiCardFx />
      <div className="panel aitool aiproject clipshero usagehero">
        <span className="aibg" style={{ backgroundImage: "url(/usage/hero.webp)" }} aria-hidden>
          {existsSync(join(process.cwd(), "public/usage/hero.mp4")) && <video className="bgvid" src="/usage/hero.mp4" muted loop playsInline preload="none" />}
        </span>
        <div style={{ maxWidth: 560 }}>
          <h1>Usage</h1>
          <p className="sec" style={{ marginTop: 8 }}>Ce que coûtent les appels aux services d'IA, estimé avec les tarifs saisis dans Réglages. La facture exacte reste celle de chaque fournisseur.{admin ? " Vue de tous les utilisateurs." : ""}</p>
          <div className="chips" style={{ marginTop: 20 }}>
            {PERIODS.map((d) => <Link key={d} href={`?j=${d}`} className={`chip ${d === days ? "on" : ""}`}>{d} jours</Link>)}
          </div>
        </div>
      </div>

      <div className="swap stack-24" key={days}>
        <div className="kpis ukpis">
          <div className="card kpi">
            <div className="xs muted">Dépense estimée · {days} jours</div>
            <div className="v num">{usd(total)}</div>
            <div className="delta">{delta === null ? "Pas de période précédente à comparer" : <><span aria-hidden>{delta > 0 ? "▲" : delta < 0 ? "▼" : "■"}</span> {delta > 0 ? "+" : ""}{num(delta)} % <span className="muted">vs les {days} jours d'avant</span></>}</div>
          </div>
          <div className="card kpi" style={{ animationDelay: "60ms" }}>
            <div className="xs muted">Appels aux services</div>
            <div className="v num">{num(paid.length)}</div>
            <div className="delta">{paid.length ? `${usd(total / paid.length)} par appel en moyenne` : "Aucun appel sur la période"}</div>
          </div>
          <div className="card kpi" style={{ animationDelay: "120ms" }}>
            <div className="xs muted">Minutes transcrites</div>
            <div className="v num">{num(minutes, 1)}</div>
            <div className="delta">{top.cost > 0 ? <>Poste principal : <b style={{ color: "var(--text)" }}>{top.t}</b></> : "Aucune dépense encore"}</div>
          </div>
          <div className="card kpi" style={{ animationDelay: "180ms" }}>
            <div className="xs muted">{admin ? "Minutes de vidéo" : "Minutes restantes"}</div>
            <div className="v num">{admin ? "∞" : num(left)}</div>
            <div className="delta">{admin ? "Compte administrateur, sans limite" : "Crédit pour importer des vidéos"}</div>
          </div>
        </div>

        <div className="panel">
          <div className="row" style={{ marginBottom: 16 }}><h2>Dépense par jour</h2><span className="sp" /><span className="xs muted">{days > 30 ? "30 derniers jours" : `${days} derniers jours`} · en dollars</span></div>
          <BarsChart bars={bars} unit="$" height={200} decimals={2} showLabels={shown <= 14} />
        </div>

        <div>
          <div className="row" style={{ marginBottom: 12 }}><h2>Par type de service</h2><span className="sp" /><span className="xs muted">Part de la dépense sur {days} jours</span></div>
          <div className="ufams">
            {fams.map((f) => {
              const share = total > 0 ? (f.cost / total) * 100 : 0;
              return (
                <div key={f.id} className={`card aitool ufam ${f.n === 0 ? "idle" : ""}`} style={{ "--glow": f.glow } as React.CSSProperties}>
                  <span className="aibg" style={{ backgroundImage: `url(/usage/${f.id}.webp)` }} aria-hidden />
                  <div className="row" style={{ alignItems: "baseline" }}><h3>{f.t}</h3><span className="sp" /><b className="num ucost">{usd(f.cost)}</b></div>
                  <p className="xs sec">{f.d}</p>
                  <div className="ushare"><i style={{ width: `${share}%` }} /></div>
                  <div className="row xs muted"><span className="num">{num(f.n)} appel{f.n > 1 ? "s" : ""}{f.volume.map(([l, v]) => ` · ${num(v, l === "minutes" ? 1 : 0)} ${l}`).join("")}</span><span className="sp" /><span className="num">{total > 0 ? `${num(share)} %` : ""}</span></div>
                  {f.models.length > 0 && (
                    <ul className="umodels">
                      {f.models.map(([k, m]) => <li key={k}><span>{k}</span><span className="num">{m.cost > 0 ? usd(m.cost) : `${m.n}×`}</span></li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {ytConnected && (
          <div className="card uquota">
            <img src="/stats/logo-youtube.png" alt="" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row"><b>Quota YouTube du jour</b><span className="sp" /><span className="num small">{num(ytUsed)} / {num(YT_DAILY_QUOTA)} unités</span></div>
              <div className="ushare" style={{ marginTop: 10 }}><i style={{ width: `${ytPct}%`, background: ytPct > 85 ? "var(--err)" : undefined }} /></div>
              <div className="xs muted" style={{ marginTop: 8 }}>Environ {num(Math.max(0, Math.floor((YT_DAILY_QUOTA - ytUsed) / YT_QUOTA.upload)))} Shorts encore publiables aujourd'hui · remis à zéro à minuit, heure du Pacifique · commun à tous les utilisateurs</div>
            </div>
          </div>
        )}

        <div className="panel" style={{ padding: "8px 24px" }}>
          <div className="row" style={{ padding: "16px 0 8px" }}><h2>Derniers appels</h2><span className="sp" /><span className="xs muted">{recent.length ? `Les ${recent.length} plus récents` : ""}</span></div>
          {recent.length === 0 ? (
            <div className="emptystate">
              <img src="/usage/hero.webp" alt="" />
              <p><b>Aucun appel sur les {days} derniers jours</b></p>
              <p className="small sec">Chaque appel à un service payant (transcription, texte, image, voix, vidéo) apparaîtra ici avec son coût estimé.</p>
            </div>
          ) : (
            <div className="ulog">
              {recent.map((e) => {
                const f = familyOf(e.kind);
                return (
                  <div key={e.id} className="urow">
                    <span className={`uthumb ${f ? "" : "logo"}`} style={{ backgroundImage: f ? `url(/usage/${f.id}.webp)` : e.provider === "youtube" ? "url(/stats/logo-youtube.png)" : undefined }} aria-hidden />
                    <span className="uinfo">
                      <b>{f?.t ?? (e.kind === "quota" ? "Quota YouTube" : e.kind)}</b>
                      <span className="xs muted">{e.provider}{e.model ? ` · ${e.model}` : ""}{admin && e.user ? ` · ${e.user.email}` : ""}</span>
                    </span>
                    <span className="xs muted num uvol">{num(e.units, 2)} {e.unitLabel}</span>
                    <span className="uright"><b className="num">{usd(e.costUsd)}</b><span className="xs muted num">{e.createdAt.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
