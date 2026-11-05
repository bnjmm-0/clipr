import Link from "next/link";
import Icon from "@/components/Icon";

export const metadata = { title: "Pourquoi Clipr" };

const ROWS: [string, string, string][] = [
  ["Clips, vidéos IA, tendances et statistiques", "Au même endroit", "Un outil par tâche"],
  ["Personnage IA réutilisé d'un épisode à l'autre", "Oui, avec la mémoire de la série", "À redécrire à chaque fois"],
  ["Durée d'une vidéo IA", "Réglable de 15 s à 10 min", "Souvent des plans de quelques secondes"],
  ["Sous-titres animés mot à mot", "4 styles, mot prononcé surligné", "À monter à la main"],
  ["Publication TikTok et Facebook", "Directe, planifiée ou automatique", "Un outil de planification en plus"],
  ["Miniature", "Générée à la fin du rendu", "À faire dans un éditeur d'image"],
  ["Idées de vidéos", "Mises à jour toutes les 6 h", "Veille manuelle"],
];

const REASONS = [
  { icon: "clips", t: "Une vidéo longue, dix clips prêts", d: "Clipr transcrit chaque mot, note chaque passage sur l'accroche, l'émotion et la fin, puis garde les meilleurs sans qu'ils se chevauchent. Tu ajustes début, fin, texte et cadre avant de publier." },
  { icon: "film", t: "Des séries qui se suivent", d: "Tu crées un personnage une fois : humain, animal, objet, mascotte. Chaque nouvel épisode reprend son apparence, sa voix et ce qui s'est passé avant. Les épisodes sont enregistrés au fur et à mesure." },
  { icon: "trend", t: "Savoir quoi poster aujourd'hui", d: "Toutes les 6 h, Clipr relève les vidéos longues qui prennent le plus de vues par heure en France et les recherches en hausse, puis propose des idées adaptées à ton thème." },
];

const FAQ = [
  ["Puis-je clipper n'importe quelle vidéo ?", "Seulement celles dont tu as les droits ou dont l'auteur autorise le clipping. Clipr te demande de le confirmer à chaque import."],
  ["Quelles langues ?", "Français, anglais, arabe, espagnol et détection automatique pour la transcription. Les vidéos IA sont écrites et doublées dans la langue choisie."],
  ["Les contenus IA sont-ils signalés ?", "Oui. Clipr te rappelle de les indiquer comme générés par IA au moment de publier."],
];

export default function Pourquoi() {
  return (
    <main className="wrap">
      <section style={{ padding: "96px 0 64px", maxWidth: 760 }} className="enter">
        <h1 style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: "-.03em" }}>Un seul outil pour trouver l'idée, faire la vidéo et la <span className="word">publier</span></h1>
        <p className="sec" style={{ fontSize: 19, lineHeight: "29px", marginTop: 20, maxWidth: "34rem" }}>Clips depuis tes vidéos longues, séries IA avec tes personnages, tendances du moment et publication sur TikTok et Facebook.</p>
        <div className="row" style={{ marginTop: 32 }}><Link href="/inscription" className="btn accent lg">Essayer gratuitement</Link><Link href="/tendances" className="btn ghost lg">Voir les tendances</Link></div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
        {REASONS.map((r) => (
          <div key={r.t} className="stack-8"><span className="muted"><Icon name={r.icon} /></span><h2>{r.t}</h2><p className="sec small">{r.d}</p></div>
        ))}
      </section>

      <section style={{ marginTop: 96 }}>
        <h2 style={{ fontFamily: "var(--display)", fontSize: 32, letterSpacing: "-.02em", marginBottom: 24 }}>Clipr ou quatre outils séparés</h2>
        <div className="panel" style={{ padding: "8px 24px" }}>
          <table className="cmp">
            <thead><tr><th>Ce qui compte</th><th>Clipr</th><th>Outils séparés</th></tr></thead>
            <tbody>{ROWS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td className="y">{b}</td><td className="n">{c}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 96, maxWidth: 760 }}>
        <h2 style={{ fontFamily: "var(--display)", fontSize: 32, letterSpacing: "-.02em", marginBottom: 24 }}>Questions fréquentes</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} style={{ borderBottom: "1px solid var(--line)", padding: "16px 0" }}>
            <summary style={{ cursor: "pointer", fontWeight: 500 }}>{q}</summary>
            <p className="sec small" style={{ marginTop: 8 }}>{a}</p>
          </details>
        ))}
        <div className="row" style={{ marginTop: 40 }}><Link href="/inscription" className="btn accent lg">Créer mes premiers clips</Link></div>
      </section>
    </main>
  );
}
