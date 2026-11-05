// Faux services (OpenAI, YouTube, Google Trends) pour les tests et la démo : aucun appel réel, aucun coût.
// Les données renvoyées sont des exemples et doivent être présentées comme telles.
import http from "node:http";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mock-"));
const words = [];
const phrases = ["Bienvenue dans ce podcast sur la création de contenu.", "Le secret c'est la régularité, vraiment.", "Personne ne vous dit ça au début.", "Publiez chaque jour pendant un mois et regardez.", "Les chiffres vont vous surprendre, croyez-moi."];
let t = 0; const segments = [];
for (let r = 0; r < 4; r++) for (const p of phrases) { const s = t; for (const w of p.split(" ")) { words.push({ word: w, start: t, end: t + 0.35 }); t += 0.4; } segments.push({ text: p, start: s, end: t }); t += 0.3; }
const PALETTE = ["0x2b4c7e", "0x7e2b4c", "0x2b7e5c", "0x7e6a2b", "0x4c2b7e", "0x2b6e7e"];
let imgN = 0;

function sceneScript(body) {
  const n = Number(body.match(/en (\d+) scènes/)?.[1] ?? 4);
  const lines = ["Tu crois que réussir sur TikTok demande de la chance ?", "Faux. Ça demande une méthode.", "Première règle : accroche en trois secondes.", "Deuxième règle : une seule idée par vidéo.", "Troisième règle : poste au même moment chaque jour.", "Et surtout, regarde tes chiffres chaque semaine.", "Abonne-toi pour la suite."];
  return { title: "Trois règles pour percer", hook: "Personne ne te dit ça", summary: "Le coach donne trois règles simples pour percer sur TikTok. Il insiste sur la régularité.", scenes: Array.from({ length: n }, (_, i) => ({ narration: lines[i % lines.length], visual: `scene ${i + 1}` })) };
}

http.createServer((req, res) => {
  const chunks = []; req.on("data", (d) => chunks.push(d)); req.on("end", () => {
    const body = Buffer.concat(chunks).toString("latin1"); const text8 = Buffer.concat(chunks).toString("utf8");
    const url = req.url;
    const json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); };
    if (url.endsWith("/audio/transcriptions")) return json({ text: phrases.join(" "), language: "french", words, segments });
    if (url.endsWith("/audio/speech")) {
      const input = JSON.parse(body).input ?? "";
      const dur = Math.max(1.2, input.split(/\s+/).length / 2.6);
      const f = path.join(tmp, `tts${Date.now()}.mp3`);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `sine=f=220:d=${dur.toFixed(2)}`, "-af", "volume=0.05", "-b:a", "64k", f]);
      res.setHeader("content-type", "audio/mpeg"); return res.end(fs.readFileSync(f));
    }
    if (url.endsWith("/images/generations")) {
      const f = path.join(tmp, `img${imgN}.png`);
      const c = PALETTE[imgN++ % PALETTE.length];
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `gradients=s=1024x1536:c0=${c}:c1=0x111111:x0=0:y0=0:x1=1024:y1=1536:d=1`, "-frames:v", "1", f]);
      return json({ data: [{ b64_json: fs.readFileSync(f).toString("base64") }] });
    }
    if (url.endsWith("/chat/completions")) {
      let content;
      if (body.includes('\\"scenes\\"')) content = sceneScript(text8);
      else if (body.includes('\\"ideas\\"')) content = { ideas: [
        { title: "La routine du matin des créateurs", hook: "Je poste à 7 h depuis 30 jours", angle: "Montrer la routine réelle, minute par minute.", format: "face caméra", why: "La recherche « routine matinale » grimpe.", source: "routine matinale" },
        { title: "Le match commenté en 30 secondes", hook: "Ce but a tout changé", angle: "Résumer le moment clé avec une voix off.", format: "vidéo IA", why: "Le match de la veille est en tête des recherches.", source: "match de la veille" },
        { title: "Trois erreurs de débutant", hook: "J'ai fait les trois", angle: "Une erreur par scène, une solution par erreur.", format: "clip", why: "Format qui marche sur les podcasts du moment.", source: "podcast business" },
      ] };
      else if (body.includes("Diagnostic")) content = null;
      else { const ids = [...body.matchAll(/#(\d+) \[/g)].map((m) => Number(m[1])); content = { clips: ids.map((id) => ({ id, score: 92 - id * 3, title: ["Publie chaque jour pendant un mois", "Personne ne te dit ça au début", "Les chiffres vont te surprendre", "La régularité avant tout"][(id - 1) % 4], reason: "Accroche nette, fin claire" })) }; }
      const text = content ? JSON.stringify(content) : "## Diagnostic\nTes vidéos courtes de moins de 30 s retiennent mieux.\n## Planning sur 7 jours\n- Lundi 19 h : coulisses\n## Prochaines actions\n- Poster à heure fixe";
      return json({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 1200, completion_tokens: 400 } });
    }
    if (url.startsWith("/youtube/videos")) {
      const now = Date.now();
      const v = (id, title, channel, h, views, dur, cat) => ({ id, snippet: { title, channelTitle: channel, publishedAt: new Date(now - h * 36e5).toISOString(), categoryId: cat, thumbnails: { medium: { url: `http://127.0.0.1:4010/thumb/${id}.jpg` } } }, statistics: { viewCount: String(views) }, contentDetails: { duration: dur } });
      return json({ items: [
        v("a1", "Exemple · Interview fleuve d'un entrepreneur", "Chaîne exemple A", 9, 412000, "PT1H42M", "22"),
        v("a2", "Exemple · Podcast sport, l'après-match", "Chaîne exemple B", 14, 388000, "PT58M", "17"),
        v("a3", "Exemple · Live cuisine du dimanche", "Chaîne exemple C", 20, 301000, "PT2H5M", "26"),
        v("a4", "Exemple · Débat tech de la semaine", "Chaîne exemple D", 30, 296000, "PT1H11M", "28"),
        v("a5", "Exemple · Documentaire voyage", "Chaîne exemple E", 40, 254000, "PT48M", "19"),
        v("a6", "Exemple · Clip musical", "Chaîne exemple F", 6, 900000, "PT3M30S", "10"),
      ] });
    }
    if (url.startsWith("/thumb/")) {
      const f = path.join(tmp, `t${url.length}.jpg`);
      execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `gradients=s=320x180:c0=${PALETTE[url.length % 6]}:c1=0x111111:d=1`, "-frames:v", "1", f]);
      res.setHeader("content-type", "image/jpeg"); return res.end(fs.readFileSync(f));
    }
    if (url.startsWith("/rss")) {
      res.setHeader("content-type", "application/rss+xml");
      const items = [["routine matinale", "20 000+"], ["match de la veille", "100 000+"], ["recette airfryer", "10 000+"], ["podcast business", "5 000+"]];
      return res.end(`<?xml version="1.0"?><rss><channel>${items.map(([q, tr]) => `<item><title>${q}</title><ht:approx_traffic>${tr}</ht:approx_traffic><ht:news_item_title>Article d'exemple sur ${q}</ht:news_item_title></item>`).join("")}</channel></rss>`);
    }
    res.statusCode = 404; res.end("{}");
  });
}).listen(4010, () => console.log("mock prêt"));
