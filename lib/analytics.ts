// Analyse des comptes (page Statistiques) : calculée à partir des relevés AccountSnapshot (toutes les 6 h).
// Les vidéos de chaque relevé sont dans topJson ; les anciens relevés n'ont que titre, vues, j'aime et date.

export type StatVideo = {
  id?: string; title: string; date: string; views: number; likes: number;
  comments?: number; shares?: number; cover?: string; url?: string; duration?: number;
};
type Snap = { createdAt: Date; followers: number; likes: number; videos: number; views: number; topJson: string };

export const PERIODS: [string, string, number][] = [["7j", "7 jours", 7], ["30j", "30 jours", 30], ["90j", "90 jours", 90], ["tout", "Tout", 0]];
export const WEEKDAYS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const WEEKDAYS_FULL = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const SLOTS: [string, number, number][] = [["Nuit", 0, 6], ["Matin", 6, 12], ["Midi", 12, 15], ["Après-midi", 15, 19], ["Soir", 19, 24]];

const eng = (v: StatVideo) => v.likes + (v.comments ?? 0) + (v.shares ?? 0);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function analyse(snaps: Snap[], periodDays: number) {
  const last = snaps.at(-1);
  if (!last) return null;
  const since = periodDays ? last.createdAt.getTime() - periodDays * 864e5 : 0;
  const inPeriod = snaps.filter((s) => s.createdAt.getTime() >= since);
  // Point de départ : le dernier relevé avant le début de la période, sinon le premier de la période.
  const base = [...snaps].reverse().find((s) => s.createdAt.getTime() <= since) ?? inPeriod[0] ?? last;
  const hasBase = base !== last;
  const delta = (k: "followers" | "likes" | "videos" | "views") => (hasBase ? last[k] - base[k] : null);
  const days = Math.max(1 / 4, (last.createdAt.getTime() - base.createdAt.getTime()) / 864e5);
  const perDay = hasBase ? (last.followers - base.followers) / days : null;

  const videos: StatVideo[] = (JSON.parse(last.topJson) as StatVideo[])
    .map((v) => ({ ...v, views: Number(v.views) || 0, likes: Number(v.likes) || 0, comments: Number(v.comments) || 0, shares: Number(v.shares) || 0 }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const withViews = videos.filter((v) => v.views > 0);
  const totalViews = withViews.reduce((a, v) => a + v.views, 0);
  const engagement = totalViews ? withViews.reduce((a, v) => a + eng(v), 0) / totalViews : null;
  const star = [...videos].sort((a, b) => b.views - a.views)[0];

  // Vues moyennes par jour de publication et par moment de la journée (heure locale du serveur).
  const dated = withViews.filter((v) => v.date && !Number.isNaN(Date.parse(v.date)));
  const byDay = WEEKDAYS.map((label, d) => { const xs = dated.filter((v) => new Date(v.date).getDay() === d).map((v) => v.views); return { label, full: WEEKDAYS_FULL[d], v: avg(xs), n: xs.length }; });
  const bySlot = SLOTS.map(([label, a, b]) => { const xs = dated.filter((v) => { const h = new Date(v.date).getHours(); return h >= a && h < b; }).map((v) => v.views); return { label, full: label.toLowerCase(), v: avg(xs), n: xs.length }; });
  const best = (xs: { label: string; full: string; v: number; n: number }[]) => [...xs].filter((x) => x.n > 0).sort((a, b) => b.v - a.v)[0] ?? null;

  return {
    last, base, hasBase, delta, perDay, days,
    // La période demandée est-elle entièrement couverte par les relevés ? Sinon on affiche « depuis le … ».
    covers: periodDays > 0 && base.createdAt.getTime() <= since,
    projection30: perDay === null ? null : Math.max(0, Math.round(last.followers + perDay * 30)),
    series: inPeriod.map((s) => ({ t: s.createdAt.toISOString(), followers: s.followers, views: s.views })),
    videos, star, engagement,
    avgViews: avg(withViews.map((v) => v.views)),
    byDay, bySlot, bestDay: best(byDay), bestSlot: best(bySlot),
    rich: videos.some((v) => v.cover || v.comments || v.shares), // relevé fait avec la nouvelle version (miniatures, commentaires…)
  };
}

export type Analysis = NonNullable<ReturnType<typeof analyse>>;

export const fmt = (x: number) => (Math.abs(x) >= 1e6 ? `${(x / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M` : Math.abs(x) >= 1e4 ? `${(x / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : Math.round(x).toLocaleString("fr-FR"));
export const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${fmt(Math.abs(x))}`;
export const pct = (x: number) => `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
