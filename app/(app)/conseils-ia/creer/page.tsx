import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CREDENTIALS, credentialStatus, getSettings } from "@/lib/settings";
import { CREATORS, PROJECTS } from "@/lib/ai-advice";
import CredentialRow from "@/components/CredentialRow";
import Poller from "@/components/Poller";
import { createFromAdvice, enableImageGeneration } from "@/app/actions";

const KEY_HELP: Record<string, { url: string; how: string }> = {
  openai: { url: "https://platform.openai.com/api-keys", how: "Sur platform.openai.com → API keys → Create new secret key (compte avec un moyen de paiement)." },
  replicate: { url: "https://replicate.com/account/api-tokens", how: "Sur replicate.com → Account → API tokens → Create token." },
};

export default async function CreateWithAi({ searchParams }: { searchParams: Promise<{ projet?: string }> }) {
  const u = await requireUser();
  const { projet } = await searchParams;
  const id = projet && CREATORS[projet] ? projet : PROJECTS[0].id;
  const c = CREATORS[id];
  const p = PROJECTS.find((x) => x.id === id)!;
  const [s, creds] = await Promise.all([getSettings(), credentialStatus()]);

  // Ce qu'il faut pour générer : la clé du fournisseur d'images choisi dans Réglages, et la fonction activée.
  const imgKey = s.imageProvider === "replicate" ? "replicate" : "openai";
  const keyMissing = !creds[imgKey];
  const featureOff = !s.features.textToImage;
  const videoReady = c.video && s.features.textToVideo && !!creds.replicate && !!s.videoModel;
  const gens = keyMissing || featureOff ? [] : await prisma.generation.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 12 });
  const cred = CREDENTIALS.find((x) => x.name === imgKey)!;

  return (
    <div className="page">
      <Poller active={gens.some((g) => ["queued", "running"].includes(g.status))} />
      <div className="pagehead"><div>
        <p className="xs muted" style={{ marginBottom: 8 }}><Link href={`/conseils-ia?projet=${id}`} style={{ textDecoration: "underline" }}>Conseils IA</Link> · {p.title}</p>
        <h1>{c.title}</h1><p>{c.intro}</p>
      </div></div>

      {(keyMissing || featureOff) ? (
        u.role !== "admin" ? (
          <p className="note" style={{ maxWidth: 720 }}>La création par IA n'est pas encore activée sur Clipr : demande à l'administrateur d'ajouter la clé {cred.label}.</p>
        ) : (
          <div className="panel" style={{ maxWidth: 720 }}>
            <h2>Une étape avant de créer</h2>
            <p className="sec small" style={{ marginTop: 8 }}>Clipr génère les images avec ta propre clé {cred.label}. Elle est chiffrée et n'est jamais envoyée au navigateur.</p>
            {keyMissing && (
              <>
                <CredentialRow name={cred.name} label={`Clé ${cred.label}`} help={KEY_HELP[imgKey].how} />
                <p className="xs muted" style={{ marginTop: 8 }}>Créer la clé : <a href={KEY_HELP[imgKey].url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{KEY_HELP[imgKey].url}</a></p>
              </>
            )}
            {featureOff && (
              <form action={enableImageGeneration} className="row" style={{ marginTop: 16 }}>
                <span className="small sec" style={{ flex: "1 1 240px" }}>La création d'images est désactivée dans Réglages.</span>
                <button className="btn accent sm">Activer la création d'images</button>
              </form>
            )}
          </div>
        )
      ) : (
        <>
          <form action={createFromAdvice} className="panel" style={{ maxWidth: 820 }}>
            <input type="hidden" name="projet" value={id} />
            <label htmlFor="idea" style={{ marginTop: 0 }}>Ton idée</label>
            <textarea id="idea" name="idea" rows={3} required maxLength={1000} placeholder={c.placeholder} />
            {c.fields.map((f) => (
              <div key={f.name}>
                <label>{f.label}</label>
                <div className="seg">
                  {f.choices.map((ch, i) => <label key={ch}><input type="radio" name={f.name} value={ch} defaultChecked={i === 0} />{ch}</label>)}
                </div>
              </div>
            ))}
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 24 }}>
              <div>
                <label>Résultat</label>
                <div className="seg">
                  <label><input type="radio" name="kind" value="image" defaultChecked />Image</label>
                  {c.video && <label style={videoReady ? undefined : { opacity: .5, cursor: "not-allowed" }}><input type="radio" name="kind" value="video" disabled={!videoReady} />Vidéo</label>}
                </div>
                {c.video && !videoReady && <p className="xs muted" style={{ marginTop: 6 }}>Vidéo : {u.role === "admin" ? <>active « Texte → vidéo », ajoute la clé Replicate et un modèle vidéo dans <Link href="/reglages" style={{ textDecoration: "underline" }}>Réglages</Link>.</> : "pas encore activée sur Clipr."}</p>}
              </div>
              <div>
                <label>Nombre d'images</label>
                <div className="seg">
                  {[1, 2, 4].map((n) => <label key={n}><input type="radio" name="count" value={n} defaultChecked={n === 1} />{n}</label>)}
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn accent">Créer</button>
              <span className="xs muted">Format vertical 9:16. Chaque image est facturée sur ta clé {cred.label}.</span>
            </div>
          </form>

          {gens.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2 style={{ marginBottom: 16 }}>Tes dernières créations</h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
                {gens.map((g) => (
                  <div key={g.id} className="card clip">
                    {g.status === "ready" ? (g.kind === "image" ? <img className="media" src={`/api/files?gen=${g.id}`} alt={g.prompt} /> : <video src={`/api/files?gen=${g.id}`} controls playsInline />)
                      : <div className="placeholder"><span className="tag"><span className={`dot ${g.status === "failed" ? "err" : "live"}`} />{g.status === "failed" ? "Échec" : "Création en cours"}</span></div>}
                    <div className="b">
                      <details><summary className="xs muted" style={{ cursor: "pointer" }}>Voir le prompt</summary><p className="xs sec" style={{ marginTop: 6 }}>{g.prompt}</p></details>
                      {g.error && <p className="alert">{g.error}</p>}
                      {g.status === "ready" && <a className="btn sm" href={`/api/files?gen=${g.id}&dl=1`}>Télécharger</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="xs muted" style={{ marginTop: 24 }}>Les contenus générés par IA doivent être signalés comme tels lors de leur publication.</p>
        </>
      )}
    </div>
  );
}
