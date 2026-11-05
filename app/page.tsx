import Link from "next/link";
import { currentUser } from "@/lib/auth";

const features = [
  { ic: "✂️", t: "Moments forts détectés", d: "La transcription mot à mot et un LLM notent chaque passage : accroche, émotion, fin nette." },
  { ic: "📱", t: "Recadrage 9:16 intelligent", d: "Le cadre suit le visage du locuteur, ou garde le plan large sur un fond flou animé." },
  { ic: "✨", t: "Sous-titres en motion design", d: "Pop, rebond, encadré, machine à écrire : le mot prononcé s'anime en rythme." },
  { ic: "🚀", t: "Publication TikTok", d: "Envoi direct ou planifié via l'API officielle, depuis votre propre app développeur." },
  { ic: "🎨", t: "Texte → image et vidéo", d: "Générez visuels et B-roll IA avec le fournisseur de votre choix." },
  { ic: "🧭", t: "Coach TikTok", d: "Diagnostic de vos vidéos, planning de la semaine et scripts prêts à tourner." },
];

export default async function Home() {
  const u = await currentUser();
  return (
    <main>
      <section className="hero">
        <div className="wrap">
          <span className="pill reveal">Vidéo longue → clips viraux</span>
          <h1 className="reveal d1" style={{ marginTop: 18 }}>
            Colle un lien,<br />récupère tes <span className="grad">meilleurs moments</span>,<br />
            <span className="cycle"><span>poste.</span><span>sur TikTok.</span><span>sur Reels.</span><span>sur Shorts.</span></span>
          </h1>
          <p className="muted reveal d2" style={{ maxWidth: 520, fontSize: 18 }}>Podcasts, interviews, lives : l'appli trouve les passages qui accrochent, recadre en vertical et ajoute des sous-titres animés. Sans montage.</p>
          <form action={u ? "/tableau-de-bord" : "/inscription"} className="cta-box reveal d3">
            <input name="url" placeholder="https://… ou importe ton fichier à l'étape suivante" />
            <button className="btn">Créer mes clips</button>
          </form>
          <p className="small muted reveal d4" style={{ marginTop: 10 }}>Essai gratuit, sans carte bancaire.</p>
        </div>
        <div className="phones" aria-hidden>
          {[["ÇA", "A", "TOUT", "CHANGÉ"], ["LE", "SECRET", "C'EST"]].map((ws, i) => (
            <div className="phone" key={i}>
              <div className="cap">{ws.map((w, k) => <span key={k} className={k === 1 ? "hl" : ""} style={{ animationDelay: `${0.3 + k * 0.25 + i * 0.6}s` }}>{w}&nbsp;</span>)}</div>
              <div className="bar" style={{ animationDelay: `${-i * 1.5}s` }} />
            </div>
          ))}
        </div>
      </section>
      <section className="wrap page">
        <div className="grid g3">
          {features.map((f, i) => (
            <div key={f.t} className="card feature reveal" style={{ animationDelay: `${i * 0.07}s` }}>
              <div className="ic">{f.ic}</div><h3>{f.t}</h3><p className="muted small">{f.d}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 50 }}>
          <Link href={u ? "/tableau-de-bord" : "/inscription"} className="btn">Essayer maintenant</Link>
        </div>
      </section>
    </main>
  );
}
