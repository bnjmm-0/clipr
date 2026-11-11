import { test } from "node:test";
import assert from "node:assert/strict";

test("créneaux de publication automatique : prochain créneau libre", async () => {
  const { nextSlot } = await import("../lib/autopublish");
  const from = new Date(2026, 10, 5, 10, 0);
  const a = nextSlot(["09:00", "18:00"], [], from)!;
  assert.equal(a.getHours(), 18); assert.equal(a.getDate(), 5);
  const b = nextSlot(["09:00", "18:00"], [a], from)!;
  assert.equal(b.getHours(), 9); assert.equal(b.getDate(), 6);
  assert.equal(nextSlot([], [], from), null);
});

test("vidéos IA : nombre de scènes et minutage des mots", async () => {
  const { sceneCount, timeWords } = await import("../lib/pipeline/episode");
  assert.equal(sceneCount(15), 3); assert.equal(sceneCount(60), 10); assert.equal(sceneCount(600), 60);
  const w = timeWords("Une phrase de test assez longue", 10, 3);
  assert.equal(w.length, 6);
  assert.ok(w[0].s === 10 && w.at(-1)!.e <= 13);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].s >= w[i - 1].e);
  // « ? » et « ! » restent collés au mot d'avant (jamais seuls à l'écran)
  assert.deepEqual(timeWords("Toi et Kiwi ? Non !", 0, 2).map((x) => x.w), ["Toi", "et", "Kiwi ?", "Non !"]);
});

test("YouTube : titre et description de Short, visibilité", async () => {
  const { shortMeta, ytPrivacy, quotaDayStart } = await import("../lib/providers/youtube");
  const m = shortMeta("Le meilleur passage <du> podcast\nDeuxième ligne");
  assert.equal(m.title, "Le meilleur passage du podcast #Shorts");
  assert.match(m.description, /Deuxième ligne\n\n#Shorts$/);
  const long = shortMeta("x".repeat(300));
  assert.ok(long.title.length <= 100 && long.title.endsWith("#Shorts"));
  assert.equal(shortMeta("Déjà tagué #shorts").title, "Déjà tagué #shorts");
  assert.equal(ytPrivacy("PUBLIC_TO_EVERYONE"), "public");
  assert.equal(ytPrivacy("MUTUAL_FOLLOW_FRIENDS"), "unlisted");
  assert.equal(ytPrivacy("SELF_ONLY"), "private");
  assert.equal(ytPrivacy(undefined), "private");
  const now = new Date("2026-11-06T12:00:00Z");
  const d = quotaDayStart(now);
  assert.ok(d <= now && now.getTime() - d.getTime() < 864e5);
  assert.equal(d.toLocaleString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }), "00");
});

test("personnage importé : son image est sa fiche, description courte", async () => {
  const { importedRef, isImported, LOOK_MAX } = await import("../lib/character-import");
  const ref = importedRef("abc");
  assert.ok(ref.endsWith("abc_import.png"));
  assert.equal(isImported({ id: "abc", refImagePath: ref }), true);
  assert.equal(isImported({ id: "abc", refImagePath: ref.replace("_import", "") }), false);
  assert.equal(isImported({ id: "abc", refImagePath: null }), false);
  assert.ok(LOOK_MAX <= 300);
});

test("Gemini : moteurs, modèle du script et voix", async () => {
  const { scriptModel, defaultScriptEngine, defaultImageEngine, isGeminiVoice, GEMINI_VOICES } = await import("../lib/engines");
  const openai = { llmProvider: "openai", llmModel: "gpt-4o-mini" };
  assert.deepEqual(scriptModel("gemini", openai), { provider: "google", model: "gemini-3.8-flash" });
  assert.deepEqual(scriptModel(null, { llmProvider: "google", llmModel: "gemini-3.5-flash-lite" }), { provider: "google", model: "gemini-3.5-flash-lite" });
  assert.deepEqual(scriptModel("gpt", openai), { provider: "openai", model: "gpt-4o-mini" });
  assert.equal(defaultScriptEngine({ llmProvider: "google", llmModel: "" }), "gemini");
  assert.equal(defaultImageEngine({ imageProvider: "google" }), "gemini-image");
  assert.equal(GEMINI_VOICES.length, 30);
  assert.equal(isGeminiVoice("gemini:Kore"), true);
  assert.equal(isGeminiVoice("gemini:Inconnue"), false);
  assert.equal(isGeminiVoice("alloy"), false);
});

test("sous-titres : « Aucun sous-titre » garde l'accroche, « Aucun texte » n'affiche rien", async () => {
  const { buildAss } = await import("../lib/pipeline/captions");
  const words = [{ w: "Salut", s: 0, e: 0.4 }, { w: "toi", s: 0.4, e: 0.8 }];
  const count = (ass: string, style: string) => (ass.match(new RegExp(`,${style},`, "g")) ?? []).length;
  const bold = buildAss(words, "bold", { hook: "Accroche", duration: 2 });
  assert.ok(count(bold, "Cap") > 0 && count(bold, "Hook") === 1);
  const none = buildAss(words, "none", { hook: "Accroche", duration: 2 });
  assert.equal(count(none, "Cap"), 0); assert.equal(count(none, "Hook"), 1);
  const notext = buildAss(words, "notext", { hook: "Accroche", duration: 2 });
  assert.equal(count(notext, "Cap"), 0); assert.equal(count(notext, "Hook"), 0);
});

test("aide à l'idée : les recettes reprennent les personnages cochés", async () => {
  const { STORY_RECIPES, fillRecipe } = await import("../lib/story-ideas");
  assert.ok(STORY_RECIPES.length >= 6);
  const r = STORY_RECIPES[0];
  const two = fillRecipe(r, "video", ["Pomito", "Bananou"]);
  assert.ok(two.includes("Pomito") && two.includes("Bananou") && !/\{[ABC]\}/.test(two));
  const none = fillRecipe(r, "series", []);
  assert.ok(/fraise|banane|kiwi/i.test(none) && !/\{[ABC]\}/.test(none));
});
