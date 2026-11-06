import { prisma } from "./db";
import { getCredential, getSettings } from "./settings";
import { chat, parseJsonLoose } from "./providers/llm";

export type TrendVideo = {
  id: string; title: string; channel: string; thumb: string; url: string; category?: string;
  durationSec: number; views: number; publishedAt: string; viewsPerHour: number; growthPerHour?: number;
};
export type TrendSearch = { query: string; traffic?: string; news?: string };
export type TrendIdea = { title: string; hook: string; angle: string; format: string; why: string; source?: string };

export const REFRESH_HOURS = 6;

const CATEGORIES: Record<string, string> = { "1": "Film", "2": "Auto", "10": "Musique", "15": "Animaux", "17": "Sport", "19": "Voyage", "20": "Jeux vidéo", "22": "Vlog", "23": "Humour", "24": "Divertissement", "25": "Actualité", "26": "Conseils", "27": "Éducation", "28": "Tech" };

function isoDur(d: string) {
  const m = d.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 86400 + (+(m[2] || 0)) * 3600 + (+(m[3] || 0)) * 60 + (+(m[4] || 0));
}

// Vidéos longues qui montent : classement YouTube « mostPopular » de la région, trié par vues par heure.
// Si un relevé précédent existe, la croissance réelle depuis ce relevé est utilisée.
export async function fetchYouTube(region: string, previous?: { at: Date; videos: TrendVideo[] }): Promise<TrendVideo[]> {
  const key = await getCredential("youtube");
  if (!key) return [];
  // Jusqu'à 4 pages de 50 (1 unité de quota par page) : assez de vidéos longues après le filtre de durée.
  const items: any[] = [];
  let pageToken = "";
  for (let page = 0; page < 4; page++) {
    const u = new URL(`${process.env.YOUTUBE_API_BASE ?? "https://www.googleapis.com/youtube/v3"}/videos`);
    u.search = new URLSearchParams({ part: "snippet,statistics,contentDetails", chart: "mostPopular", regionCode: region, maxResults: "50", key, ...(pageToken ? { pageToken } : {}) }).toString();
    const r = await fetch(u);
    const j = await r.json();
    if (!r.ok) throw new Error(`YouTube : ${j?.error?.message ?? r.status}`);
    items.push(...(j.items ?? []));
    pageToken = j.nextPageToken ?? "";
    if (!pageToken) break;
  }
  // Clipr vise les créateurs francophones : on écarte les vidéos dont la langue déclarée n'est pas le français
  // (le classement FR mêle bandes-annonces, clips et chaînes enfants étrangers). Langue absente : on garde.
  const french = (it: any) => {
    const langs = [it.snippet.defaultAudioLanguage, it.snippet.defaultLanguage].filter(Boolean) as string[];
    return langs.length === 0 || langs.some((l) => l.toLowerCase().startsWith("fr"));
  };
  const prevMap = new Map((previous?.videos ?? []).map((v) => [v.id, v]));
  const now = Date.now();
  // Temps réel écoulé depuis le relevé précédent (un relevé manuel peut suivre de quelques minutes).
  const hoursSince = previous ? (now - previous.at.getTime()) / 36e5 : 0;
  const out: TrendVideo[] = items.filter(french).map((it: any) => {
    const views = Number(it.statistics?.viewCount ?? 0);
    const hours = Math.max(1, (now - Date.parse(it.snippet.publishedAt)) / 36e5);
    const p = prevMap.get(it.id);
    const v: TrendVideo = {
      id: it.id, title: it.snippet.title, channel: it.snippet.channelTitle, url: `https://www.youtube.com/watch?v=${it.id}`,
      thumb: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url ?? "", category: CATEGORIES[it.snippet.categoryId],
      durationSec: isoDur(it.contentDetails?.duration ?? ""), views, publishedAt: it.snippet.publishedAt, viewsPerHour: Math.round(views / hours),
    };
    // Moins d'une heure d'écart : les compteurs YouTube bougent trop peu, on garde la mesure précédente.
    if (p && hoursSince >= 1) v.growthPerHour = Math.round((views - p.views) / hoursSince);
    else if (p?.growthPerHour !== undefined) v.growthPerHour = p.growthPerHour;
    return v;
  });
  // On garde les vidéos longues (au moins 8 min), celles qui se prêtent au clipping.
  return out.filter((v) => v.durationSec >= 480).sort((a, b) => (b.growthPerHour ?? b.viewsPerHour) - (a.growthPerHour ?? a.viewsPerHour)).slice(0, 25);
}

// Recherches en hausse (flux public Google Trends de la région).
export async function fetchSearches(region: string): Promise<TrendSearch[]> {
  const r = await fetch(process.env.TRENDS_RSS_URL ?? `https://trends.google.com/trending/rss?geo=${region}`, { headers: { "user-agent": "Mozilla/5.0 (compatible; Clipr)" } });
  if (!r.ok) throw new Error(`Google Trends : ${r.status}`);
  const xml = await r.text();
  const pick = (s: string, tag: string) => s.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`))?.[1]?.trim();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map((m) => ({
    query: decode(pick(m[1], "title") ?? ""), traffic: pick(m[1], "ht:approx_traffic"), news: decode(pick(m[1], "ht:news_item_title") ?? "") || undefined,
  })).filter((s) => s.query);
}
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function generateIdeas(niche: string, videos: TrendVideo[], searches: TrendSearch[]): Promise<TrendIdea[]> {
  const out = await chat({
    purpose: "tendances", json: true, maxTokens: 2500,
    system: "Tu es stratège de contenu court (TikTok, Reels, Shorts) pour le public francophone. Tu proposes des idées concrètes, faisables avec des clips ou une courte vidéo IA, sans inventer de chiffres.",
    user: `Thème du compte : ${niche || "généraliste"}.
Recherches en hausse : ${searches.map((s) => `${s.query}${s.traffic ? ` (${s.traffic})` : ""}`).join(" ; ") || "aucune"}.
Vidéos longues qui montent : ${videos.map((v) => `« ${v.title} » (${v.channel})`).join(" ; ") || "aucune"}.
Propose 6 idées de vidéos courtes à publier dans les 24 h, liées à ces tendances et au thème. JSON : {"ideas":[{"title":"titre court","hook":"phrase d'accroche des 3 premières secondes","angle":"l'angle en une phrase","format":"clip | vidéo IA | face caméra","why":"pourquoi maintenant, en une phrase","source":"la tendance d'origine"}]}`,
  });
  return (parseJsonLoose<{ ideas: TrendIdea[] }>(out).ideas ?? []).slice(0, 6);
}

export async function refreshTrends() {
  const s = await getSettings();
  const prev = await prisma.trendSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  const errors: string[] = [];
  const videos = await fetchYouTube(s.trendRegion, prev ? { at: prev.createdAt, videos: JSON.parse(prev.videosJson) } : undefined).catch((e) => { errors.push(e.message); return [] as TrendVideo[]; });
  const searches = await fetchSearches(s.trendRegion).catch((e) => { errors.push(e.message); return [] as TrendSearch[]; });
  let ideas: TrendIdea[] = [];
  if (videos.length || searches.length) ideas = await generateIdeas(s.trendNiche, videos, searches).catch((e) => { errors.push(e.message); return []; });
  return prisma.trendSnapshot.create({
    data: { region: s.trendRegion, videosJson: JSON.stringify(videos), searchesJson: JSON.stringify(searches), ideasJson: JSON.stringify(ideas), error: errors.join(" · ") || null },
  });
}

export async function latestTrends() {
  const t = await prisma.trendSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  if (!t) return null;
  return { ...t, videos: JSON.parse(t.videosJson) as TrendVideo[], searches: JSON.parse(t.searchesJson) as TrendSearch[], ideas: JSON.parse(t.ideasJson) as TrendIdea[] };
}
