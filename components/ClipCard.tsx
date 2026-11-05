"use client";
import { useState } from "react";
import { setClipStatus, updateClip } from "@/app/actions";
import PublishForm from "./PublishForm";
import Icon from "./Icon";

type Clip = { id: string; title: string; score: number; reason: string | null; startSec: number; endSec: number; style: string; cropOffset: number; status: string; caption: string; hasCover: boolean };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function ClipCard({ c, platforms }: { c: Clip; platforms: { id: string; label: string }[] }) {
  const [tab, setTab] = useState<"" | "edit" | "pub" | "cover">("");
  const [captionEdited, setCE] = useState(false);
  const ready = c.status === "ready";
  return (
    <div className="card clip" style={{ opacity: c.status === "discarded" ? 0.5 : 1 }}>
      {ready ? <video src={`/api/files?clip=${c.id}`} poster={`/api/files?clip=${c.id}&kind=${c.hasCover ? "cover" : "thumb"}`} controls preload="none" playsInline />
        : <div className="placeholder"><span className="tag"><span className={`dot ${c.status === "failed" ? "err" : c.status === "discarded" ? "" : "live"}`} />{c.status === "failed" ? "Échec du rendu" : c.status === "discarded" ? "Écarté" : "Rendu en cours"}</span></div>}
      <div className="b">
        <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><span className="score">{c.score}</span><h3 style={{ flex: 1 }}>{c.title}</h3></div>
        <p className="xs muted num">{fmt(c.startSec)} → {fmt(c.endSec)} · {Math.round(c.endSec - c.startSec)} s{c.reason ? ` · ${c.reason}` : ""}</p>
        <div className="row" style={{ gap: 8 }}>
          {ready && <a className="btn sm" href={`/api/files?clip=${c.id}&dl=1`}><Icon name="download" size={16} />MP4</a>}
          {ready && c.hasCover && <button className="btn ghost sm" onClick={() => setTab(tab === "cover" ? "" : "cover")}>Miniature</button>}
          <button className="btn ghost sm" onClick={() => setTab(tab === "edit" ? "" : "edit")}>Éditer</button>
          {ready && <button className="btn ghost sm" onClick={() => setTab(tab === "pub" ? "" : "pub")}>Publier</button>}
          <button className="btn quiet sm" onClick={() => setClipStatus(c.id, c.status === "discarded" ? "ready" : "discarded")}>{c.status === "discarded" ? "Garder" : "Écarter"}</button>
        </div>
        {tab === "cover" && (
          <div className="stack-8"><img className="media" style={{ borderRadius: 8, width: "100%" }} src={`/api/files?clip=${c.id}&kind=cover`} alt="Miniature" />
            <a className="btn ghost sm" href={`/api/files?clip=${c.id}&kind=cover&dl=1`}>Télécharger la miniature</a></div>
        )}
        {tab === "edit" && (
          <form action={updateClip}>
            <input type="hidden" name="clipId" value={c.id} />
            <input type="hidden" name="captionEdited" value={captionEdited ? "1" : "0"} />
            <label>Accroche affichée en ouverture</label><input name="title" defaultValue={c.title} />
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <div style={{ flex: 1 }}><label>Début (s)</label><input name="startSec" type="number" step="0.1" defaultValue={c.startSec.toFixed(1)} /></div>
              <div style={{ flex: 1 }}><label>Fin (s)</label><input name="endSec" type="number" step="0.1" defaultValue={c.endSec.toFixed(1)} /></div>
            </div>
            <label>Style des sous-titres</label>
            <select name="style" defaultValue={c.style}><option value="bold">Pop</option><option value="bounce">Rebond</option><option value="box">Encadré</option><option value="typewriter">Machine à écrire</option></select>
            <label>Cadre horizontal (0,5 = suivi automatique du visage)</label>
            <input name="cropOffset" type="range" min="0" max="1" step="0.05" defaultValue={c.cropOffset} />
            <label>Texte des sous-titres</label>
            <textarea name="caption" rows={4} defaultValue={c.caption} onChange={() => setCE(true)} />
            <button className="btn sm" style={{ marginTop: 16 }}>Refaire le rendu</button>
          </form>
        )}
        {tab === "pub" && <PublishForm clipId={c.id} caption={c.title} platforms={platforms} />}
      </div>
    </div>
  );
}
