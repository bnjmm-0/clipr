"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { checkPassword, createSession, currentUser, destroySession, hashPassword, requireAdmin, requireUser } from "@/lib/auth";
import { CREDENTIALS, FEATURES, deleteCredential, featureEnabled, getSettings, setCredential, type CredentialName } from "@/lib/settings";
import { enqueue } from "@/lib/jobs";
import { chat } from "@/lib/providers/llm";
import { accountSnapshot } from "@/lib/providers/tiktok";

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
  const max = Math.max(min + 5, Math.min(120, Number(fd.get("maxClipSec")) || 60));
  const p = await prisma.project.create({
    data: {
      userId: u.id, title: String(fd.get("title") || "") || (url ? "Vidéo importée" : "Nouveau projet"), language: String(fd.get("language") || "fr"),
      minClipSec: min, maxClipSec: max, clipCount: Math.max(1, Math.min(15, Number(fd.get("clipCount")) || 6)),
      captionStyle: String(fd.get("captionStyle") || "bold"), cropMode: String(fd.get("cropMode") || "center"), rightsAccepted: true,
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
  const { c } = await ownClip(String(fd.get("clipId")));
  if (!(await featureEnabled("tiktokPublish"))) throw new Error("Publication désactivée");
  const when = String(fd.get("scheduledAt") || "");
  const scheduledAt = when ? new Date(when) : null;
  const pub = await prisma.publication.create({ data: { clipId: c.id, platform: "tiktok", caption: String(fd.get("caption") || c.title), scheduledAt } });
  await enqueue("publish", { publicationId: pub.id, privacy: String(fd.get("privacy") || "SELF_ONLY") }, c.projectId, scheduledAt ?? undefined);
  revalidatePath(`/projets/${c.projectId}`);
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

export async function disconnectTikTok() {
  const u = await requireUser();
  await prisma.socialAccount.deleteMany({ where: { userId: u.id, platform: "tiktok" } });
  revalidatePath("/coach");
}

export async function whoami() { return currentUser(); }
