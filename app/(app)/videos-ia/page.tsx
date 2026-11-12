import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { credentialStatus, getSettings } from "@/lib/settings";
import Poller from "@/components/Poller";
import DurationField from "@/components/DurationField";
import StoryIdeaField from "@/components/StoryIdeaField";
import EngineFields from "@/components/EngineFields";
import StoryOptionsFields from "@/components/StoryOptionsFields";
import { voiceLabel } from "@/lib/engines";
import fs from "node:fs";
import { createEpisode, createSeries, deleteCharacter, nextEpisode, remakeCharacterRef } from "@/app/actions";

const STATUS: Record<string, [string, string]> = { ready: ["Prête", "ok"], failed: ["Échec", "err"], review: ["À valider", "live"] };
const STYLE_OPTS = <><option value="bold">Pop</option><option value="bounce">Rebond</option><option value="box">Encadré</option><option value="typewriter">Machine à écrire</option><option value="none">Aucun sous-titre (titre d'accroche gardé)</option><option value="notext">Aucun texte à l'écran</option></>;

export default async function AiVideos({ searchParams }: { searchParams: Promise<{ idee?: string; format?: string; duree?: string; opts?: string; cast?: string; source?: string }> }) {
  const u = await requireUser();
  const s = await getSettings();
  if (!s.features.aiVideos) return <div className="page"><p className="note">Fonction désactivée dans Réglages.</p></div>;
  const { idee, format, duree, opts, cast, source } = await searchParams;
  // Pré-remplissage depuis une recette de la page Inspiration (personnages cochés, format, durée, options).
  const preCast = new Set((cast ?? "").split(",").filter(Boolean));
  let preOpts: Record<string, string> = {};
  try { preOpts = opts ? JSON.parse(opts) : {}; } catch { /* lien modifié à la main : options ignorées */ }
  const [characters, series, episodes] = await Promise.all([
    prisma.character.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    prisma.series.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { character: true, _count: { select: { episodes: true } } } }),
    prisma.episode.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 40, include: { series: true } }),
  ]);
  // Fiches de référence : image (avec sa date pour rafraîchir après « Refaire »), ou tâche en cours / en échec.
  const refJobs = await prisma.job.findMany({ where: { type: "character_ref", state: { in: ["queued", "running", "failed"] } }, orderBy: { createdAt: "desc" } });
  const refOf = (c: (typeof characters)[number]) => {
    if (c.refImagePath && fs.existsSync(c.refImagePath)) return { src: `/api/files?char=${c.id}&v=${Math.round(fs.statSync(c.refImagePath).mtimeMs)}` };
    const j = refJobs.find((x) => x.payload.includes(c.id));
    return { error: j?.state === "failed" ? j.error ?? "Échec" : null };
  };
  const pending = characters.some((c) => { const r = refOf(c); return !r.src && !r.error; });
  const castPick = characters.length ? (
    <div style={{ gridColumn: "1 / -1" }}><label>Personnages (coche-en plusieurs pour qu'ils se parlent) · <Link href="/personnages" className="credlink">en créer un</Link></label>
      <div className="chips">{characters.map((c) => { const r = refOf(c); return (
        <label key={c.id}><input type="checkbox" name="cast" value={c.id} data-name={c.name} defaultChecked={preCast.has(c.id)} /><span>{r.src && <img src={r.src} alt="" className="chipava" />}{c.name}<span className="xs muted" style={{ marginLeft: 6 }}>{voiceLabel(c.voice)}</span></span></label>
      ); })}</div></div>
  ) : <p className="xs muted" style={{ gridColumn: "1 / -1", marginTop: 12 }}>Crée tes personnages dans <Link href="/personnages" style={{ textDecoration: "underline" }}>Personnages</Link> : chacun reçoit une fiche de référence qui le garde identique d'une image à l'autre.</p>;
  const formatPick = <div><label>Format</label><select name="format" defaultValue={format === "narration" ? "narration" : "dialogue"}><option value="dialogue">Dialogue entre personnages</option><option value="narration">Narration (voix off)</option></select></div>;
  // Synchro des lèvres (Kling Lip Sync sur Replicate) : enregistrée dans les options de la vidéo ou de la série.
  const replicateKey = !!(await credentialStatus()).replicate;
  const lipBox = (
    <label className="check" style={{ marginTop: 12 }}>
      <input type="checkbox" name="opt_lipSync" disabled={!replicateKey} />
      <span className="small">Synchroniser les lèvres avec la voix <span className="xs muted" style={{ display: "block" }}>
        {replicateKey ? "La bouche de chaque perso suit sa réplique (Kling Lip Sync, ≈ 0,014 $ la seconde, soit ≈ 0,40 $ pour 30 s). Marche le mieux en gros plan, un seul perso qui parle par scène." : "Ajoute d'abord la clé Replicate dans Réglages (≈ 0,014 $ la seconde)."}</span></span>
    </label>
  );
  const reviewBox = <label className="check" style={{ marginTop: 16 }}><input type="checkbox" name="review" defaultChecked /><span className="small">Valider le script et les images avant de créer la vidéo (recommandé : la voix et l'animation sont la partie la plus chère)</span></label>;
  return (
    <div className="page">
      <Poller active={pending || episodes.some((e) => ["queued", "processing"].includes(e.status))} ms={4000} />
      <div className="pagehead"><div><h1>Vidéos IA et séries</h1><p>Des personnages, une idée : Clipr écrit le script ou le dialogue, garde chaque personnage identique grâce à sa fiche de référence, te montre les images à valider, puis fait les voix, l'animation et le montage avec sous-titres. Chaque épisode d'une série se souvient des précédents.</p></div></div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,.8fr)", gap: 24, alignItems: "start" }}>
        <div className="stack-24">
          <form action={createEpisode} className="panel">
            <h2>Nouvelle vidéo</h2>
            {source && <p className="note" style={{ marginTop: 12 }}>Pré-rempli avec la recette d'une vidéo qui marche : relis la consigne, coche ou décoche les personnages, puis génère. Les personnages créés reçoivent leur fiche en arrière-plan.</p>}
            <StoryIdeaField name="brief" kind="video" label="Sujet ou consigne" defaultValue={idee ?? ""} placeholder="Ex. La fraise découvre que la banane l'a trompée avec le kiwi pendant la soirée piscine" />
            <DurationField defaultValue={Math.max(15, Math.min(600, Number(duree) || 60))} />
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              {castPick}
              {formatPick}
              <div><label>Sous-titres</label><select name="captionStyle">{STYLE_OPTS}</select></div>
              <div><label>Langue</label><select name="language"><option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option><option value="ar">Arabe</option></select></div>
              <EngineFields />
            </div>
            <StoryOptionsFields id="ep" open defaults={preOpts} />
            {lipBox}
            {reviewBox}
            <input type="hidden" name="origin" value={source ? "manual" : idee ? "trend" : "manual"} />
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
            <ol className="xs sec" style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Dans <Link href="/personnages" className="credlink">Personnages</Link>, crée 2 à 4 fruits et donne à chacun sa voix (ElevenLabs, Gemini ou OpenAI) : « Écouter sa voix » pour vérifier.</li>
              <li>« Nouvelle série » : un titre, un concept, coche tes personnages ; ils se parlent, chacun avec sa voix.</li>
              <li>Ensuite, un clic sur « Créer l'épisode suivant » : Clipr se souvient des épisodes d'avant.</li>
            </ol>
            {series.map((se) => (
              <form key={se.id} action={nextEpisode.bind(null, se.id)} className="raised" style={{ padding: 12, marginTop: 12 }}>
                <div className="row"><h3 style={{ flex: 1 }}>{se.title}</h3><span className="xs muted num">{se._count.episodes} épisode{se._count.episodes > 1 ? "s" : ""}</span></div>
                <p className="xs muted" style={{ marginTop: 4 }}>{se.castJson ? `${(JSON.parse(se.castJson) as string[]).map((id) => characters.find((c) => c.id === id)?.name).filter(Boolean).join(", ")} · ` : se.character ? `Avec ${se.character.name} · ` : ""}{se.format === "dialogue" ? "dialogue · " : ""}{se.durationSec} s</p>
                <input name="brief" placeholder="Idée pour le prochain épisode (facultatif)" style={{ marginTop: 8 }} />
                <button className="btn ghost sm" style={{ marginTop: 8 }}>Créer l'épisode {se._count.episodes + 1}</button>
              </form>
            ))}
            <details style={{ marginTop: 16 }} open={series.length === 0}>
              <summary style={{ cursor: "pointer" }} className="sec">Nouvelle série</summary>
              <form action={createSeries}>
                <label>Titre</label><input name="title" required placeholder="Fruit Island" />
                <StoryIdeaField name="premise" kind="series" label="Concept" placeholder="Des fruits en couple dans une villa : chaque épisode, une trahison, une dispute ou un nouveau couple" />
                <DurationField />
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>{castPick}{formatPick}<div><label>Sous-titres</label><select name="captionStyle">{STYLE_OPTS}</select></div><EngineFields /></div>
                <StoryOptionsFields id="se" series />
                {lipBox}
                {reviewBox}
                <label className="check" style={{ marginTop: 16 }}><input type="checkbox" name="startNow" defaultChecked /><span className="small">Générer l'épisode 1 tout de suite</span></label>
                <button className="btn sm" style={{ marginTop: 16 }}>Créer la série</button>
              </form>
            </details>
          </div>

          <div className="panel">
            <h2>Personnages</h2>
            <p className="xs muted" style={{ marginTop: 4 }}>Fruit, animal, objet, humain : chaque personnage a une fiche de référence (vue de face, fond neutre) jointe à chaque image où il apparaît, pour qu'il reste identique.</p>
            {characters.map((c) => { const r = refOf(c); return (
              <div key={c.id} className="raised charcard">
                {r.src ? <img src={r.src} alt={`Fiche de ${c.name}`} className="charref" /> : <span className={`charref ${r.error ? "err" : "wait"}`}>{r.error ? "Fiche impossible" : "Fiche en cours…"}</span>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row"><h3 style={{ flex: 1 }}>{c.name}</h3><span className="xs muted">voix {voiceLabel(c.voice)}</span></div>
                  <p className="xs sec" style={{ marginTop: 4 }}>{c.look}</p>
                  {r.error && <p className="xs" style={{ color: "var(--err)", marginTop: 4 }}>{r.error.slice(0, 160)}</p>}
                  <div className="row" style={{ gap: 4, marginTop: 6 }}>
                    <form action={remakeCharacterRef.bind(null, c.id)}><button className="btn quiet sm">{r.src ? "Refaire la fiche" : "Relancer la fiche"}</button></form>
                    <form action={deleteCharacter.bind(null, c.id)}><button className="btn quiet sm">Supprimer</button></form>
                  </div>
                </div>
              </div>
            ); })}
            <Link href="/personnages" className="btn sm" style={{ marginTop: 16 }}>Créer un personnage</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
