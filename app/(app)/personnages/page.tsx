import fs from "node:fs";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { voiceLabel } from "@/lib/engines";
import Poller from "@/components/Poller";
import AiCardFx from "@/components/AiCardFx";
import { TroupeLoop } from "@/components/PageHero";
import CharacterBuilder from "@/components/CharacterBuilder";
import CharacterImport from "@/components/CharacterImport";
import { isImported, voiceSample, voiceSampleError } from "@/lib/character-import";
import PendingButton from "@/components/PendingButton";
import { VoiceOptions, defaultVoice } from "@/components/EngineFields";
import { chooseCharacterVariant, deleteCharacter, previewCharacterVoice, reanalyzeCharacter, remakeCharacterRef, setCharacterVoice } from "@/app/actions";

// Créateur de personnages et galerie : les personnages créés ici se cochent dans les formulaires de vidéo IA.
export default async function Characters() {
  const u = await requireUser();
  const s = await getSettings();
  if (!s.features.aiVideos) return <div className="page"><p className="note">Fonction désactivée dans Réglages (Vidéos IA et séries).</p></div>;
  const [characters, jobs] = await Promise.all([
    prisma.character.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    prisma.job.findMany({ where: { type: { in: ["character_ref", "character_analyze"] }, state: { in: ["queued", "running", "failed"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const mtime = (f: string) => Math.round(fs.statSync(f).mtimeMs);
  const view = (c: (typeof characters)[number]) => {
    const job = jobs.find((j) => j.type === "character_ref" && j.payload.includes(c.id));
    const pending = job && ["queued", "running"].includes(job.state);
    // Personnage importé : pas de fiche à dessiner, seulement l'analyse de son image.
    const scan = jobs.find((j) => j.type === "character_analyze" && j.payload.includes(c.id));
    const analyzing = !!scan && ["queued", "running"].includes(scan.state);
    const ref = !pending && c.refImagePath && fs.existsSync(c.refImagePath) ? c.refImagePath : null;
    const variants: string[] = !pending && c.variantsJson ? (JSON.parse(c.variantsJson) as string[]).filter((f) => fs.existsSync(f)) : [];
    return { pending: !!pending || (!ref && !job), ref, variants, imported: isImported(c), analyzing,
      error: !pending && job?.state === "failed" ? job.error : !analyzing && scan?.state === "failed" && !c.look ? scan.error : null };
  };
  const busy = characters.some((c) => { const v = view(c); return v.pending || v.analyzing; });
  return (
    <div className="page">
      <Poller active={busy} ms={4000} />
      <AiCardFx />
      <div className="panel aitool aiproject clipshero troupehero">
        <span className="aibg" style={{ backgroundImage: "url(/troupe/personnages.webp)" }} aria-hidden><TroupeLoop name="personnages" /></span>
        <div style={{ maxWidth: 620 }}>
          <h1>Personnages</h1>
          <p className="sec" style={{ marginTop: 8 }}>Crée tes fruits stars : Clipr dessine leur fiche de référence (3 propositions au choix), ou importe ceux que tu as faits ailleurs. Ils restent identiques dans toutes tes vidéos. Ils apparaissent ensuite dans « Personnages » quand tu crées une vidéo ou une série.</p>
          <div className="row" style={{ gap: 8, marginTop: 16 }}><Link href="/videos-ia" className="btn ghost sm">Faire une vidéo avec eux</Link></div>
        </div>
      </div>

      <div className="grid charlayout">
        <div className="stack-16">
          <CharacterBuilder voices={<VoiceOptions />} defaultVoice={defaultVoice(s)} />
          <CharacterImport voices={<VoiceOptions />} defaultVoice={defaultVoice(s)} />
        </div>
        <div className="stack-16">
          <h2>Mes personnages <span className="xs muted num">{characters.length}</span></h2>
          {characters.length === 0 && <div className="emptystate troupe"><img src="/troupe/vide-personnages.webp" alt="" /><p><b>Le plateau est vide</b></p><p className="small sec">Fraise attend ses premiers acteurs : crée ton premier fruit à gauche, ou importe-le.</p></div>}
          {characters.map((c) => {
            const v = view(c);
            return (
              <div key={c.id} className="panel charcard2">
                <div className="charmain">
                  {v.ref ? <img src={`/api/files?char=${c.id}&v=${mtime(v.ref)}`} alt={`Fiche de ${c.name}`} className="charbig" />
                    : <span className={`charbig ${v.error ? "err" : "wait"}`}>{v.error ? "Fiche impossible" : "Fiche en cours…"}</span>}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row"><h3 style={{ flex: 1 }}>{c.name || "Nouveau personnage"}</h3>{v.imported && <span className="xs muted" style={{ marginRight: 8 }}>importé</span>}<span className="xs muted">voix {voiceLabel(c.voice)}</span></div>
                    {c.personality && <p className="xs" style={{ color: "var(--accent)", marginTop: 4 }}>{c.personality}</p>}
                    <p className="xs sec charlook" style={{ marginTop: 6 }}>{v.analyzing ? "Analyse de l'image en cours…" : c.look}</p>
                    {v.error && <p className="xs" style={{ color: "var(--err)", marginTop: 6 }}>{v.error.slice(0, 160)}</p>}
                    {/* Sa voix : elle parle avec dans toutes ses répliques (dialogues entre personnages). */}
                    <form action={setCharacterVoice.bind(null, c.id)} className="row" style={{ gap: 6, marginTop: 10, flexWrap: "nowrap" }}>
                      <select name="voice" defaultValue={c.voice} aria-label={`Voix de ${c.name}`} style={{ flex: 1, minWidth: 0 }}><VoiceOptions /></select>
                      <PendingButton pending="…">Changer la voix</PendingButton>
                    </form>
                    <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: "nowrap" }}>
                      <form action={previewCharacterVoice.bind(null, c.id)}><PendingButton pending="Elle parle…">Écouter sa voix</PendingButton></form>
                      {fs.existsSync(voiceSample(c.id)) && <audio controls preload="none" src={`/api/files?charvoice=${c.id}&v=${mtime(voiceSample(c.id))}`} style={{ height: 32, flex: 1, minWidth: 0 }} />}
                    </div>
                    {fs.existsSync(voiceSampleError(c.id)) && <p className="xs" style={{ color: "var(--err)", marginTop: 6 }}>{fs.readFileSync(voiceSampleError(c.id), "utf8")}</p>}
                    <div className="row" style={{ gap: 4, marginTop: 10, flexWrap: "wrap" }}>
                      <Link href={`/videos-ia?cast=${c.id}`} className="btn sm">Utiliser dans une vidéo</Link>
                      {v.imported
                        ? <form action={reanalyzeCharacter.bind(null, c.id)}><button className="btn quiet sm" disabled={v.analyzing}>Relancer l'analyse</button></form>
                        : <form action={remakeCharacterRef.bind(null, c.id)}><button className="btn quiet sm" disabled={v.pending}>{v.ref ? "Refaire la fiche" : "Relancer"}</button></form>}
                      <form action={deleteCharacter.bind(null, c.id)}><button className="btn quiet sm">Supprimer</button></form>
                    </div>
                  </div>
                </div>
                {v.variants.length > 1 && (
                  <div className="variants">
                    <span className="xs muted">Choisis la fiche qui te plaît : elle servira de référence dans toutes ses images.</span>
                    <div className="varrow">{v.variants.map((f, i) => (
                      <form key={f} action={chooseCharacterVariant.bind(null, c.id, i)} className={`variant ${f === c.refImagePath ? "on" : ""}`}>
                        <button aria-label={`Choisir la proposition ${i + 1}`}><img src={`/api/files?char=${c.id}&variant=${i}&v=${mtime(f)}`} alt={`Proposition ${i + 1}`} /></button>
                        <span className="xs">{f === c.refImagePath ? "Choisie" : `Proposition ${i + 1}`}</span>
                      </form>
                    ))}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
