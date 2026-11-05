import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

process.env.ENCRYPTION_KEY ||= crypto.randomBytes(32).toString("base64");

test("chiffrement : aller-retour et altération détectée", async () => {
  const { seal, open } = await import("../lib/crypto");
  const s = seal("sk-test-1234567890", "cred:openai");
  assert.notEqual(s.ciphertext, "sk-test-1234567890");
  assert.equal(open(s, "cred:openai"), "sk-test-1234567890");
  assert.throws(() => open(s, "cred:anthropic")); // AAD différente
  assert.throws(() => open({ ...s, tag: Buffer.alloc(16).toString("base64") }, "cred:openai"));
});

test("candidats calés sur les fins de phrase et sélection sans chevauchement", async () => {
  const { buildCandidates, selectBest } = await import("../lib/pipeline/candidates");
  const segs = Array.from({ length: 40 }, (_, i) => ({ text: `Phrase numéro ${i}.`, s: i * 5, e: i * 5 + 4.8 }));
  const c = buildCandidates(segs, 20, 60);
  assert.ok(c.length > 3);
  for (const x of c) { assert.ok(x.e - x.s >= 20 && x.e - x.s <= 60); }
  const best = selectBest(c.map((x, i) => ({ ...x, score: 100 - i, title: "", reason: "" })), 5);
  for (let i = 1; i < best.length; i++) assert.ok(best[i].s >= best[i - 1].e);
});

test("sous-titres ASS animés : un événement par mot, styles valides", async () => {
  const { buildAss, CAPTION_STYLES } = await import("../lib/pipeline/captions");
  const words = "Ceci est un test des sous-titres animés.".split(" ").map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.35 }));
  for (const st of Object.keys(CAPTION_STYLES)) {
    const ass = buildAss(words, st, { hook: "Titre", duration: 5 });
    assert.equal((ass.match(/^Dialogue: 1/gm) ?? []).length, words.length);
    assert.match(ass, /\\t\(/); // animations présentes
  }
});

test("rendu FFmpeg complet d'un clip 9:16 (recadrage suivi + plan large)", { timeout: 120_000 }, async () => {
  const { run, probe } = await import("../lib/pipeline/ffmpeg");
  const { renderClip } = await import("../lib/pipeline/render");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clip-"));
  const src = path.join(dir, "src.mp4");
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc2=s=1280x720:r=30:d=8", "-f", "lavfi", "-i", "sine=f=440:d=8", "-c:v", "libx264", "-c:a", "aac", "-shortest", src]);
  const words = "On teste le rendu avec des mots animés qui sautent".split(" ").map((w, i) => ({ w, s: 1 + i * 0.4, e: 1.35 + i * 0.4 }));
  for (const [mode, keyframes] of [["center", [{ t: 0, x: 0.3 }, { t: 2, x: 0.7 }]], ["wide", []]] as const) {
    const out = path.join(dir, `out_${mode}.mp4`);
    await renderClip({ src, srcW: 1280, srcH: 720, s: 1, e: 6, words, style: "bounce", hook: "Accroche", cropMode: mode, cropOffset: 0.5, keyframes: [...keyframes], outFile: out, thumbFile: out.replace(".mp4", ".jpg") });
    const p = await probe(out);
    assert.equal(p.width, 1080); assert.equal(p.height, 1920);
    assert.ok(Math.abs(p.duration - 5) < 0.3, `durée ${p.duration}`);
    assert.ok(fs.existsSync(out.replace(".mp4", ".jpg")));
  }
});
