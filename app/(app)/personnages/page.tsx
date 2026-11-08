import fs from "node:fs";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isElevenVoice } from "@/lib/engines";
import Poller from "@/components/Poller";
import AiCardFx from "@/components/AiCardFx";
import CharacterBuilder from "@/components/CharacterBuilder";
import { VoiceOptions } from "@/components/EngineFields";
import { chooseCharacterVariant, deleteCharacter, remakeCharacterRef } from "@/app/actions";

// Créateur de personnages et galerie : les personnages créés ici se cochent dans les formulaires de vidéo IA.
export default async function Characters() {
  const u = await requireUser();
  const s = await getSettings();
  if (!s.features.aiVideos) return <div className="page"><p className="note">Fonction désactivée dans Réglages (Vidéos IA et séries).</p></div>;
  const [characters, jobs] = await Promise.all([
    prisma.character.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
    prisma.job.findMany({ where: { type: "character_ref", state: { in: ["queued", "running", "failed"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const mtime = (f: string) => Math.round(fs.statSync(f).mtimeMs);
  const view = (c: (typeof characters)[number]) => {
    const job = jobs.find((j) => j.payload.includes(c.id));
    const pending = job && ["queued", "running"].includes(job.state);
    const ref = !pending && c.refImagePath && fs.existsSync(c.refImagePath) ? c.refImagePath : null;
    const variants: string[] = !pending && c.variantsJson ? (JSON.parse(c.variantsJson) as string[]).filter((f) => fs.existsSync(f)) : [];
    return { pending: !!pending || (!ref && !job), ref, variants, error: !pending && job?.state === "failed" ? job.error : null };
  };
  const busy = characters.some((c) => view(c).pending);
  return (
    <div className="page">
      <Poller active={busy} ms={4000} />
      <AiCardFx />
      <div className="panel aitool aiproject clipshero">
        <span className="aibg" style={{ backgroundImage: "url(/accueil/f-series.webp)" }} aria-hidden />
        <div style={{ maxWidth: 620 }}>
          <h1>Personnages</h1>
          <p className="sec" style={{ marginTop: 8 }}>Crée tes fruits stars : Clipr dessine leur fiche de référence (3 propositions au choix) pour qu'ils restent identiques dans toutes tes vidéos. Ils apparaissent ensuite dans « Personnages » quand tu crées une vidéo ou une série.</p>
          <div className="row" style={{ gap: 8, marginTop: 16 }}><Link href="/videos-ia" className="btn ghost sm">Faire une vidéo avec eux</Link></div>
        </div>
      </div>

      <div className="grid charlayout">
        <CharacterBuilder voices={<VoiceOptions />} />
        <div className="stack-16">
          <h2>Mes personnages <span className="xs muted num">{characters.length}</span></h2>
          {characters.length === 0 && <p className="sec small">Aucun personnage pour l'instant : crée le premier à gauche.</p>}
          {characters.map((c) => {
            const v = view(c);
            return (
              <div key={c.id} className="panel charcard2">
                <div className="charmain">
                  {v.ref ? <img src={`/api/files?char=${c.id}&v=${mtime(v.ref)}`} alt={`Fiche de ${c.name}`} className="charbig" />
                    : <span className={`charbig ${v.error ? "err" : "wait"}`}>{v.error ? "Fiche impossible" : "Fiche en cours…"}</span>}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row"><h3 style={{ flex: 1 }}>{c.name}</h3><span className="xs muted">voix {isElevenVoice(c.voice) ? "ElevenLabs" : c.voice}</span></div>
                    {c.personality && <p className="xs" style={{ color: "var(--accent)", marginTop: 4 }}>{c.personality}</p>}
                    <p className="xs sec charlook" style={{ marginTop: 6 }}>{c.look}</p>
                    {v.error && <p className="xs" style={{ color: "var(--err)", marginTop: 6 }}>{v.error.slice(0, 160)}</p>}
                    <div className="row" style={{ gap: 4, marginTop: 10, flexWrap: "wrap" }}>
                      <Link href={`/videos-ia?cast=${c.id}`} className="btn sm">Utiliser dans une vidéo</Link>
                      <form action={remakeCharacterRef.bind(null, c.id)}><button className="btn quiet sm" disabled={v.pending}>{v.ref ? "Refaire la fiche" : "Relancer"}</button></form>
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
