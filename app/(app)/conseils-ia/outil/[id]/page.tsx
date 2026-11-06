import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CREDENTIALS, FEATURES, credentialStatus, getSettings } from "@/lib/settings";
import { TOOL_APPS } from "@/lib/ai-tools";
import { listElevenVoices, listTextModels } from "@/lib/providers/tools";
import CredentialRow from "@/components/CredentialRow";
import TextToolForm from "@/components/TextToolForm";
import Poller from "@/components/Poller";
import AiCardFx from "@/components/AiCardFx";
import { GLOW } from "@/lib/ai-glow";
import { createToolGeneration, enableFeature } from "@/app/actions";

const KEY_HELP: Record<string, { url: string; how: string }> = {
  openai: { url: "https://platform.openai.com/api-keys", how: "Sur platform.openai.com → API keys → Create new secret key (compte avec un moyen de paiement)." },
  anthropic: { url: "https://console.anthropic.com/settings/keys", how: "Sur console.anthropic.com → Settings → API keys → Create key." },
  replicate: { url: "https://replicate.com/account/api-tokens", how: "Sur replicate.com → Account → API tokens → Create token (une seule clé pour Kling, Veo, Seedance et FLUX)." },
  elevenlabs: { url: "https://elevenlabs.io/app/settings/api-keys", how: "Sur elevenlabs.io → Settings → API keys → Create API key." },
};
const KIND_LABEL = { text: "Texte", image: "Image", video: "Vidéo", audio: "Voix off" } as const;

export default async function ToolPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const t = TOOL_APPS[(await params).id];
  if (!t) notFound();
  const [s, creds] = await Promise.all([getSettings(), credentialStatus()]);
  const cred = CREDENTIALS.find((x) => x.name === t.key)!;
  const keyMissing = !creds[t.key];
  const featureOff = !!t.feature && !s.features[t.feature];
  const ready = !keyMissing && !featureOff;
  const featureLabel = t.feature && FEATURES.find((f) => f.key === t.feature)?.label;

  // Listes lues sur le compte du client, seulement quand la page est prête.
  const textModels = ready && t.kind === "text" ? await listTextModels(t.key === "anthropic" ? "anthropic" : "openai") : [];
  const eleven = ready && t.kind === "audio" ? await listElevenVoices() : null;
  const gens = ready && t.kind !== "text" ? await prisma.generation.findMany({ where: { userId: u.id, kind: t.kind, prompt: { startsWith: `${t.name} · ` } }, orderBy: { createdAt: "desc" }, take: 12 }) : [];

  return (
    <div className="page">
      <Poller active={gens.some((g) => ["queued", "running"].includes(g.status))} />
      <p className="xs muted" style={{ marginBottom: 12 }}><Link href="/conseils-ia" style={{ textDecoration: "underline" }}>Conseils IA</Link> · {KIND_LABEL[t.kind]}</p>
      <AiCardFx />
      <div className="card aitool aibanner" style={{ "--glow": GLOW[`bg/${t.art}`] } as React.CSSProperties}>
        <span className="aibg" style={{ backgroundImage: `url(/conseils-ia/bg/${t.art}.webp)` }} aria-hidden />
        <img src={`/conseils-ia/logos/${t.art}.png`} alt="" className="ailogo" />
        <div><h1>{t.name}</h1><p className="sec" style={{ marginTop: 4 }}>{t.intro}</p></div>
      </div>

      {!ready ? (
        u.role !== "admin" ? (
          <p className="note" style={{ maxWidth: 720 }}>{t.name} n'est pas encore activé sur Clipr : demande à l'administrateur d'ajouter la clé {cred.label}.</p>
        ) : (
          <div className="panel" style={{ maxWidth: 720 }}>
            <h2>Une étape avant d'utiliser {t.name}</h2>
            <p className="sec small" style={{ marginTop: 8 }}>{t.name} fonctionne avec ta propre clé {cred.label}. Elle est chiffrée et n'est jamais envoyée au navigateur.</p>
            {keyMissing && (
              <>
                <CredentialRow name={cred.name} label={`Clé ${cred.label}`} help={KEY_HELP[t.key].how} />
                <p className="xs muted" style={{ marginTop: 8 }}>Créer la clé : <a href={KEY_HELP[t.key].url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>{KEY_HELP[t.key].url}</a></p>
              </>
            )}
            {featureOff && (
              <form action={enableFeature} className="row" style={{ marginTop: 16 }}>
                <input type="hidden" name="feature" value={t.feature} />
                <span className="small sec" style={{ flex: "1 1 240px" }}>« {featureLabel} » est désactivé dans Réglages.</span>
                <button className="btn accent sm">Activer</button>
              </form>
            )}
          </div>
        )
      ) : t.kind === "text" ? (
        <TextToolForm tool={t.id} placeholder={t.placeholder} fields={t.fields} models={textModels} defaultModel={s.llmProvider === (t.key === "anthropic" ? "anthropic" : "openai") ? s.llmModel : undefined} />
      ) : (
        <>
          <form action={createToolGeneration} className="panel" style={{ maxWidth: 820 }}>
            <input type="hidden" name="tool" value={t.id} />
            <label htmlFor="prompt" style={{ marginTop: 0 }}>{t.kind === "audio" ? "Texte à lire" : "Ton prompt"}</label>
            <textarea id="prompt" name="prompt" rows={t.kind === "audio" ? 6 : 3} required maxLength={t.kind === "audio" ? 3000 : 2000} placeholder={t.placeholder} />
            {eleven && (
              eleven.voices.length === 0 ? <p className="alert">Impossible de lire les voix de ton compte ElevenLabs : vérifie ta clé dans Réglages.</p> : (
                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 24 }}>
                  <div><label htmlFor="voice_id">Voix</label><select id="voice_id" name="voice_id">{eleven.voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                  {eleven.models.length > 0 && <div><label htmlFor="model_id">Modèle</label><select id="model_id" name="model_id" defaultValue={eleven.models.includes("eleven_multilingual_v2") ? "eleven_multilingual_v2" : eleven.models[0]}>{eleven.models.map((m) => <option key={m} value={m}>{m}</option>)}</select></div>}
                </div>
              )
            )}
            {t.fields.map((f) => (
              <div key={f.name}>
                <label>{f.label}</label>
                <div className="seg">{f.choices.map((ch, i) => <label key={ch.v}><input type="radio" name={f.name} value={ch.v} defaultChecked={i === 0} />{ch.label}</label>)}</div>
              </div>
            ))}
            {t.kind === "image" && (
              <div><label>Nombre d'images</label><div className="seg">{[1, 2, 4].map((n) => <label key={n}><input type="radio" name="count" value={n} defaultChecked={n === 1} />{n}</label>)}</div></div>
            )}
            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn accent" disabled={eleven?.voices.length === 0}>{t.kind === "audio" ? "Créer la voix" : t.kind === "video" ? "Créer la vidéo" : "Créer"}</button>
              <span className="xs muted">{t.cost}</span>
            </div>
            {t.kind === "video" && <p className="xs muted" style={{ marginTop: 8 }}>Une vidéo prend en général 1 à 5 minutes : tu peux quitter la page, elle s'affichera ici.</p>}
          </form>

          {gens.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2 style={{ marginBottom: 16 }}>Tes dernières créations avec {t.name}</h2>
              <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${t.kind === "audio" ? 320 : 220}px,1fr))` }}>
                {gens.map((g) => (
                  <div key={g.id} className={`card ${t.kind === "audio" ? "stack-8" : "clip"}`}>
                    {g.status === "ready" ? (
                      t.kind === "image" ? <img className="media" src={`/api/files?gen=${g.id}`} alt={g.prompt} />
                        : t.kind === "video" ? <video src={`/api/files?gen=${g.id}`} controls playsInline />
                        : <audio src={`/api/files?gen=${g.id}`} controls style={{ width: "100%" }} />
                    ) : <div className={t.kind === "audio" ? "" : "placeholder"}><span className="tag"><span className={`dot ${g.status === "failed" ? "err" : "live"}`} />{g.status === "failed" ? "Échec" : "Création en cours"}</span></div>}
                    <div className={t.kind === "audio" ? "" : "b"}>
                      <details><summary className="xs muted" style={{ cursor: "pointer" }}>Voir le prompt</summary><p className="xs sec" style={{ marginTop: 6 }}>{g.prompt.slice(t.name.length + 3)}</p></details>
                      {g.error && <p className="alert">{g.error}</p>}
                      {g.status === "ready" && <a className="btn sm" style={{ marginTop: 8 }} href={`/api/files?gen=${g.id}&dl=1`}>Télécharger</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {t.kind !== "audio" && <p className="xs muted" style={{ marginTop: 24 }}>Les contenus générés par IA doivent être signalés comme tels lors de leur publication.</p>}
        </>
      )}
    </div>
  );
}
