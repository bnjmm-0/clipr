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
});
