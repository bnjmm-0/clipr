import Link from "next/link";
import { currentUser } from "@/lib/auth";
import ClipPreview from "@/components/ClipPreview";
import Icon from "@/components/Icon";
import OpeningFilm from "@/components/OpeningFilm";

const FEATURES = [
  { icon: "clips", t: "Clips depuis une vidéo longue", d: "Transcription mot à mot, chaque passage noté sur 100, recadrage 9:16 qui suit la personne qui parle." },
  { icon: "film", t: "Séries vidéo IA", d: "Un personnage, une idée de série, et chaque épisode est écrit, doublé, illustré et enregistré. Jusqu'à 10 minutes." },
  { icon: "copy", t: "Reprendre une vidéo", d: "Clipr analyse la structure d'une vidéo qui marche et écrit une version originale avec ton personnage." },
  { icon: "trend", t: "Tendances toutes les 6 h", d: "Les vidéos qui montent sur YouTube France, les recherches en hausse et des idées prêtes à produire." },
  { icon: "send", t: "TikTok et Facebook", d: "Publication directe, planifiée ou automatique sur tes créneaux, avec la miniature générée." },
  { icon: "chart", t: "Statistiques des comptes", d: "Abonnés, vues et meilleures vidéos, relevés toutes les 6 h pour suivre la courbe." },
];

export default async function Home() {
  const u = await currentUser();
  return (
    <>
    <OpeningFilm cta={u ? "/tableau-de-bord" : "/inscription"} label={u ? "Ouvrir l'appli" : "Essai gratuit"} />
    <main className="wrap">
      <section className="hero" id="produit">
        <div className="enter">
          <h2 className="h1">Tes vidéos longues deviennent des clips qui <span className="word">accrochent</span></h2>
          <p className="sub">Clipr trouve les meilleurs passages d'un podcast ou d'un live, les recadre en vertical avec des sous-titres animés, et les publie sur TikTok et Facebook.</p>
          <form action={u ? "/tableau-de-bord" : "/inscription"} className="paste">
            <input name="url" aria-label="Lien de la vidéo" placeholder="Colle le lien d'une vidéo" />
            <button className="btn accent">Créer mes clips</button>
          </form>
          <p className="xs muted" style={{ marginTop: 12 }}>Premier essai sans carte bancaire · <Link href="/pourquoi" style={{ textDecoration: "underline" }}>Pourquoi Clipr</Link></p>
        </div>
        <ClipPreview />
      </section>
      <section className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 1, background: "var(--line)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
        {FEATURES.map((f) => (
          <div key={f.t} style={{ background: "var(--bg)", padding: 24 }} className="stack-8">
            <span className="muted"><Icon name={f.icon} /></span>
            <h3>{f.t}</h3>
            <p className="small sec">{f.d}</p>
          </div>
        ))}
      </section>
    </main>
    </>
  );
}
