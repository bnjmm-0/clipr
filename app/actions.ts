"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPassword, createSession, currentUser, destroySession, hashPassword, requireAdmin, requireUser } from "@/lib/auth";
import { CREDENTIALS, FEATURES, PLATFORMS, deleteCredential, featureEnabled, getSettings, isPlatform, setCredential, type CredentialName } from "@/lib/settings";
import { enqueue } from "@/lib/jobs";
import { chat } from "@/lib/providers/llm";
import { accountSnapshot } from "@/lib/providers/tiktok";
import { CREATORS } from "@/lib/ai-advice";
import { TOOL_APPS, pickOptions } from "@/lib/ai-tools";
import { IMAGE_ENGINES, SCRIPT_ENGINES, isElevenVoice, parseVisuals, pickEngine } from "@/lib/engines";
import { VOICES } from "@/lib/providers/tts";

export type FormState = { error?: string; ok?: string } | undefined;

const authSchema = z.object({ email: z.string().email("Email invalide").toLowerCase(), password: z.string().min(8, "8 caractères minimum") });

export async function register(_: FormState, fd: FormData): Promise<FormState> {
  const p = authSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { error: p.error.issues[0].message };
  if (await prisma.user.findUnique({ where: { email: p.data.email } })) return { error: "Un compte existe déjà avec cet email" };
  const first = (await prisma.user.count()) === 0; // le premier compte est l'administrateur (l'exploitant)
  const s = await getSettings();
  const u = await prisma.user.create({ data: { email: p.data.email, name: String(fd.get("name") || "") || null, passwordHash: await hashPassword(p.data.password), role: first ? "admin" : "user" } });
  if (!first) await prisma.creditLedger.create({ data: { userId: u.id, minutes: s.freeMinutes, reason: "Essai gratuit" } });
  await createSession(u.id);
  redirect(first ? "/reglages" : "/tableau-de-bord");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").toLowerCase();
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u || !(await checkPassword(String(fd.get("password") || ""), u.passwordHash))) return { error: "Email ou mot de passe incorrect" };
  await createSession(u.id);
  redirect("/tableau-de-bord");
}

export async function logout() { await destroySession(); redirect("/"); }

// ——— Réglages (administrateur uniquement) ———
export async function saveFeatures(fd: FormData) {
  await requireAdmin();
  const features = Object.fromEntries(FEATURES.map((f) => [f.key, fd.get(f.key) === "on"]));
  await prisma.appSettings.update({ where: { id: "global" }, data: { featuresJson: JSON.stringify(features) } });
  revalidatePath("/", "layout");
}

export async function saveProviders(fd: FormData) {
  await requireAdmin();
  const prices: Record<string, number> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("price:") && String(v).trim() !== "") prices[k.slice(6)] = Number(v);
  await prisma.appSettings.update({
    where: { id: "global" },
    data: {
      llmProvider: String(fd.get("llmProvider")), llmModel: String(fd.get("llmModel")).trim(), sttProvider: String(fd.get("sttProvider")),
      imageProvider: String(fd.get("imageProvider")), imageModel: String(fd.get("imageModel")).trim(), videoModel: String(fd.get("videoModel")).trim(),
      freeMinutes: Math.max(0, Number(fd.get("freeMinutes")) || 0), pricesJson: JSON.stringify(prices),
      ttsModel: String(fd.get("ttsModel") || "gpt-4o-mini-tts").trim(), trendRegion: String(fd.get("trendRegion") || "FR").toUpperCase().slice(0, 2), trendNiche: String(fd.get("trendNiche") || "").slice(0, 300),
    },
  });
  revalidatePath("/reglages");
}

export async function saveCredential(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(fd.get("name")) as CredentialName;
  if (!CREDENTIALS.some((c) => c.name === name)) return { error: "Clé inconnue" };
  const value = String(fd.get("value") || "").trim();
  if (fd.get("delete") === "1") { await deleteCredential(name); revalidatePath("/reglages"); return { ok: "Clé supprimée" }; }
  if (value.length < 8) return { error: "Clé trop courte" };
  await setCredential(name, value);
  revalidatePath("/reglages");
  revalidatePath("/conseils-ia/creer");
  revalidatePath("/conseils-ia/outil/[id]", "page");
  return { ok: "Clé enregistrée (chiffrée)" };
}

export async function grantMinutes(fd: FormData) {
  await requireAdmin();
  await prisma.creditLedger.create({ data: { userId: String(fd.get("userId")), minutes: Number(fd.get("minutes")) || 0, reason: "Ajout manuel" } });
  revalidatePath("/reglages");
}

// ——— Projets de clips ———
export async function createProject(fd: FormData) {
  const u = await requireUser();
  if (!(await featureEnabled("clips"))) throw new Error("Fonction désactivée");
  if (fd.get("rights") !== "on") throw new Error("Vous devez confirmer détenir les droits sur la vidéo");
  const url = String(fd.get("url") || "").trim();
  const min = Math.max(10, Math.min(90, Number(fd.get("minClipSec")) || 20));
  const max = Math.max(min + 5, Math.min(180, Number(fd.get("maxClipSec")) || 60));
  const p = await prisma.project.create({
    data: {
      userId: u.id, title: String(fd.get("title") || "") || (url ? "Vidéo importée" : "Nouveau projet"), language: String(fd.get("language") || "fr"),
      minClipSec: min, maxClipSec: max, clipCount: Math.max(1, Math.min(15, Number(fd.get("clipCount")) || 6)),
      captionStyle: String(fd.get("captionStyle") || "bold"), cropMode: String(fd.get("cropMode") || "center"), rightsAccepted: true, engineScript: pickEngine(SCRIPT_ENGINES, fd.get("engineScript")),
      status: url ? "queued" : "uploading",
      source: { create: { kind: url ? "url" : "upload", url: url || null } },
    },
  });
  if (url) await enqueue("pipeline", {}, p.id);
  return { id: p.id };
}

export async function retryProject(id: string) {
  const u = await requireUser();
  const p = await prisma.project.findFirst({ where: { id, userId: u.id } });
  if (!p) return;
  await prisma.project.update({ where: { id }, data: { status: "queued", error: null } });
  await enqueue("pipeline", {}, id);
  revalidatePath(`/projets/${id}`);
}

export async function deleteProject(id: string) {
  const u = await requireUser();
  await prisma.project.deleteMany({ where: { id, userId: u.id } });
  const fs = await import("node:fs");
  const { projectDir } = await import("@/lib/storage");
  fs.rmSync(projectDir(id), { recursive: true, force: true });
  redirect("/tableau-de-bord");
}

async function ownClip(clipId: string) {
  const u = await requireUser();
  const c = await prisma.clip.findFirst({ where: { id: clipId, project: { userId: u.id } }, include: { project: { include: { source: { include: { transcript: true } } } } } });
  if (!c) throw new Error("Clip introuvable");
  return { u, c };
}

export async function updateClip(fd: FormData) {
  const { c } = await ownClip(String(fd.get("clipId")));
  const dur = c.project.source?.durationSec ?? 1e9;
  const s = Math.max(0, Number(fd.get("startSec")));
  const e = Math.min(dur, Math.max(s + 3, Number(fd.get("endSec"))));
  const text = String(fd.get("caption") ?? "").trim();
  let captionOverride: string | null = c.captionOverride;
  if (fd.get("captionEdited") === "1") {
    // Texte corrigé : on répartit les mots sur les horodatages d'origine.
    const { wordsIn } = await import("@/lib/pipeline/candidates");
    const orig = wordsIn(JSON.parse(c.project.source!.transcript!.wordsJson), s, e);
    const nw = text.split(/\s+/).filter(Boolean);
    const span = orig.length ? { s: orig[0].s, e: orig[orig.length - 1].e } : { s, e };
    captionOverride = JSON.stringify(nw.map((w, i) => {
      if (orig.length === nw.length) return { w, s: orig[i].s, e: orig[i].e };
      const step = (span.e - span.s) / Math.max(1, nw.length);
      return { w, s: span.s + i * step, e: span.s + (i + 1) * step };
    }));
  } else if (s !== c.startSec || e !== c.endSec) captionOverride = null;
  await prisma.clip.update({
    where: { id: c.id },
    data: { startSec: s, endSec: e, title: String(fd.get("title") || c.title).slice(0, 80), style: String(fd.get("style") || c.style),
      cropOffset: Math.max(0, Math.min(1, Number(fd.get("cropOffset") ?? 0.5))), captionOverride, status: "pending" },
  });
  await enqueue("render_clip", { clipId: c.id }, c.projectId);
  revalidatePath(`/projets/${c.projectId}`);
}

export async function setClipStatus(clipId: string, status: "ready" | "discarded") {
  const { c } = await ownClip(clipId);
  await prisma.clip.update({ where: { id: c.id }, data: { status: status === "ready" && !c.filePath ? "pending" : status } });
  revalidatePath(`/projets/${c.projectId}`);
}

export async function publishClip(fd: FormData) {
  const u = await requireUser();
  const clipId = String(fd.get("clipId") || "") || undefined;
  const episodeId = String(fd.get("episodeId") || "") || undefined;
  if (clipId) await ownClip(clipId);
  if (episodeId && !(await prisma.episode.findFirst({ where: { id: episodeId, userId: u.id } }))) throw new Error("Vidéo introuvable");
  const when = String(fd.get("scheduledAt") || "");
  const scheduledAt = when ? new Date(when) : null;
  const platforms = fd.getAll("platform").map(String).filter(isPlatform);
  for (const platform of platforms) {
    if (!(await featureEnabled(PLATFORMS[platform].feature))) continue;
    const privacy = platform === "youtube" ? String(fd.get("ytPrivacy") || "private") : String(fd.get("privacy") || "SELF_ONLY");
    const pub = await prisma.publication.create({ data: { userId: u.id, clipId, episodeId, platform, caption: String(fd.get("caption") || ""), privacy, scheduledAt } });
    await enqueue("publish", { publicationId: pub.id }, undefined, scheduledAt ?? undefined);
  }
  revalidatePath("/", "layout");
}

export async function cancelPublication(id: string) {
  const u = await requireUser();
  await prisma.publication.updateMany({ where: { id, userId: u.id, state: "scheduled" }, data: { state: "failed", error: "Annulée" } });
  revalidatePath("/comptes");
}

// ——— Comptes connectés et publication automatique ———
export async function saveAutoPublish(fd: FormData) {
  const u = await requireUser();
  const times = String(fd.get("times") || "").split(/[,\s]+/).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, "0"));
  const data = { enabled: fd.get("enabled") === "on", platforms: fd.getAll("platforms").map(String).filter(isPlatform), times, clips: fd.get("clips") === "on", episodes: fd.get("episodes") === "on", privacy: String(fd.get("privacy") || "SELF_ONLY"), ytPrivacy: String(fd.get("ytPrivacy") || "private") };
  await prisma.user.update({ where: { id: u.id }, data: { autoPublishJson: JSON.stringify(data) } });
  revalidatePath("/comptes");
}

export async function disconnectAccount(platform: string) {
  const u = await requireUser();
  await prisma.socialAccount.deleteMany({ where: { userId: u.id, platform } });
  revalidatePath("/comptes");
}

export async function refreshStats() {
  const u = await requireUser();
  await enqueue("stats", { userId: u.id });
  revalidatePath("/statistiques");
}

// ——— Tendances ———
export async function refreshTrendsNow() {
  await requireAdmin();
  if (!(await prisma.job.count({ where: { type: "trends", state: { in: ["queued", "running"] } } }))) await enqueue("trends", {});
  revalidatePath("/tendances-du-moment");
}

// ——— Personnages, séries, épisodes IA ———
export async function createCharacter(fd: FormData) {
  const u = await requireUser();
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  const look = String(fd.get("look") || "").trim().slice(0, 1200);
  if (!name || !look) return;
  await prisma.character.create({ data: { userId: u.id, name, look, personality: String(fd.get("personality") || "").slice(0, 600), voice: String(fd.get("voice") || "alloy"), visualStyle: String(fd.get("visualStyle") || "cinématique réaliste").slice(0, 120) } });
  revalidatePath("/videos-ia");
}

export async function deleteCharacter(id: string) {
  const u = await requireUser();
  await prisma.character.deleteMany({ where: { id, userId: u.id } });
  revalidatePath("/videos-ia");
}

const clampDur = (v: unknown) => Math.max(15, Math.min(600, Number(v) || 60));

// IA choisies dans le formulaire d'une vidéo (composant EngineFields) ; vides = celles de Réglages.
function readEngines(fd: FormData) {
  const { visualMode, engineVideo } = parseVisuals(fd.get("visuals") ?? fd.get("visualMode"));
  const voice = String(fd.get("voice") || "").slice(0, 80);
  return {
    visualMode, engineVideo, engineScript: pickEngine(SCRIPT_ENGINES, fd.get("engineScript")), engineImage: pickEngine(IMAGE_ENGINES, fd.get("engineImage")),
    voice: isElevenVoice(voice) || VOICES.includes(voice) ? voice : null,
  };
}
type Engines = ReturnType<typeof readEngines>;

export async function createSeries(fd: FormData) {
  const u = await requireUser();
  const title = String(fd.get("title") || "").trim().slice(0, 80);
  const premise = String(fd.get("premise") || "").trim().slice(0, 2000);
  if (!title || !premise) return;
  const s = await prisma.series.create({ data: { userId: u.id, title, premise, characterId: String(fd.get("characterId") || "") || null, durationSec: clampDur(fd.get("durationSec")), language: String(fd.get("language") || "fr"), captionStyle: String(fd.get("captionStyle") || "bold"), ...readEngines(fd) } });
  if (fd.get("startNow") === "on") await startEpisode(u.id, { seriesId: s.id, brief: premise });
  revalidatePath("/videos-ia");
}

async function startEpisode(userId: string, o: { seriesId?: string; brief: string; origin?: string; durationSec?: number; characterId?: string | null; captionStyle?: string; language?: string; engines?: Engines; sourceUrl?: string | null; title?: string; queue?: boolean }) {
  let number = 1, dur = o.durationSec ?? 60, style = o.captionStyle ?? "bold", lang = o.language ?? "fr";
  let eng: Engines = o.engines ?? { visualMode: "image", engineVideo: null, engineScript: null, engineImage: null, voice: null };
  if (o.seriesId) {
    const s = await prisma.series.findFirstOrThrow({ where: { id: o.seriesId, userId } });
    number = (await prisma.episode.count({ where: { seriesId: s.id } })) + 1;
    dur = o.durationSec ?? s.durationSec; style = s.captionStyle; lang = s.language;
    // Un épisode de série reprend les IA choisies pour la série.
    if (!o.engines) eng = { visualMode: s.visualMode, engineVideo: s.engineVideo, engineScript: s.engineScript, engineImage: s.engineImage, voice: s.voice };
  }
  const ep = await prisma.episode.create({ data: {
    userId, seriesId: o.seriesId, number, title: o.title || (o.seriesId ? `Épisode ${number}` : "Nouvelle vidéo"), brief: o.brief.slice(0, 4000), origin: o.origin ?? (o.seriesId ? "series" : "manual"),
    durationSec: dur, captionStyle: style, language: lang, characterId: o.characterId ?? null, visualMode: eng.visualMode === "video" ? "video" : "image", engineVideo: eng.engineVideo, engineScript: eng.engineScript, engineImage: eng.engineImage, voice: eng.voice, sourceUrl: o.sourceUrl ?? null,
    status: o.queue === false ? "uploading" : "queued",
  } });
  if (o.queue !== false) await enqueue("episode", { episodeId: ep.id });
  return ep;
}

export async function nextEpisode(seriesId: string, fd?: FormData) {
  const u = await requireUser();
  const brief = String(fd?.get("brief") || "").trim();
  const s = await prisma.series.findFirstOrThrow({ where: { id: seriesId, userId: u.id } });
  await startEpisode(u.id, { seriesId, brief: brief || `Écris la suite de la série. ${s.premise}` });
  revalidatePath("/videos-ia");
}

export async function createEpisode(fd: FormData) {
  const u = await requireUser();
  if (!(await featureEnabled("aiVideos"))) throw new Error("Fonction désactivée");
  const brief = String(fd.get("brief") || "").trim();
  if (!brief) return;
  const ep = await startEpisode(u.id, { brief, origin: String(fd.get("origin") || "manual"), durationSec: clampDur(fd.get("durationSec")), characterId: String(fd.get("characterId") || "") || null,
    captionStyle: String(fd.get("captionStyle") || "bold"), language: String(fd.get("language") || "fr"), engines: readEngines(fd), title: String(fd.get("title") || "") || undefined });
  redirect(`/videos-ia/${ep.id}`);
}

// Reprendre une vidéo : lien ou fichier (envoyé ensuite par le navigateur), puis script original et génération.
export async function createRemix(fd: FormData) {
  const u = await requireUser();
  if (!(await featureEnabled("remix"))) throw new Error("Fonction désactivée");
  if (fd.get("rights") !== "on") throw new Error("Confirmez que vous pouvez utiliser cette vidéo comme source");
  const url = String(fd.get("url") || "").trim() || null;
  const ep = await startEpisode(u.id, {
    brief: String(fd.get("brief") || "Reprends la mécanique de cette vidéo.").slice(0, 2000), origin: "remix", sourceUrl: url, durationSec: clampDur(fd.get("durationSec")),
    characterId: String(fd.get("characterId") || "") || null, captionStyle: String(fd.get("captionStyle") || "bold"), language: String(fd.get("language") || "fr"),
    engines: readEngines(fd), title: "Vidéo reprise", queue: !!url,
  });
  return { id: ep.id };
}

export async function retryEpisode(id: string) {
  const u = await requireUser();
  const ep = await prisma.episode.findFirst({ where: { id, userId: u.id } });
  if (!ep) return;
  await prisma.episode.update({ where: { id }, data: { status: "queued", error: null } });
  await enqueue("episode", { episodeId: id });
  revalidatePath(`/videos-ia/${id}`);
}

export async function rewriteEpisode(id: string) {
  const u = await requireUser();
  const ep = await prisma.episode.findFirst({ where: { id, userId: u.id } });
  if (!ep) return;
  const fs = await import("node:fs");
  const { episodeDir } = await import("@/lib/pipeline/episode");
  const dir = episodeDir(id);
  for (const f of fs.readdirSync(dir)) if (!f.startsWith("source")) fs.rmSync(`${dir}/${f}`, { force: true });
  await prisma.episode.update({ where: { id }, data: { scriptJson: null, status: "queued", error: null, filePath: null, coverPath: null, thumbPath: null, progress: 0 } });
  await enqueue("episode", { episodeId: id });
  revalidatePath(`/videos-ia/${id}`);
}

export async function deleteEpisode(id: string) {
  const u = await requireUser();
  await prisma.episode.deleteMany({ where: { id, userId: u.id } });
  const fs = await import("node:fs");
  const { STORAGE_DIR } = await import("@/lib/storage");
  fs.rmSync(`${STORAGE_DIR}/episodes/${id}`, { recursive: true, force: true });
  redirect("/videos-ia");
}

// ——— Génération texte → image / vidéo ———
export async function createGeneration(fd: FormData) {
  const u = await requireUser();
  const kind = fd.get("kind") === "video" ? "video" : "image";
  if (!(await featureEnabled(kind === "video" ? "textToVideo" : "textToImage"))) throw new Error("Fonction désactivée");
  const prompt = String(fd.get("prompt") || "").trim().slice(0, 2000);
  if (!prompt) return;
  const g = await prisma.generation.create({ data: { userId: u.id, kind, prompt } });
  await enqueue("generate", { generationId: g.id });
  revalidatePath("/generer");
}

// « Créer avec l'IA » depuis Conseils IA : l'idée + les options du projet donnent le prompt.
export async function createFromAdvice(fd: FormData) {
  const u = await requireUser();
  const c = CREATORS[String(fd.get("projet"))];
  if (!c) return;
  const kind = c.video && fd.get("kind") === "video" ? "video" : "image";
  if (!(await featureEnabled(kind === "video" ? "textToVideo" : "textToImage"))) throw new Error("Fonction désactivée");
  const idea = String(fd.get("idea") || "").trim().slice(0, 1000);
  if (!idea) return;
  const opts = Object.fromEntries(c.fields.map((f) => {
    const v = String(fd.get(f.name) || "");
    return [f.name, f.choices.includes(v) ? v : f.choices[0]];
  }));
  const prompt = c.build(idea, opts).slice(0, 2000);
  const n = kind === "video" ? 1 : Math.min(4, Math.max(1, Number(fd.get("count")) || 1));
  for (let i = 0; i < n; i++) {
    const g = await prisma.generation.create({ data: { userId: u.id, kind, prompt } });
    await enqueue("generate", { generationId: g.id });
  }
  revalidatePath("/conseils-ia/creer");
  revalidatePath("/generer");
}

// Active « Texte → image » ou « Texte → vidéo » sans passer par Réglages (pages Créer avec l'IA et outils).
export async function enableFeature(fd: FormData) {
  await requireAdmin();
  const f = String(fd.get("feature"));
  if (f !== "textToImage" && f !== "textToVideo") return;
  const s = await getSettings();
  await prisma.appSettings.update({ where: { id: "global" }, data: { featuresJson: JSON.stringify({ ...s.features, [f]: true }) } });
  revalidatePath("/", "layout");
}

// ——— Outils de Conseils IA utilisés dans Clipr ———
const ID_RE = /^[\w.:-]{1,80}$/;

// Image, vidéo ou voix : mis en file comme une génération ; le worker appelle l'API de l'outil.
export async function createToolGeneration(fd: FormData) {
  const u = await requireUser();
  const t = TOOL_APPS[String(fd.get("tool"))];
  if (!t || t.kind === "text") return;
  if (t.feature && !(await featureEnabled(t.feature))) throw new Error("Fonction désactivée");
  const prompt = String(fd.get("prompt") || "").trim().slice(0, t.kind === "audio" ? 3000 : 2000);
  if (!prompt) return;
  const input: Record<string, string> = { prompt, ...pickOptions(t, (n) => fd.get(n) as string | null) };
  if (t.kind === "audio") {
    for (const n of ["voice_id", "model_id"]) { const v = String(fd.get(n) || ""); if (v && ID_RE.test(v)) input[n] = v; }
    if (!input.voice_id) throw new Error("Choisis une voix");
  }
  const n = t.kind === "image" ? Math.min(4, Math.max(1, Number(fd.get("count")) || 1)) : 1;
  for (let i = 0; i < n; i++) {
    const g = await prisma.generation.create({ data: { userId: u.id, kind: t.kind, prompt: `${t.name} · ${prompt}` } });
    await enqueue("generate", { generationId: g.id, tool: t.id, input });
  }
  revalidatePath(`/conseils-ia/outil/${t.id}`);
  revalidatePath("/generer");
}

export type TextToolState = { error?: string; text?: string } | undefined;

// ChatGPT ou Claude : réponse directe, affichée dans la page.
export async function runTextTool(_: TextToolState, fd: FormData): Promise<TextToolState> {
  const u = await requireUser();
  const t = TOOL_APPS[String(fd.get("tool"))];
  if (!t || t.kind !== "text") return { error: "Outil inconnu" };
  const idea = String(fd.get("prompt") || "").trim().slice(0, 2000);
  if (!idea) return { error: "Écris ton sujet" };
  const o = pickOptions(t, (n) => fd.get(n) as string | null);
  const model = String(fd.get("model") || "");
  try {
    const text = await chat({
      provider: t.key === "anthropic" ? "anthropic" : "openai", model: ID_RE.test(model) ? model : undefined,
      userId: u.id, purpose: `outil ${t.name}`, maxTokens: 2500,
      system: "Tu es scénariste et stratège de contenus courts (TikTok, Reels, Shorts) pour le public francophone. Tu écris des textes concrets, rythmés, prêts à tourner, sans inventer de chiffres ni de faits.",
      user: `Type : ${o.type}. Plateforme : ${o.platform}. Durée visée : ${o.length}. Ton : ${o.tone}.\nSujet : ${idea}\nRédige directement le résultat en français, prêt à utiliser, sans préambule.`,
    });
    return { text };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// ——— Coach TikTok ———
export async function runCoach(_: FormState, fd: FormData): Promise<FormState> {
  const u = await requireUser();
  if (!(await featureEnabled("tiktokCoach"))) return { error: "Fonction désactivée" };
  const niche = String(fd.get("niche") || "").slice(0, 300);
  const goal = String(fd.get("goal") || "").slice(0, 300);
  const freq = String(fd.get("freq") || "5");
  let snapshot = "Compte TikTok non connecté : conseils basés uniquement sur la niche.";
  if (fd.get("useAccount") === "on") {
    try {
      const s = await accountSnapshot(u.id);
      snapshot = JSON.stringify({ profil: s.user, videos: s.videos.map((v: Record<string, unknown>) => ({ titre: v.title || v.video_description, vues: v.view_count, likes: v.like_count, commentaires: v.comment_count, partages: v.share_count, duree: v.duration, date: v.create_time })) });
    } catch (e) { return { error: (e as Error).message }; }
  }
  try {
    const out = await chat({
      userId: u.id, purpose: "coach", maxTokens: 3500,
      system: "Tu es un coach TikTok francophone, concret et honnête. Tu t'appuies sur les chiffres fournis, tu n'inventes pas de statistiques. Réponds en Markdown simple avec des titres ##.",
      user: `Niche : ${niche}\nObjectif : ${goal}\nPublications par semaine visées : ${freq}\nDonnées du compte : ${snapshot}\n\nDonne : 1) ## Diagnostic (ce qui marche / ce qui ne marche pas, d'après les vidéos), 2) ## Planning sur 7 jours (jour, heure conseillée, idée, format), 3) ## 3 scripts prêts à tourner (accroche 3 s, déroulé, appel à l'action), 4) ## Prochaines actions (3 points).`,
    });
    await prisma.coachReport.create({ data: { userId: u.id, input: JSON.stringify({ niche, goal, freq }), output: out } });
    revalidatePath("/coach");
    return { ok: "Rapport généré" };
  } catch (e) { return { error: (e as Error).message }; }
}


export async function whoami() { return currentUser(); }
