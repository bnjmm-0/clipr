// Faux serveur OpenAI pour les tests de bout en bout (aucun appel réel, aucun coût).
import http from "node:http";
const words = [];
const phrases = ["Bienvenue dans ce podcast sur la création de contenu.", "Le secret c'est la régularité, vraiment.", "Personne ne vous dit ça au début.", "Publiez chaque jour pendant un mois et regardez.", "Les chiffres vont vous surprendre, croyez-moi."];
let t = 0; const segments = [];
for (let r = 0; r < 2; r++) for (const p of phrases) { const s = t; for (const w of p.split(" ")) { words.push({ word: w, start: t, end: t + 0.35 }); t += 0.4; } segments.push({ text: p, start: s, end: t }); t += 0.3; }
http.createServer((req, res) => {
  let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url.endsWith("/audio/transcriptions")) return res.end(JSON.stringify({ text: phrases.join(" "), language: "french", words, segments }));
    if (req.url.endsWith("/chat/completions")) {
      const ids = [...body.matchAll(/#(\d+) \[/g)].map((m) => Number(m[1]));
      return res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ clips: ids.map((id) => ({ id, score: 90 - id, title: `Moment fort ${id}`, reason: "Accroche nette" })) }) } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } }));
    }
    res.statusCode = 404; res.end("{}");
  });
}).listen(4010, () => console.log("mock prêt"));
