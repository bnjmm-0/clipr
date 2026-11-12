// Faux serveur d'IA pour tester Clipr sans clé ni coût : imite OpenAI, Anthropic, Groq, ElevenLabs, Replicate, xAI et Gemini.
// Lancer `npm run mock:ai` puis, dans un autre terminal, `npm run worker:mock` (worker branché sur ce serveur).
// Les réponses sont fabriquées avec FFmpeg (sons, dégradés, mires) ; les appels reçus s'affichent dans la console.
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clipr-mock-"));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const json = (res, o, code = 200) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
const body = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const ff = (...args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const tone = (secs, hz) => { const f = path.join(dir, `son_${++n}.mp3`); ff("-f", "lavfi", "-i", `sine=frequency=${hz}:duration=${secs.toFixed(2)}`, "-ac", "1", "-b:a", "64k", f); return fs.readFileSync(f); };
const picture = (filter) => { const f = path.join(dir, `img_${++n}.png`); ff("-f", "lavfi", "-i", filter, "-frames:v", "1", f); return fs.readFileSync(f); };
const formData = (req, buf) => new Request("http://x", { method: "POST", headers: { "content-type": req.headers["content-type"] }, body: buf }).formData();
let n = 0;

// Réponse d'un modèle de texte selon ce que Clipr demande (notes des clips, script de vidéo IA, autre).
function answer(user, wantJson) {
  const opt = user.indexOf("Options de création");
  if (opt >= 0) log("  options reçues :", user.slice(opt, opt + 700).split("\n").slice(1).join(" | "));
  if (/"recette"/.test(user)) return JSON.stringify({
    resume: "Deux fruits se disputent au bord d'une piscine ; la banane avoue tout à la fin.", format: "Dialogue entre personnages, gros plans", accroche: "Une gifle dès la première seconde",
    structure: [{ moment: "0-2 s", quoi: "La fraise gifle la banane" }, { moment: "2-10 s", quoi: "Dispute en champ-contrechamp" }, { moment: "10-15 s", quoi: "Révélation et cliffhanger" }],
    personnages: [{ nom: "Fraise", apparence: "Fraise brillante, grands yeux, lunettes roses", personnalite: "Jalouse" }, { nom: "Banane", apparence: "Banane musclée, chaîne dorée", personnalite: "Menteur" }],
    style: "3D hyperréaliste, golden hour", voix: "Voix françaises expressives", montage: "Plans de 2 s, sous-titres jaunes", outils: "Probablement un générateur d'images puis d'animation", pourquoi: ["Conflit immédiat", "Fin ouverte"],
    recette: { brief: "Un ananas jaloux découvre que la pastèque sort avec le melon", format: "dialogue", durationSec: 30, options: { genre: "drame", hook: "medias", ending: "cliffhanger", rhythm: "rapide", setting: "villa avec piscine", light: "golden", style: "3d", framing: "serre", inconnu: "x" },
      characters: [{ name: "Ananas", look: "Ananas anthropomorphe, couronne de feuilles, sourcils froncés", personality: "Jaloux, dramatique" }, { name: "Pastèque", look: "Pastèque ronde, sourire malicieux", personality: "Charmeuse" }] },
  });
  if (/Propose 3 versions/.test(user)) return JSON.stringify({ ideas: [1, 2, 3].map((i) => ({ title: `Idée de test ${i}`, idea: `Version ${i} : une accroche, un conflit, un retournement et une fin à suivre.` })) });
  if (/Analyse ce personnage/.test(user)) return JSON.stringify({ name: "Mangue Mimi", look: "mangue anthropomorphe orange et jaune, grands yeux bruns brillants, petite bouche souriante, bras et jambes fins, lunettes de soleil roses, collier de perles, peau lisse et brillante, 3D hyperréaliste façon film d'animation", personality: "coquette, sûre d'elle", style: "3D hyperréaliste façon film d'animation" });
  if (/donne un score de 0 à 100/.test(user)) {
    const ids = [...user.matchAll(/^#(\d+) \[/gm)].map((m) => Number(m[1]));
    return JSON.stringify({ clips: ids.map((id) => ({ id, score: 50 + ((id * 37) % 50), title: `Moment fort n°${id}`, reason: "Accroche claire et fin nette." })) });
  }
  if (/"scenes"/.test(user)) {
    const k = Number(user.match(/en (\d+) scènes/)?.[1] ?? 3);
    log("  scènes demandées :", k);
    const names = [...user.matchAll(/^- ([^:\n]+) : /gm)].map((m) => m[1]).filter((x) => !/^(Genre|Accroche|Fin|Public|Langage|Décor|Lumière|Style visuel|Cadrage|Inspiration)/.test(x));
    const dialogue = /"speaker"/.test(user) && names.length;
    return JSON.stringify({ title: "Épisode de test", hook: "Tu ne vas pas y croire", summary: "Un épisode de test.", scenes: Array.from({ length: k }, (_, i) => {
      const who = dialogue ? names[i % names.length] : null;
      return { ...(who ? { speaker: who } : {}), narration: who ? `${who} dit sa réplique numéro ${i + 1}.` : `Voici la scène numéro ${i + 1}, elle avance vite.`,
        visual: `Medium close-up, 50mm equivalent, ${who ? `the ${who}` : "a character"} in scene ${i + 1}, no text, no logo`,
        ...(/"motion"/.test(user) ? { motion: "Slow push-in, talks expressively. Keep everything exactly as in the starting image." } : {}) };
    }) });
  }
  return wantJson ? JSON.stringify({ ok: true }) : "Réponse de test.";
}

http.createServer(async (req, res) => {
  const buf = await body(req);
  const url = req.url.replace(/^\/v1/, "");
  if (url.startsWith("/files/")) { res.writeHead(200); return res.end(fs.readFileSync(path.join(dir, path.basename(url)))); }
  // Replicate Files API : le fichier envoyé est gardé et servi à l'adresse renvoyée.
  if (url === "/files" && req.method === "POST") {
    const f = (await formData(req, buf)).get("content"), name = `up_${++n}_${f.name}`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
    log("  replicate fichier reçu", f.name, f.size, "octets");
    return json(res, { id: name, urls: { get: `http://127.0.0.1:4010/v1/files/${name}` } }, 201);
  }
  const who = req.headers["x-goog-api-key"] ? "google" : req.headers["x-api-key"] ? "anthropic" : req.headers["xi-api-key"] ? "elevenlabs" : url.startsWith("/models/") ? "replicate" : url.startsWith("/videos") ? "xai" : "openai";
  log(who, req.method, url);
  if (!(req.headers.authorization ?? req.headers["x-api-key"] ?? req.headers["xi-api-key"] ?? req.headers["x-goog-api-key"])) return json(res, { error: { message: "no key" } }, 401);
  // Gemini (Interactions API) : texte, image, voix ou vidéo selon le modèle et response_format.
  if (url === "/interactions") {
    const b = JSON.parse(buf.toString()), kind = b.response_format?.type;
    const parts = (Array.isArray(b.input) ? b.input : [{ type: "text", text: String(b.input) }]).flatMap((p) => (p.type === "user_input" ? p.content : [p]));
    const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"), images = parts.filter((p) => p.type === "image").length;
    log("  gemini", b.model, kind ?? "texte", images ? `images jointes : ${images}` : "", b.generation_config?.speech_config ? `voix ${JSON.stringify(b.generation_config.speech_config)}` : "", b.response_format?.duration ?? "");
    const out = (block, usage = { total_input_tokens: 700, total_output_tokens: 250 }) => json(res, { id: `int_${++n}`, status: "completed", steps: [{ type: "user_input", content: parts }, { type: "model_output", content: [block] }], usage });
    if (b.model.includes("tts")) {
      const f = path.join(dir, `tts_${++n}.wav`); ff("-f", "lavfi", "-i", `sine=frequency=440:duration=${Math.max(1.5, text.split(/\s+/).length / 2.6).toFixed(2)}`, "-ar", "24000", "-ac", "1", f);
      return out({ type: "audio", mime_type: "audio/wav", data: fs.readFileSync(f).toString("base64") }, { total_input_tokens: 20, total_output_tokens: 160 });
    }
    if (kind === "image") return out({ type: "image", mime_type: "image/png", data: picture(`gradients=s=768x1344:c0=0x0b3d2e:c1=0x34d399:seed=${n}`).toString("base64") });
    if (kind === "video") {
      const f = path.join(dir, `omni_${++n}.mp4`); ff("-f", "lavfi", "-i", `testsrc2=s=720x1280:r=24:d=${parseInt(b.response_format.duration) || 10}`, "-f", "lavfi", "-i", "sine=frequency=300", "-shortest", "-pix_fmt", "yuv420p", f);
      return out({ type: "video", mime_type: "video/mp4", data: fs.readFileSync(f).toString("base64") });
    }
    return out({ type: "text", text: answer(text, b.response_format?.mime_type === "application/json") });
  }
  if (url === "/chat/completions") {
    const b = JSON.parse(buf.toString()), c = b.messages.at(-1).content;
    // Message avec images jointes : le texte est dans une des parties.
    const text = Array.isArray(c) ? c.filter((p) => p.type === "text").map((p) => p.text).join("\n") : c;
    if (Array.isArray(c)) log("  images jointes au message :", c.filter((p) => p.type === "image_url").length);
    return json(res, { choices: [{ message: { content: answer(text, b.response_format?.type === "json_object") } }], usage: { prompt_tokens: 900, completion_tokens: 300 } });
  }
  if (url === "/messages") {
    const b = JSON.parse(buf.toString());
    return json(res, { content: [{ type: "text", text: answer(b.messages.at(-1).content, true) }], usage: { input_tokens: 800, output_tokens: 250 } });
  }
  if (url === "/audio/transcriptions") {
    const fd = await formData(req, buf);
    const f = path.join(dir, `in_${++n}.mp3`); fs.writeFileSync(f, Buffer.from(await fd.get("file").arrayBuffer()));
    const d = dur(f), vocab = "alors voilà ce que personne ne te dit jamais sur la création de contenu et pourquoi ça marche vraiment".split(" ");
    const words = [], segments = []; let t = 0.2, seg = [];
    while (t < d - 0.5) {
      const w = vocab[words.length % vocab.length]; words.push({ word: w, start: t, end: t + 0.3 }); seg.push(w); t += 0.38;
      if (seg.length === 14 || /vraiment$/.test(w)) { segments.push({ text: seg.join(" ") + ".", start: words[words.length - seg.length].start, end: t }); seg = []; t += 0.4; }
    }
    if (seg.length) segments.push({ text: seg.join(" ") + ".", start: words[words.length - seg.length].start, end: t });
    return json(res, { text: segments.map((s) => s.text).join(" "), language: "french", words, segments });
  }
  if (url === "/audio/speech") { const b = JSON.parse(buf.toString()); res.writeHead(200, { "content-type": "audio/mpeg" }); return res.end(tone(Math.max(1.5, b.input.split(/\s+/).length / 2.6), 330)); }
  if (url.startsWith("/text-to-speech/")) { const b = JSON.parse(buf.toString()); log("  voix", url.split("/")[2].split("?")[0]); res.writeHead(200, { "content-type": "audio/mpeg" }); return res.end(tone(Math.max(1.5, b.text.split(/\s+/).length / 2.6), 520)); }
  if (url === "/voices") return json(res, { voices: [{ voice_id: "voix-test", name: "Léa", labels: { gender: "female", accent: "french" } }] });
  if (url === "/models" && who === "elevenlabs") return json(res, []);
  if (url === "/images/generations") return json(res, { data: [{ b64_json: picture(`gradients=s=1024x1536:c0=0x1a1206:c1=0xf5d90a:seed=${n}`).toString("base64") }] });
  if (url === "/images/edits") {
    const fd = await formData(req, buf);
    log("  références jointes :", fd.getAll("image[]").length);
    return json(res, { data: [{ b64_json: picture(`gradients=s=1024x1536:c0=0x2a0a12:c1=0xff4d6d:seed=${n}`).toString("base64") }] });
  }
  // xAI Grok Imagine : création de la vidéo puis interrogation de son état.
  if (url === "/videos/generations") {
    const b = JSON.parse(buf.toString()), name = `grok_${++n}.mp4`;
    ff("-f", "lavfi", "-i", `testsrc2=s=720x1280:r=24:d=${b.duration ?? 8}`, "-pix_fmt", "yuv420p", path.join(dir, name));
    log("  grok", b.model, JSON.stringify({ duration: b.duration, resolution: b.resolution, aspect_ratio: b.aspect_ratio, image: b.image ? "<image>" : undefined, prompt: String(b.prompt).slice(0, 50) }));
    return json(res, { request_id: name });
  }
  if (url.startsWith("/videos/")) return json(res, { status: "done", video: { url: `http://127.0.0.1:4010/v1/files/${path.basename(url)}` } });
  if (url.startsWith("/models/") && url.endsWith("/predictions")) {
    const b = JSON.parse(buf.toString()), model = url.slice(8, -12), video = !/flux/.test(model);
    const name = `rep_${++n}.${video ? "mp4" : "png"}`;
    if (video) ff("-f", "lavfi", "-i", `testsrc2=s=720x1280:r=24:d=${b.input.duration ?? 5}`, "-pix_fmt", "yuv420p", path.join(dir, name));
    else fs.writeFileSync(path.join(dir, name), picture("mandelbrot=s=768x1344"));
    const short = Object.fromEntries(Object.entries(b.input).map(([k, v]) => [k, typeof v === "string" && v.startsWith("data:") ? "<image>" : Array.isArray(v) ? v.map((x) => (String(x).startsWith("data:") ? "<image>" : x)) : typeof v === "string" ? v.slice(0, 50) : v]));
    log("  replicate", model, JSON.stringify(short));
    return json(res, { status: "succeeded", output: `http://127.0.0.1:4010/v1/files/${name}`, urls: { get: "" } }, 201);
  }
  json(res, { error: { message: `route inconnue ${url}` } }, 404);
}).listen(4010, "127.0.0.1", () => log(`faux serveur d'IA prêt sur http://127.0.0.1:4010 (fichiers dans ${dir})`));
