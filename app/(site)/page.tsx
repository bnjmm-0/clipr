import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import ClipPreview from "@/components/ClipPreview";
import Icon from "@/components/Icon";
import OpeningFilm from "@/components/OpeningFilm";
import ScrollIntro from "@/components/ScrollIntro";
import AiCardFx from "@/components/AiCardFx";

// Une seule ouverture active à la fois : false = film en images (OpeningFilm),
// true = vidéo Magnific pilotée par le scroll (ScrollIntro, /intro.mp4).
const OUVERTURE_MAGNIFIC = false;

// Visuels générés avec Magnific (public/accueil/ et public/clips/), animés en boucles vidéo avec Higgsfield (même nom en .mp4).
// Boucle vidéo d'un visuel, seulement si le fichier existe : sinon l'image reste seule.
const loop = (img: string) => { const v = img.replace(".webp", ".mp4"); return existsSync(join(process.cwd(), "public", v)) ? v : null; };

const PLATFORMS = [["tiktok", "TikTok"], ["facebook", "Facebook"], ["youtube", "YouTube Shorts"]];

const MARQUEE = ["Transcription mot à mot", "Chaque passage noté sur 100", "Recadrage 9:16", "Sous-titres animés", "Miniature générée", "Publication planifiée", "Séries vidéo IA", "Tendances YouTube France", "Statistiques des comptes"];

const STEPS = [
  { img: "/clips/etape-1.webp", t: "Colle un lien ou importe ta vidéo", d: "Podcast, live, interview, conférence : même plusieurs heures." },
  { img: "/clips/etape-2.webp", t: "Clipr trouve les meilleurs moments", d: "Transcription mot à mot, chaque passage noté sur 100 : accroche, émotion, fin nette." },
  { img: "/clips/etape-3.webp", t: "Publie en vertical", d: "Recadrage qui suit la personne qui parle, sous-titres animés, miniature, publication." },
];

const FEATURES = [
  { img: "/accueil/f-clips.webp", glow: "245 217 10", icon: "clips", t: "Clips depuis une vidéo longue", d: "Transcription mot à mot, chaque passage noté sur 100, recadrage 9:16 qui suit la personne qui parle.", size: "wide" },
  { img: "/troupe/videos.webp", glow: "255 170 70", icon: "film", t: "Séries vidéo IA", d: "Tes fruits stars, une idée de série : chaque épisode est écrit, doublé avec la voix de chaque perso, animé et enregistré." },
  { img: "/accueil/f-remix.webp", glow: "80 200 255", icon: "copy", t: "Reprendre une vidéo", d: "Clipr analyse la structure d'une vidéo qui marche et écrit une version originale avec ton personnage." },
  { img: "/accueil/f-trends.webp", glow: "90 170 255", icon: "trend", t: "Tendances toutes les 6 h", d: "Les vidéos qui montent sur YouTube France et des idées prêtes à produire." },
  { img: "/accueil/f-publish.webp", glow: "255 200 80", icon: "send", t: "Publication planifiée", d: "TikTok, Facebook et YouTube : direct, planifié ou automatique sur tes créneaux." },
  { img: "/accueil/f-stats.webp", glow: "255 210 90", icon: "chart", t: "Statistiques des comptes", d: "Abonnés, vues, meilleures vidéos et meilleurs créneaux, relevés toutes les 6 h pour suivre la courbe.", size: "full" },
];

const STYLES = [["bold", "Pop"], ["bounce", "Rebond"], ["box", "Encadré"], ["typewriter", "Machine à écrire"]];

const AUDIENCES = [
  { img: "/accueil/aud-podcast.webp", glow: "255 180 90", t: "Podcasts", d: "Une heure d'épisode devient une semaine de clips." },
  { img: "/accueil/aud-streamer.webp", glow: "190 110 255", t: "Streamers", d: "Les meilleurs moments du live, prêts le lendemain." },
  { img: "/troupe/personnages.webp", glow: "245 200 90", t: "Comptes de fruits IA", d: "Une troupe de personnages, des feuilletons qui accrochent, publiés chaque jour." },
  { img: "/accueil/aud-coach.webp", glow: "255 200 120", t: "Coachs et conférenciers", d: "Tes conférences découpées en conseils courts." },
];

const FAQ = [
  ["Combien de clips par vidéo ?", "De 1 à 15 clips par projet, chacun entre 10 secondes et 3 minutes. Tu règles le nombre et la durée avant de lancer."],
  ["Quelles langues sont reconnues ?", "Français, anglais, arabe et espagnol, ou détection automatique de la langue parlée."],
  ["Sur quels réseaux puis-je publier ?", "TikTok, Facebook (Reels sur une Page) et YouTube Shorts : publication directe, à une date choisie ou automatique sur tes créneaux."],
  ["Je peux modifier les clips avant de publier ?", "Oui : style des sous-titres, recadrage (suivre le visage ou plan large), titre, légende et miniature."],
  ["Quelles vidéos ai-je le droit d'utiliser ?", <>Uniquement des vidéos dont tu détiens les droits ou pour lesquelles tu as l'autorisation. Le détail est dans les <Link href="/cgu" style={{ textDecoration: "underline" }}>conditions d'utilisation</Link>.</>],
  ["Faut-il une carte bancaire pour essayer ?", "Non, le premier essai se fait sans carte bancaire."],
] as const;

export default async function Home() {
  const u = await currentUser();
  const cta = u ? "/studio" : "/inscription";
  const paste = (
    <form action={cta} className="paste">
      <input name="url" aria-label="Lien de la vidéo" placeholder="Colle le lien d'une vidéo" />
      <button className="btn accent">Créer mes clips</button>
    </form>
  );
  return (
    <div className="landing">
    {OUVERTURE_MAGNIFIC
      ? <ScrollIntro />
      : <OpeningFilm cta={cta} label={u ? "Ouvrir l'appli" : "Essai gratuit"} />}
    <AiCardFx />
    <main className="wrap">
      <section className="hero lhero" id="produit">
        <span className="herobg" style={{ backgroundImage: "url(/troupe/hero.webp)", opacity: 0.45 }} aria-hidden>{loop("/troupe/hero.webp") && <video className="bgvid" src={loop("/troupe/hero.webp")!} muted loop playsInline preload="none" />}</span>
        <div className="enter">
          <span className="eyebrow"><i />Clips, séries IA, tendances, publication</span>
          <h2 className="h1">Tes vidéos longues deviennent des clips qui <span className="word">accrochent</span></h2>
          <p className="sub">Clipr trouve les meilleurs passages d'un podcast ou d'un live, les recadre en vertical avec des sous-titres animés, et les publie sur TikTok, Facebook et YouTube Shorts.</p>
          {paste}
          <div className="platforms">
            <span className="xs muted">Publie sur</span>
            {PLATFORMS.map(([k, l]) => <span key={k} className="pchip"><img src={`/stats/logo-${k}.png`} alt="" />{l}</span>)}
          </div>
          <p className="xs muted" style={{ marginTop: 14 }}>Premier essai sans carte bancaire · <Link href="/pourquoi" style={{ textDecoration: "underline" }}>Pourquoi Clipr</Link></p>
        </div>
        <ClipPreview />
      </section>
    </main>

    <div className="marquee" aria-label="Ce que fait Clipr">
      <div className="mtrack">
        {[0, 1].map((k) => (
          <div key={k} className="mgroup" aria-hidden={k === 1 || undefined}>
            {MARQUEE.map((m) => <span key={m}>{m}<b>✦</b></span>)}
          </div>
        ))}
      </div>
    </div>

    <main className="wrap">
      <section className="lsec">
        <div className="lhead">
          <span className="eyebrow"><i />Comment ça marche</span>
          <h2>Trois étapes, aucune timeline à monter</h2>
          <p className="sec">Tu donnes la vidéo, Clipr fait le tri et le montage. Tu gardes la main sur ce qui part en ligne.</p>
        </div>
        <div className="steps3">
          {STEPS.map((s, i) => (
            <div key={s.t} className="card stepcard" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="stepimg"><img src={s.img} alt="" loading="lazy" /><span className="stepnum num">{i + 1}</span></div>
              <h3>{s.t}</h3>
              <p className="small sec">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lsec">
        <div className="lhead">
          <span className="eyebrow"><i />Tout au même endroit</span>
          <h2>Bien plus qu'un découpeur de vidéos</h2>
          <p className="sec">Trouver l'idée, produire, publier, mesurer : Clipr couvre toute la chaîne des vidéos courtes.</p>
        </div>
        <div className="bento">
          {FEATURES.map((f) => (
            <div key={f.t} className={`card aitool bentocard ${f.size ?? ""}`} style={{ "--glow": f.glow } as React.CSSProperties}>
              <span className="aibg" style={{ backgroundImage: `url(${f.img})` }} aria-hidden>{loop(f.img) && <video className="aivid" src={loop(f.img)!} muted loop playsInline preload="none" />}</span>
              <span className="bicon"><Icon name={f.icon} /></span>
              <h3>{f.t}</h3>
              <p className="small sec">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lsec stylesec">
        <div className="lhead">
          <span className="eyebrow"><i />Sous-titres animés</span>
          <h2>Choisis le style de tes sous-titres</h2>
          <p className="sec">Le mot prononcé s'allume en rythme. Quatre styles, réglables à chaque projet.</p>
        </div>
        <div className="phones">
          {STYLES.map(([v, l], i) => (
            <figure key={v} className="lphone" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="pscreen"><img src={`/clips/style-${v}.webp`} alt={`Exemple de sous-titres style ${l}`} loading="lazy" /></div>
              <figcaption>{l}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="lsec">
        <div className="lhead">
          <span className="eyebrow"><i />Pour qui ?</span>
          <h2>Pensé pour ceux qui parlent longtemps</h2>
        </div>
        <div className="aud">
          {AUDIENCES.map((a) => (
            <div key={a.t} className="card aitool audcard" style={{ "--glow": a.glow } as React.CSSProperties}>
              <span className="aibg" style={{ backgroundImage: `url(${a.img})` }} aria-hidden />
              <h3>{a.t}</h3>
              <p className="small sec">{a.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lsec faqsec">
        <div className="lhead">
          <span className="eyebrow"><i />Questions fréquentes</span>
          <h2>Tout ce qu'il faut savoir</h2>
        </div>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p className="sec">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lcta">
        <span className="ctabg" aria-hidden>{loop("/accueil/cta.webp") && <video className="bgvid" src={loop("/accueil/cta.webp")!} muted loop playsInline preload="none" />}</span>
        <h2>Ta prochaine vidéo longue vaut une semaine de clips</h2>
        <p className="sec">Colle un lien, Clipr s'occupe du reste.</p>
        {paste}
        <p className="xs muted" style={{ marginTop: 12 }}>Premier essai sans carte bancaire</p>
      </section>
    </main>
    </div>
  );
}
