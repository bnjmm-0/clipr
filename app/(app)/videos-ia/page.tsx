import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import Poller from "@/components/Poller";
import DurationField from "@/components/DurationField";
import EngineFields, { VoiceOptions } from "@/components/EngineFields";
import { isElevenVoice } from "@/lib/engines";
import { createCharacter, createEpisode, createSeries, deleteCharacter, nextEpisode } from "@/app/actions";

const STATUS: Record<string, [string, string]> = { ready: ["Prête", "ok"], failed: ["Échec", "err"] };
const STYLE_OPTS = <><option value="bold">Pop</option><option value="bounce">Rebond</option><option value="box">Encadré</option><option value="typewriter">Machine à écrire</option></>;

export default async function AiVideos({ searchParams }: { searchParams: Promise<{ idee?: string }> }) {
  const u = await requireUser();
  const s = await getSettings();
  if (!s.features.aiVideos) return <div className="page"><p className="note">Fonction désactivée dans Réglages.</p></div>;
  const { idee } = await searchParams;
  const [characters, series, episodes] = await Promise.all([
    prisma.character.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    prisma.series.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { character: true, _count: { select: { episodes: true } } } }),
    prisma.episode.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 40, include: { series: true } }),
  ]);
  const charOpts = <><option value="">Sans personnage</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</>;
  return (
    <div className="page">
      <Poller active={episodes.some((e) => ["queued", "processing"].includes(e.status))} ms={4000} />
      <div className="pagehead"><div><h1>Vidéos IA et séries</h1><p>Un personnage, une idée : Clipr écrit le script, fait la voix off, génère les visuels, monte la vidéo avec sous-titres animés et l'enregistre. Chaque épisode d'une série se souvient des précédents.</p></div></div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,.8fr)", gap: 24, alignItems: "start" }}>
        <div className="stack-24">
          <form action={createEpisode} className="panel">
            <h2>Nouvelle vidéo</h2>
            <label>Sujet ou consigne</label>
            <textarea name="brief" rows={3} required defaultValue={idee ?? ""} placeholder="Ex. trois erreurs que font les débutants en musculation, racontées par le coach" />
            <DurationField />
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div><label>Personnage</label><select name="characterId">{charOpts}</select></div>
              <div><label>Sous-titres</label><select name="captionStyle">{STYLE_OPTS}</select></div>
              <div><label>Langue</label><select name="language"><option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option><option value="ar">Arabe</option></select></div>
              <EngineFields />
            </div>
            <input type="hidden" name="origin" value={idee ? "trend" : "manual"} />
            <button className="btn accent" style={{ marginTop: 20 }}>Générer la vidéo</button>
            <p className="xs muted" style={{ marginTop: 12 }}>Coût indicatif : une image et quelques secondes de voix par scène. Le détail apparaît dans Usage.</p>
          </form>

          <div className="panel" style={{ padding: "8px 24px" }}>
            <h2 style={{ padding: "16px 0 8px" }}>Vidéos enregistrées</h2>
            {episodes.length === 0 && <p className="sec small" style={{ paddingBottom: 16 }}>Aucune vidéo pour l'instant.</p>}
            {episodes.map((e) => {
              const [label, cls] = STATUS[e.status] ?? [`${e.stage} · ${e.progress} %`, "live"];
              return (
                <Link key={e.id} href={`/videos-ia/${e.id}`} className="cliprow" style={{ height: 56 }}>
                  <span style={{ minWidth: 0 }}>{e.title}<span className="xs muted" style={{ display: "block" }}>{e.series ? `${e.series.title} · épisode ${e.number}` : e.origin === "remix" ? "Vidéo reprise" : e.origin === "trend" ? "Depuis une tendance" : "Vidéo seule"} · {Math.round(e.durationSec / 60 * 10) / 10} min</span></span>
                  <span className="tag"><span className={`dot ${cls}`} />{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="stack-24">
          <div className="panel">
            <h2>Séries</h2>
            {series.map((se) => (
              <form key={se.id} action={nextEpisode.bind(null, se.id)} className="raised" style={{ padding: 12, marginTop: 12 }}>
                <div className="row"><h3 style={{ flex: 1 }}>{se.title}</h3><span className="xs muted num">{se._count.episodes} épisode{se._count.episodes > 1 ? "s" : ""}</span></div>
                <p className="xs muted" style={{ marginTop: 4 }}>{se.character ? `Avec ${se.character.name} · ` : ""}{se.durationSec} s</p>
                <input name="brief" placeholder="Idée pour le prochain épisode (facultatif)" style={{ marginTop: 8 }} />
                <button className="btn ghost sm" style={{ marginTop: 8 }}>Créer l'épisode {se._count.episodes + 1}</button>
              </form>
            ))}
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer" }} className="sec">Nouvelle série</summary>
              <form action={createSeries}>
                <label>Titre</label><input name="title" required placeholder="Les aventures de Pépin" />
                <label>Concept</label><textarea name="premise" rows={3} required placeholder="Une pomme de terre qui veut devenir chef étoilé teste une recette par épisode" />
                <label>Personnage</label><select name="characterId">{charOpts}</select>
                <DurationField />
                <label>Sous-titres</label><select name="captionStyle">{STYLE_OPTS}</select>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}><EngineFields /></div>
                <label className="check" style={{ marginTop: 16 }}><input type="checkbox" name="startNow" defaultChecked /><span className="small">Générer l'épisode 1 tout de suite</span></label>
                <button className="btn sm" style={{ marginTop: 16 }}>Créer la série</button>
              </form>
            </details>
          </div>

          <div className="panel">
            <h2>Personnages</h2>
            <p className="xs muted" style={{ marginTop: 4 }}>Humain, animal, objet, mascotte : l'apparence est reprise dans chaque image.</p>
            {characters.map((c) => (
              <div key={c.id} className="raised" style={{ padding: 12, marginTop: 12 }}>
                <div className="row"><h3 style={{ flex: 1 }}>{c.name}</h3><span className="xs muted">voix {isElevenVoice(c.voice) ? "ElevenLabs" : c.voice}</span>
                  <form action={deleteCharacter.bind(null, c.id)}><button className="btn quiet sm">Supprimer</button></form></div>
                <p className="xs sec" style={{ marginTop: 4 }}>{c.look}</p>
              </div>
            ))}
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer" }} className="sec">Nouveau personnage</summary>
              <form action={createCharacter}>
                <label>Nom</label><input name="name" required placeholder="Coach Max" />
                <label>Apparence (en détail, elle sert à chaque image)</label><textarea name="look" rows={3} required placeholder="Homme de 35 ans, barbe courte, sweat gris, salle de sport industrielle" />
                <label>Personnalité</label><input name="personality" placeholder="Direct, drôle, bienveillant" />
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                  <div><label>Voix</label><select name="voice" defaultValue="alloy"><VoiceOptions /></select></div>
                  <div><label>Style visuel</label><input name="visualStyle" defaultValue="cinématique réaliste" /></div>
                </div>
                <button className="btn sm" style={{ marginTop: 16 }}>Créer le personnage</button>
              </form>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
