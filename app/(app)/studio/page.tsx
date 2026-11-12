import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { credentialStatus, getSettings } from "@/lib/settings";
import AiCardFx from "@/components/AiCardFx";
import PageHero from "@/components/PageHero";
import Icon from "@/components/Icon";
import Poller from "@/components/Poller";
import { nextEpisode } from "@/app/actions";

// Accueil du client après connexion : « Que veux-tu faire ? », démarrage guidé et dernières vidéos
// avec la prochaine action à faire (valider, voir le problème, publier).
export default async function Studio() {
  const u = await requireUser();
  const s = await getSettings();
  const [creds, characters, series, episodes, accounts] = await Promise.all([
    credentialStatus(),
    prisma.character.count({ where: { userId: u.id } }),
    prisma.series.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 1, include: { _count: { select: { episodes: true } } } }),
    prisma.episode.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 5, include: { series: true } }),
    prisma.socialAccount.count({ where: { userId: u.id } }),
  ]);
  const aiKey = !!(creds.google || creds.openai);
  const firstReady = episodes.some((e) => e.status === "ready") || (await prisma.episode.count({ where: { userId: u.id, status: "ready" } })) > 0;
  const admin = u.role === "admin";
  const steps = [
    { done: aiKey, t: "Brancher une IA", d: "Une clé Google Gemini suffit pour tout (scripts, images, voix, animation).", href: admin ? "/reglages" : null, cta: "Ajouter la clé" },
    { done: characters >= 2, t: "Créer ta troupe", d: `2 à 4 fruits, chacun avec sa voix${characters ? ` (tu en as ${characters})` : ""}.`, href: "/personnages", cta: "Créer un personnage" },
    { done: episodes.length > 0, t: "Lancer ta première vidéo", d: "Une idée, tes persos cochés, et c'est parti.", href: "/videos-ia", cta: "Créer une vidéo" },
    { done: firstReady, t: "Valider et récupérer ta vidéo", d: "Tu vérifies le storyboard, puis Clipr fait les voix et le montage.", href: episodes[0] ? `/videos-ia/${episodes[0].id}` : "/videos-ia", cta: "Voir ma vidéo" },
    { done: accounts > 0, t: "Connecter TikTok", d: "Pour publier en un clic, ou automatiquement.", href: "/comptes", cta: "Connecter" },
  ].filter((x) => x.href);
  const left = steps.filter((x) => !x.done).length;
  const last = series[0];
  // Prochaine action d'une vidéo, selon son état.
  const next = (e: (typeof episodes)[number]): [string, string] =>
    e.status === "review" ? ["À valider : vérifie le storyboard", "live"]
    : e.status === "failed" ? ["Problème : ouvre-la pour le voir", "err"]
    : e.status === "ready" ? ["Prête : télécharge ou publie", "ok"]
    : [`En cours · ${e.stage}`, "live"];

  return (
    <div className="page">
      <AiCardFx />
      <Poller active={episodes.some((e) => ["queued", "processing"].includes(e.status))} ms={5000} />
      <PageHero name="hero" title={<>Que veux-tu <span className="word">tourner</span> aujourd'hui ?</>}>
        <p className="sec" style={{ marginTop: 8 }}>Fraise, Banane, Kiwi et Pêche sont prêts. Choisis ce que tu veux faire, Clipr s'occupe du reste.</p>
      </PageHero>

      <div className="studiogo">
        <Link href="/videos-ia" className="panel aitool studiocard"><span className="aibg" style={{ backgroundImage: "url(/troupe/videos.webp)" }} aria-hidden />
          <span className="studioicon"><Icon name="film" /></span><b>Créer une vidéo</b><span className="xs sec">Une idée et tes persos : script, images, voix et montage.</span></Link>
        {last ? (
          <form action={nextEpisode.bind(null, last.id)} className="panel aitool studiocard"><span className="aibg" style={{ backgroundImage: "url(/troupe/statistiques.webp)" }} aria-hidden />
            <span className="studioicon"><Icon name="play" /></span><b>Épisode {last._count.episodes + 1} de « {last.title} »</b><span className="xs sec">Clipr écrit la suite en se souvenant des épisodes d'avant.</span>
            <button className="btn accent sm" style={{ marginTop: 10, alignSelf: "flex-start" }}>Créer l'épisode suivant</button></form>
        ) : (
          <Link href="/videos-ia#series" className="panel aitool studiocard"><span className="aibg" style={{ backgroundImage: "url(/troupe/statistiques.webp)" }} aria-hidden />
            <span className="studioicon"><Icon name="layers" /></span><b>Lancer une série</b><span className="xs sec">Les mêmes persos, un épisode par jour : c'est ce qui fait revenir les gens.</span></Link>
        )}
        <Link href="/personnages" className="panel aitool studiocard"><span className="aibg" style={{ backgroundImage: "url(/troupe/personnages.webp)" }} aria-hidden />
          <span className="studioicon"><Icon name="user" /></span><b>Créer un personnage</b><span className="xs sec">Un fruit, un look, une voix. Ou importe le tien.</span></Link>
        <Link href={s.features.aiVideos ? "/inspiration" : "/tendances-du-moment"} className="panel aitool studiocard"><span className="aibg" style={{ backgroundImage: "url(/troupe/inspiration.webp)" }} aria-hidden />
          <span className="studioicon"><Icon name="spark" /></span><b>Trouver une idée qui marche</b><span className="xs sec">Les vidéos de fruits qui explosent, et « Refaire dans Clipr ».</span></Link>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24, alignItems: "start", marginTop: 24 }}>
        <div className="panel">
          <h2>{left ? `Démarrage guidé · encore ${left} étape${left > 1 ? "s" : ""}` : "Tout est prêt 🎉"}</h2>
          <ol className="studiosteps">
            {steps.map((x, i) => (
              <li key={i} className={x.done ? "done" : ""}>
                <span className="dot">{x.done ? <Icon name="check" /> : i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}><b className="small">{x.t}</b><div className="xs sec">{x.d}</div></div>
                {!x.done && <Link href={x.href!} className="btn sm">{x.cta}</Link>}
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <div className="row"><h2 style={{ flex: 1 }}>Mes dernières vidéos</h2><Link href="/videos-ia" className="xs sec">Tout voir</Link></div>
          {episodes.length === 0 && <div className="emptystate troupe"><img src="/troupe/vide-videos.webp" alt="" /><p className="small sec">Ta première vidéo apparaîtra ici.</p></div>}
          {episodes.map((e) => { const [label, cls] = next(e); return (
            <Link key={e.id} href={`/videos-ia/${e.id}`} className="cliprow" style={{ height: 58 }}>
              <span style={{ minWidth: 0 }}>{e.title}<span className="xs muted" style={{ display: "block" }}>{e.series ? `${e.series.title} · épisode ${e.number}` : "Vidéo seule"}</span></span>
              <span className="tag"><span className={`dot ${cls}`} />{label}</span>
            </Link>
          ); })}
        </div>
      </div>
    </div>
  );
}
