import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { credentialStatus, getSettings } from "@/lib/settings";
import { parseAuto } from "@/lib/autopublish";
import { cancelPublication, disconnectAccount, saveAutoPublish } from "@/app/actions";

const LABEL: Record<string, string> = { tiktok: "TikTok", facebook: "Facebook" };

export default async function Accounts() {
  const u = await requireUser();
  const s = await getSettings();
  const creds = await credentialStatus();
  const accounts = await prisma.socialAccount.findMany({ where: { userId: u.id } });
  const a = parseAuto(u.autoPublishJson);
  const queue = await prisma.publication.findMany({ where: { userId: u.id }, orderBy: [{ scheduledAt: "asc" }], take: 50, include: { clip: true, episode: true } });
  const platforms = [
    { id: "tiktok", on: s.features.tiktokPublish, ready: !!creds.tiktok_client_key && !!creds.tiktok_client_secret, href: "/api/tiktok/connect" },
    { id: "facebook", on: s.features.facebookPublish, ready: !!creds.meta_app_id && !!creds.meta_app_secret, href: "/api/facebook/connect" },
  ].filter((p) => p.on);
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Comptes et publication</h1><p>Connecte TikTok et ta Page Facebook, puis choisis tes créneaux : chaque vidéo prête part toute seule au prochain créneau libre.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}>
        <div className="panel">
          <h2>Comptes connectés</h2>
          {platforms.map((p) => {
            const acc = accounts.find((x) => x.platform === p.id);
            return (
              <div key={p.id} className="row raised" style={{ padding: 12, marginTop: 12, flexWrap: "nowrap" }}>
                {acc?.avatarUrl ? <img src={acc.avatarUrl} alt="" width={32} height={32} style={{ borderRadius: 16 }} /> : <span className="dot" />}
                <div style={{ flex: 1, minWidth: 0 }}><div>{LABEL[p.id]}</div><div className="xs muted">{acc ? acc.displayName ?? "Connecté" : p.ready ? "Non connecté" : "Identifiants de l'app à saisir dans Réglages"}</div></div>
                {acc ? <form action={disconnectAccount.bind(null, p.id)}><button className="btn quiet sm">Déconnecter</button></form>
                  : <a className={`btn sm ${p.ready ? "" : "ghost"}`} href={p.ready ? p.href : "/reglages"}>{p.ready ? "Connecter" : "Configurer"}</a>}
              </div>
            );
          })}
          {platforms.length === 0 && <p className="note" style={{ marginTop: 12 }}>Active la publication TikTok ou Facebook dans Réglages.</p>}
          <p className="xs muted" style={{ marginTop: 16 }}>Tant que TikTok n'a pas validé ton app, les vidéos y sont publiées en privé.</p>
        </div>

        {s.features.autoPublish && (
          <form action={saveAutoPublish} className="panel">
            <h2>Publication automatique</h2>
            <label className="check" style={{ marginTop: 16 }}><input type="checkbox" name="enabled" defaultChecked={a.enabled} /><span><span>Activer</span><span className="xs muted" style={{ display: "block" }}>Chaque vidéo terminée est planifiée sur le prochain créneau libre</span></span></label>
            <label>Plateformes</label>
            <div className="seg">{["tiktok", "facebook"].map((p) => <label key={p}><input type="checkbox" name="platforms" value={p} defaultChecked={a.platforms.includes(p)} />{LABEL[p]}</label>)}</div>
            <label>Créneaux quotidiens (heures séparées par des virgules)</label>
            <input name="times" defaultValue={a.times.join(", ")} placeholder="09:00, 12:30, 19:00" />
            <label>Ce qui part automatiquement</label>
            <div className="seg"><label><input type="checkbox" name="episodes" defaultChecked={a.episodes} />Vidéos IA et épisodes</label><label><input type="checkbox" name="clips" defaultChecked={a.clips} />Clips</label></div>
            <label>Visibilité TikTok</label>
            <select name="privacy" defaultValue={a.privacy}><option value="SELF_ONLY">Privé</option><option value="PUBLIC_TO_EVERYONE">Public</option><option value="MUTUAL_FOLLOW_FRIENDS">Amis</option></select>
            <button className="btn sm" style={{ marginTop: 20 }}>Enregistrer</button>
          </form>
        )}
      </div>

      <div className="panel" style={{ marginTop: 24, padding: "8px 24px" }}>
        <h2 style={{ padding: "16px 0 8px" }}>File de publication</h2>
        {queue.length === 0 ? <p className="sec small" style={{ paddingBottom: 16 }}>Rien de prévu.</p> : (
          <table><thead><tr><th>Vidéo</th><th>Plateforme</th><th>Prévue</th><th>État</th><th /></tr></thead><tbody>
            {queue.map((p) => (
              <tr key={p.id}>
                <td>{p.clip?.title ?? p.episode?.title ?? "–"}</td><td>{LABEL[p.platform]}{p.auto ? " · auto" : ""}</td>
                <td className="num">{p.scheduledAt?.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) ?? "immédiate"}</td>
                <td><span className="tag"><span className={`dot ${p.state === "sent" ? "ok" : p.state === "failed" ? "err" : "live"}`} />{{ scheduled: "Planifiée", sending: "Envoi", sent: "Publiée", failed: "Échec" }[p.state] ?? p.state}{p.error ? ` · ${p.error}` : ""}</span></td>
                <td>{p.state === "scheduled" && <form action={cancelPublication.bind(null, p.id)}><button className="btn quiet sm">Annuler</button></form>}</td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
  );
}
