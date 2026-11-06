"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/actions";
import Icon from "./Icon";

const STYLES = [["bold", "Pop"], ["bounce", "Rebond"], ["box", "Encadré"], ["typewriter", "Machine à écrire"]];
const LANGS = [["fr", "🇫🇷", "Français"], ["en", "🇬🇧", "Anglais"], ["ar", "🇸🇦", "Arabe"], ["es", "🇪🇸", "Espagnol"], ["auto", "✨", "Auto"]];
const CROPS = [["center", "Suivre le visage", "Le cadre suit la personne qui parle"], ["wide", "Plan large", "Toute l'image, fond flou autour"]];
// Durées des clips en secondes : mêmes limites que createProject (min 10–90, max ≥ min + 5, jusqu'à 180).
const PRESETS: [string, number, number][] = [["Courts", 15, 30], ["Moyens", 20, 60], ["Longs", 45, 90], ["Très longs", 60, 180]];

function platformOf(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\.|^m\./, "");
    if (/youtube\.com$|youtu\.be$/.test(h)) return "YouTube";
    if (/twitch\.tv$/.test(h)) return "Twitch";
    if (/tiktok\.com$/.test(h)) return "TikTok";
    if (/instagram\.com$/.test(h)) return "Instagram";
    if (/vimeo\.com$/.test(h)) return "Vimeo";
    if (/facebook\.com$|fb\.watch$/.test(h)) return "Facebook";
    if (/^(x|twitter)\.com$/.test(h)) return "X";
    return "Lien";
  } catch { return null; }
}

export default function NewProject({ defaultUrl }: { defaultUrl?: string }) {
  const r = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [min, setMin] = useState(20);
  const [max, setMax] = useState(60);
  const [count, setCount] = useState(6);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const platform = url.trim() ? platformOf(url.trim()) : null;

  // Aperçu de la vidéo choisie (première image), libéré quand le fichier change.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pick = (f: File | null | undefined) => { if (f) { setFile(f); setErr(""); } };
  const setMinSafe = (v: number) => { setMin(v); if (max < v + 5) setMax(Math.min(180, v + 5)); };
  const setMaxSafe = (v: number) => { setMax(v); if (v < min + 5) setMin(Math.max(10, v - 5)); };

  async function submit(fd: FormData) {
    setErr("");
    if (!file && !String(fd.get("url") || "").trim()) return setErr("Ajoute un fichier ou un lien");
    if (file && !fd.get("title")) fd.set("title", file.name.replace(/\.[^.]+$/, ""));
    try {
      const { id } = await createProject(fd);
      if (file) {
        setPct(0);
        await new Promise<void>((res, rej) => {
          const x = new XMLHttpRequest();
          x.open("PUT", `/api/projects/${id}/upload?name=${encodeURIComponent(file.name)}`);
          x.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
          x.onload = () => (x.status < 300 ? res() : rej(new Error(x.responseText || "Échec de l'envoi")));
          x.onerror = () => rej(new Error("Échec de l'envoi"));
          x.send(file);
        });
      }
      r.push(`/projets/${id}`);
    } catch (e) { setErr((e as Error).message); setPct(null); }
  }

  return (
    <form action={submit} className="panel newproj">
      <h2>Nouveau projet</h2>

      <div className="npsec"><span className="num">1</span>Ta vidéo</div>
      <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {file ? (
        <div className="filecard">
          {preview ? <video src={preview} muted playsInline preload="metadata" /> : <span className="fileicon"><Icon name="film" /></span>}
          <div style={{ minWidth: 0 }}>
            <div className="fname">{file.name}</div>
            <div className="xs muted num">{(file.size / 1e6).toFixed(0)} Mo · prête à être envoyée</div>
          </div>
          <span className="sp" />
          <button type="button" className="btn quiet sm" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>Retirer</button>
        </div>
      ) : (
        <div className={`dropz ${over ? "over" : ""}`} role="button" tabIndex={0} onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
          <span className="dropicon"><Icon name="upload" size={22} /></span>
          <div><b>Glisse ta vidéo ici</b></div>
          <div className="xs muted">ou clique pour choisir un fichier (MP4, MOV…) : la voie la plus fiable</div>
        </div>
      )}

      <div className="ordiv"><span>ou</span></div>
      <div className={`linkfield ${file ? "off" : ""}`}>
        <Icon name="link" />
        <input name="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Colle un lien YouTube, Twitch, TikTok…" disabled={!!file} aria-label="Lien de la vidéo" />
        {platform && !file && <span className="tag platform">{platform}</span>}
      </div>
      {platform === "YouTube" && !file && <p className="xs muted" style={{ marginTop: 6 }}>YouTube bloque parfois les téléchargements depuis un serveur : si ça échoue, importe le fichier.</p>}

      <div className="np2">
        <div><label htmlFor="np-title">Titre (facultatif)</label><input id="np-title" name="title" placeholder={file ? file.name.replace(/\.[^.]+$/, "") : "Mon podcast épisode 12"} /></div>
        <div>
          <label>Langue parlée</label>
          <div className="chips">{LANGS.map(([v, flag, l]) => (
            <label key={v}><input type="radio" name="language" value={v} defaultChecked={v === "fr"} /><span>{flag} {l}</span></label>
          ))}</div>
        </div>
      </div>

      <div className="npsec"><span className="num">2</span>Tes clips</div>
      <label>Durée de chaque clip</label>
      <div className="chips">{PRESETS.map(([l, a, b]) => (
        <button key={l} type="button" className={`chip ${min === a && max === b ? "on" : ""}`} onClick={() => { setMin(a); setMax(b); }}>{l} <span className="muted num">{a}–{b} s</span></button>
      ))}</div>
      <div className="np2" style={{ marginTop: 4 }}>
        <div className="rangebox">
          <div className="row" style={{ justifyContent: "space-between" }}><span className="xs muted">Minimum</span><b className="num">{min} s</b></div>
          <input type="range" name="minClipSec" min={10} max={90} step={5} value={min} onChange={(e) => setMinSafe(Number(e.target.value))} aria-label="Durée minimum en secondes" />
        </div>
        <div className="rangebox">
          <div className="row" style={{ justifyContent: "space-between" }}><span className="xs muted">Maximum</span><b className="num">{max} s</b></div>
          <input type="range" name="maxClipSec" min={15} max={180} step={5} value={max} onChange={(e) => setMaxSafe(Number(e.target.value))} aria-label="Durée maximum en secondes" />
        </div>
      </div>
      <div className="rangebox" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><span className="xs muted">Nombre de clips</span><b className="num countval">{count}</b></div>
        <input type="range" name="clipCount" min={1} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Nombre de clips" />
      </div>

      <div className="npsec"><span className="num">3</span>Le rendu</div>
      <label>Recadrage vertical</label>
      <div className="croppick">{CROPS.map(([v, l, d], i) => (
        <label key={v}><input type="radio" name="cropMode" value={v} defaultChecked={i === 0} /><img src={`/clips/crop-${v}.webp`} alt="" loading="lazy" /><span><b>{l}</b><span className="xs muted" style={{ display: "block" }}>{d}</span></span></label>
      ))}</div>
      <label>Style des sous-titres animés</label>
      <div className="stylepick">{STYLES.map(([v, l], i) => (
        <label key={v}><input type="radio" name="captionStyle" value={v} defaultChecked={i === 0} /><img src={`/clips/style-${v}.webp`} alt="" loading="lazy" /><span>{l}</span></label>
      ))}</div>

      <label className="check" style={{ marginTop: 20 }}>
        <input type="checkbox" name="rights" required /><span className="small">Je confirme détenir les droits nécessaires sur cette vidéo</span>
      </label>
      {err && <p className="alert">{err}</p>}
      {pct !== null && <div style={{ marginTop: 16 }}><div className="progress"><i style={{ transform: `scaleX(${pct / 100})` }} /></div><p className="xs muted num" style={{ marginTop: 8 }}>Envoi {pct} %</p></div>}
      <button className="btn accent lg" style={{ marginTop: 20, width: "100%" }} disabled={pct !== null}>{pct !== null ? "Envoi en cours…" : `Lancer le traitement · ${count} clip${count > 1 ? "s" : ""}`}</button>
    </form>
  );
}
