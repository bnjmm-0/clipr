"use client";
import { useState } from "react";
import { publishClip, setClipStatus, updateClip } from "@/app/actions";

type Clip = { id: string; title: string; score: number; reason: string | null; startSec: number; endSec: number; style: string; cropOffset: number; status: string; caption: string };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function ClipCard({ c, i, canPublish, tiktokConnected }: { c: Clip; i: number; canPublish: boolean; tiktokConnected: boolean }) {
  const [tab, setTab] = useState<"" | "edit" | "pub">("");
  const [captionEdited, setCE] = useState(false);
  const ready = c.status === "ready";
  return (
    <div className="card clip" style={{ animationDelay: `${i * 0.06}s`, opacity: c.status === "discarded" ? 0.45 : 1 }}>
      {ready ? <video src={`/api/files?clip=${c.id}`} poster={`/api/files?clip=${c.id}&kind=thumb`} controls preload="none" playsInline />
        : <div className="skeleton" style={{ display: "grid", placeItems: "center" }}><span className="pill run">{c.status === "failed" ? "Échec du rendu" : c.status === "discarded" ? "Écarté" : "Rendu en cours…"}</span></div>}
      <div className="b">
        <div className="row"><span className="score">{c.score}</span><b style={{ flex: 1 }}>{c.title}</b></div>
        <p className="small muted">{fmt(c.startSec)} → {fmt(c.endSec)} · {Math.round(c.endSec - c.startSec)} s{c.reason ? ` · ${c.reason}` : ""}</p>
        <div className="row">
          {ready && <a className="btn sm" href={`/api/files?clip=${c.id}&dl=1`}>Télécharger MP4</a>}
          <button className="btn ghost sm" onClick={() => setTab(tab === "edit" ? "" : "edit")}>Éditer</button>
          {canPublish && ready && <button className="btn ghost sm" onClick={() => setTab(tab === "pub" ? "" : "pub")}>TikTok</button>}
          <button className="btn ghost sm" onClick={() => setClipStatus(c.id, c.status === "discarded" ? "ready" : "discarded")}>{c.status === "discarded" ? "Garder" : "Écarter"}</button>
        </div>
        {tab === "edit" && (
          <form action={updateClip} className="reveal">
            <input type="hidden" name="clipId" value={c.id} />
            <input type="hidden" name="captionEdited" value={captionEdited ? "1" : "0"} />
            <label>Titre d'accroche (affiché en ouverture)</label><input name="title" defaultValue={c.title} />
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <div style={{ flex: 1 }}><label>Début (s)</label><input name="startSec" type="number" step="0.1" defaultValue={c.startSec.toFixed(1)} /></div>
              <div style={{ flex: 1 }}><label>Fin (s)</label><input name="endSec" type="number" step="0.1" defaultValue={c.endSec.toFixed(1)} /></div>
            </div>
            <label>Style animé</label>
            <select name="style" defaultValue={c.style}><option value="bold">Pop</option><option value="bounce">Rebond</option><option value="box">Encadré</option><option value="typewriter">Machine à écrire</option></select>
            <label>Cadre horizontal (0 = gauche, 1 = droite ; 0,5 = suivi auto du visage)</label>
            <input name="cropOffset" type="range" min="0" max="1" step="0.05" defaultValue={c.cropOffset} />
            <label>Texte des sous-titres</label>
            <textarea name="caption" rows={4} defaultValue={c.caption} onChange={() => setCE(true)} />
            <button className="btn sm" style={{ marginTop: 10 }}>Enregistrer et refaire le rendu</button>
          </form>
        )}
        {tab === "pub" && (
          tiktokConnected ? (
            <form action={publishClip} className="reveal">
              <input type="hidden" name="clipId" value={c.id} />
              <label>Légende</label><textarea name="caption" rows={3} defaultValue={c.title} />
              <label>Visibilité</label>
              <select name="privacy"><option value="SELF_ONLY">Privé (obligatoire tant que l'app TikTok n'est pas validée)</option><option value="PUBLIC_TO_EVERYONE">Public</option><option value="MUTUAL_FOLLOW_FRIENDS">Amis</option></select>
              <label>Planifier (laisser vide = maintenant)</label><input type="datetime-local" name="scheduledAt" />
              <button className="btn sm" style={{ marginTop: 10 }}>Envoyer sur TikTok</button>
            </form>
          ) : <p className="note small">Connectez d'abord votre compte TikTok depuis la page Coach TikTok.</p>
        )}
      </div>
    </div>
  );
}
