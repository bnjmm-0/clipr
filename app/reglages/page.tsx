import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CREDENTIALS, FEATURES, credentialStatus, getSettings } from "@/lib/settings";
import { DEFAULT_PRICES } from "@/lib/usage";
import CredentialRow from "@/components/CredentialRow";
import { grantMinutes, saveFeatures, saveProviders } from "@/app/actions";

export default async function Settings() {
  await requireAdmin();
  const s = await getSettings();
  const creds = await credentialStatus();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { credits: true } });
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return (
    <main className="wrap page">
      <h1 className="reveal">Réglages</h1>
      <p className="muted reveal d1">Vous choisissez les fonctions de l'appli et vous utilisez vos propres clés API : les appels sont facturés directement sur vos comptes fournisseurs.</p>
      <div className="grid g2" style={{ marginTop: 20 }}>
        <form action={saveFeatures} className="card reveal d1">
          <h2>Fonctions actives</h2>
          {FEATURES.map((f) => (
            <label key={f.key} className="toggle" style={{ color: "var(--text)" }}>
              <input type="checkbox" name={f.key} defaultChecked={s.features[f.key]} />
              <span><b>{f.label}</b><br /><span className="small muted">{f.help}</span></span>
            </label>
          ))}
          <button className="btn">Enregistrer</button>
        </form>
        <div className="card reveal d2">
          <h2>Clés API</h2>
          <p className="small muted">Chiffrées (AES-256-GCM) côté serveur. Elles ne sont jamais renvoyées au navigateur : seuls les 4 derniers caractères s'affichent.</p>
          {CREDENTIALS.map((c) => <CredentialRow key={c.name} name={c.name} label={c.label} help={c.help} last4={creds[c.name]?.last4} />)}
        </div>
        <form action={saveProviders} className="card reveal d3">
          <h2>Fournisseurs et modèles</h2>
          <label>LLM (scoring des clips, Coach)</label>
          <select name="llmProvider" defaultValue={s.llmProvider}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select>
          <label>Modèle LLM</label><input name="llmModel" defaultValue={s.llmModel} placeholder="gpt-4o-mini ou claude-haiku-5-5" />
          <label>Transcription</label>
          <select name="sttProvider" defaultValue={s.sttProvider}><option value="openai">OpenAI Whisper</option><option value="groq">Groq Whisper large v3 turbo</option></select>
          <label>Images</label>
          <select name="imageProvider" defaultValue={s.imageProvider}><option value="openai">OpenAI</option><option value="replicate">Replicate</option></select>
          <label>Modèle image</label><input name="imageModel" defaultValue={s.imageModel} placeholder="gpt-image-1 ou black-forest-labs/flux-schnell" />
          <label>Modèle vidéo Replicate</label><input name="videoModel" defaultValue={s.videoModel} placeholder="ex. minimax/video-01" />
          <label>Minutes offertes à l'inscription (essai)</label><input name="freeMinutes" type="number" defaultValue={s.freeMinutes} />
          <h3 style={{ marginTop: 20 }}>Tarifs pour le compteur (USD)</h3>
          <p className="small muted">Valeurs par défaut indicatives : vérifiez-les sur les pages de prix des fournisseurs et corrigez-les ici.</p>
          {Object.entries(DEFAULT_PRICES).map(([k, v]) => (
            <div key={k} className="row" style={{ flexWrap: "nowrap", marginBottom: 6 }}>
              <span className="small" style={{ flex: 2 }}>{k} <span className="muted">/ {v.per}</span></span>
              <input style={{ flex: 1 }} name={`price:${k}`} type="number" step="any" placeholder={String(v.price)} defaultValue={s.prices[k] ?? ""} />
            </div>
          ))}
          <button className="btn" style={{ marginTop: 10 }}>Enregistrer</button>
        </form>
        <div className="card reveal d4">
          <h2>TikTok : votre app développeur</h2>
          <ol className="small" style={{ lineHeight: 1.7 }}>
            <li>Sur <b>developers.tiktok.com</b>, connectez-vous avec <b>votre</b> compte et créez une app.</li>
            <li>Ajoutez les produits <b>Login Kit</b> et <b>Content Posting API</b> (et Display API pour le Coach).</li>
            <li>Scopes : user.info.basic, user.info.stats, video.list, video.upload, video.publish.</li>
            <li>URL de redirection : <code>{appUrl}/api/tiktok/callback</code></li>
            <li>Collez le Client key et le Client secret dans « Clés API » ci-contre.</li>
            <li>Tant que TikTok n'a pas validé l'app (audit), les publications restent privées : soumettez l'app à validation.</li>
          </ol>
        </div>
        <div className="card reveal" style={{ gridColumn: "1/-1" }}>
          <h2>Utilisateurs et minutes</h2>
          <table><thead><tr><th>Email</th><th>Rôle</th><th>Minutes restantes</th><th>Ajouter</th></tr></thead><tbody>
            {users.map((x) => (
              <tr key={x.id}><td>{x.email}</td><td>{x.role}</td><td>{x.role === "admin" ? "illimité" : x.credits.reduce((a, c) => a + c.minutes, 0)}</td>
                <td>{x.role !== "admin" && <form action={grantMinutes} className="row" style={{ flexWrap: "nowrap" }}><input type="hidden" name="userId" value={x.id} /><input name="minutes" type="number" defaultValue={60} style={{ width: 90 }} /><button className="btn sm">+</button></form>}</td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </main>
  );
}
