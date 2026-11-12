import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CREDENTIALS, FEATURES, credentialStatus, getSettings } from "@/lib/settings";
import { DEFAULT_PRICES } from "@/lib/usage";
import CredentialRow from "@/components/CredentialRow";
import { grantMinutes, saveFeatures, saveProviders, switchToGemini } from "@/app/actions";
import PageHero from "@/components/PageHero";
import AiCardFx from "@/components/AiCardFx";

export default async function Settings() {
  await requireAdmin();
  const s = await getSettings();
  const creds = await credentialStatus();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { credits: true } });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return (
    <div className="page">
      <AiCardFx />
      <PageHero name="reglages" title="Réglages"><p className="sec" style={{ marginTop: 8 }}>Tu choisis les fonctions de l'appli et tu utilises tes propres clés API : chaque appel est facturé directement sur ton compte fournisseur.</p></PageHero>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        <div className="stack-24">
          <form action={saveFeatures} className="panel">
            <h2 style={{ marginBottom: 16 }}>Fonctions actives</h2>
            {FEATURES.map((f) => (
              <label key={f.key} className="check">
                <input type="checkbox" name={f.key} defaultChecked={s.features[f.key]} />
                <span><span>{f.label}</span><span className="xs muted" style={{ display: "block" }}>{f.help}</span></span>
              </label>
            ))}
            <button className="btn sm" style={{ marginTop: 16 }}>Enregistrer</button>
          </form>

          <form action={switchToGemini} className="panel">
            <h2>Tout en Gemini</h2>
            <p className="xs muted" style={{ marginTop: 4 }}>Une seule clé Google pour les scripts, l'analyse des images, les images des scènes (Nano Banana 2.1, ≈ 0,034 $ l'image) et les voix off des nouveaux personnages (30 voix Gemini qui parlent français). Pour des scènes animées, choisis « Gemini Omni Flash » dans les visuels d'une vidéo (≈ 0,07 $ la seconde). Le montage et les sous-titres restent faits sur ton serveur, gratuitement.</p>
            {s.llmProvider === "google" && s.imageProvider === "google"
              ? <p className="xs" style={{ marginTop: 10, color: "var(--accent)" }}>Gemini est déjà utilisé partout.</p>
              : <button className="btn accent sm" style={{ marginTop: 12 }} disabled={!creds.google}>{creds.google ? "Tout passer en Gemini" : "Ajoute d'abord la clé Google Gemini dans « Clés API »"}</button>}
          </form>

          <form action={saveProviders} className="panel">
            <h2>Fournisseurs et modèles</h2>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <div><label>LLM (scoring, scripts, Coach)</label><select name="llmProvider" defaultValue={s.llmProvider}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google Gemini</option></select></div>
              <div><label>Modèle LLM</label><input name="llmModel" defaultValue={s.llmModel} /></div>
              <div><label>Transcription</label><select name="sttProvider" defaultValue={s.sttProvider}><option value="openai">OpenAI Whisper</option><option value="groq">Groq Whisper</option></select></div>
              <div><label>Voix off (OpenAI)</label><input name="ttsModel" defaultValue={s.ttsModel} /></div>
              <div><label>Images</label><select name="imageProvider" defaultValue={s.imageProvider}><option value="openai">OpenAI</option><option value="replicate">Replicate</option><option value="google">Google Gemini (Nano Banana)</option></select></div>
              <div><label>Modèle image</label><input name="imageModel" defaultValue={s.imageModel} /></div>
              <div><label>Qualité des images (GPT Image)</label><select name="imageQuality" defaultValue={s.imageQuality}><option value="medium">Moyenne · ≈ 0,06 $ l'image (conseillé)</option><option value="high">Haute · ≈ 0,25 $ l'image</option><option value="low">Basse · ≈ 0,02 $ l'image (brouillons)</option></select></div>
              <div><label>Modèle vidéo (Replicate)</label><input name="videoModel" defaultValue={s.videoModel} placeholder="minimax/video-01" /></div>
              <div><label>Minutes offertes à l'inscription</label><input name="freeMinutes" type="number" defaultValue={s.freeMinutes} /></div>
              <div><label>Pays des tendances</label><input name="trendRegion" defaultValue={s.trendRegion} maxLength={2} /></div>
              <div><label>Thème pour les idées</label><input name="trendNiche" defaultValue={s.trendNiche} placeholder="Business, sport, cuisine" /></div>
            </div>
            <h3 style={{ marginTop: 24 }}>Tarifs du compteur (USD)</h3>
            <p className="xs muted" style={{ margin: "4px 0 8px" }}>Valeurs indicatives, à vérifier sur les pages de prix des fournisseurs.</p>
            {Object.entries(DEFAULT_PRICES).map(([k, v]) => (
              <div key={k} className="row" style={{ flexWrap: "nowrap", marginTop: 4 }}>
                <span className="xs sec" style={{ flex: 2 }}>{k} <span className="muted">par {v.per}</span></span>
                <input style={{ flex: 1 }} name={`price:${k}`} type="number" step="any" placeholder={String(v.price)} defaultValue={s.prices[k] ?? ""} />
              </div>
            ))}
            <button className="btn sm" style={{ marginTop: 16 }}>Enregistrer</button>
          </form>
        </div>

        <div className="stack-24">
          <div className="panel" style={{ paddingBottom: 8 }}>
            <h2>Clés API</h2>
            <p className="xs muted" style={{ marginTop: 4 }}>Chiffrées côté serveur (AES-256-GCM), jamais renvoyées au navigateur : seuls les 4 derniers caractères s'affichent.</p>
            {CREDENTIALS.map((c) => <CredentialRow key={c.name} name={c.name} label={c.label} help={c.help} url={c.url} last4={creds[c.name]?.last4} />)}
          </div>
          <div className="panel">
            <h2>Ton app TikTok</h2>
            <ol className="small sec" style={{ paddingLeft: 20, marginTop: 12 }}>
              <li>Sur developers.tiktok.com, connecte-toi avec ton compte et crée une app.</li>
              <li>Ajoute Login Kit, Content Posting API et Display API.</li>
              <li>Scopes : user.info.basic, user.info.stats, video.list, video.upload, video.publish.</li>
              <li>URL de redirection : <code>{appUrl}/api/tiktok/callback</code></li>
              <li>Colle le Client key et le Client secret ci-dessus, puis soumets l'app à validation pour publier en public.</li>
            </ol>
          </div>
          <div className="panel">
            <h2>Ton app Meta (Facebook)</h2>
            <ol className="small sec" style={{ paddingLeft: 20, marginTop: 12 }}>
              <li>Sur developers.facebook.com, crée une app de type Business avec ton compte.</li>
              <li>Ajoute Facebook Login for Business. URL de redirection : <code>{appUrl}/api/facebook/callback</code></li>
              <li>Permissions : pages_show_list, pages_read_engagement, pages_manage_posts, read_insights.</li>
              <li>Colle l'App ID et l'App secret ci-dessus. La Page publiée est la première Page que tu gères.</li>
            </ol>
          </div>
          <div className="panel">
            <h2>Ton projet Google (YouTube)</h2>
            <ol className="small sec" style={{ paddingLeft: 20, marginTop: 12 }}>
              <li>Sur console.cloud.google.com, crée un projet avec ton compte Google.</li>
              <li>Bibliothèque d'API : active YouTube Data API v3. Une clé API de ce projet sert aussi aux Tendances.</li>
              <li>Écran de consentement OAuth : type Externe, ajoute ton adresse en utilisateur test et les scopes youtube.upload et youtube.readonly.</li>
              <li>Identifiants : crée un ID client OAuth de type Application Web. URI de redirection : <code>{appUrl}/api/youtube/callback</code></li>
              <li>Colle le Client ID et le Client secret ci-dessus. Pour publier en public, demande l'audit YouTube API Services ; avant, les vidéos restent privées.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24, padding: "8px 24px" }}>
        <h2 style={{ padding: "16px 0 8px" }}>Utilisateurs et minutes</h2>
        <table><thead><tr><th>Email</th><th>Rôle</th><th className="r">Minutes restantes</th><th>Ajouter</th></tr></thead><tbody>
          {users.map((x) => (
            <tr key={x.id}><td>{x.email}</td><td>{x.role === "admin" ? "Administrateur" : "Utilisateur"}</td><td className="r">{x.role === "admin" ? "illimité" : x.credits.reduce((a, c) => a + c.minutes, 0)}</td>
              <td>{x.role !== "admin" && <form action={grantMinutes} className="row" style={{ flexWrap: "nowrap", gap: 8 }}><input type="hidden" name="userId" value={x.id} /><input name="minutes" type="number" defaultValue={60} style={{ width: 96 }} /><button className="btn ghost sm">Ajouter</button></form>}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );
}
