"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/actions";

const STYLES = [["bold", "Pop"], ["bounce", "Rebond"], ["box", "Encadré"], ["typewriter", "Machine à écrire"]];

export default function NewProject({ defaultUrl }: { defaultUrl?: string }) {
  const r = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");

  async function submit(fd: FormData) {
    setErr("");
    if (!file && !String(fd.get("url") || "").trim()) return setErr("Ajoutez un fichier ou un lien");
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
    <form action={submit} className="panel">
      <h2 style={{ marginBottom: 16 }}>Nouveau projet</h2>
      <div className={`drop ${over ? "over" : ""}`} onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); setFile(e.dataTransfer.files[0] ?? null); }}>
        <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? <span className="num">{file.name} · {(file.size / 1e6).toFixed(0)} Mo</span> : <><div>Glisse ta vidéo ici</div><div className="xs muted" style={{ marginTop: 4 }}>ou clique pour choisir un fichier, la voie la plus fiable</div></>}
      </div>
      <label>Ou un lien (YouTube peut bloquer les téléchargements depuis un serveur)</label>
      <input name="url" defaultValue={defaultUrl} placeholder="https://" disabled={!!file} />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <div><label>Titre</label><input name="title" /></div>
        <div><label>Langue</label><select name="language" defaultValue="fr"><option value="fr">Français</option><option value="en">Anglais</option><option value="ar">Arabe</option><option value="es">Espagnol</option><option value="auto">Détection auto</option></select></div>
        <div><label>Durée min (s)</label><input name="minClipSec" type="number" defaultValue={20} min={10} max={90} /></div>
        <div><label>Durée max (s, jusqu'à 180)</label><input name="maxClipSec" type="number" defaultValue={60} min={15} max={180} /></div>
        <div><label>Nombre de clips</label><input name="clipCount" type="number" defaultValue={6} min={1} max={15} /></div>
        <div><label>Recadrage</label><select name="cropMode"><option value="center">Suivre le visage</option><option value="wide">Plan large (fond flou)</option></select></div>
      </div>
      <label>Style des sous-titres animés</label>
      <div className="seg">{STYLES.map(([v, l], i) => (
        <label key={v}><input type="radio" name="captionStyle" value={v} defaultChecked={i === 0} />{l}</label>
      ))}</div>
      <label className="check" style={{ marginTop: 16 }}>
        <input type="checkbox" name="rights" required /><span className="small">Je confirme détenir les droits nécessaires sur cette vidéo</span>
      </label>
      {err && <p className="alert">{err}</p>}
      {pct !== null && <div style={{ marginTop: 16 }}><div className="progress"><i style={{ transform: `scaleX(${pct / 100})` }} /></div><p className="xs muted num" style={{ marginTop: 8 }}>Envoi {pct} %</p></div>}
      <button className="btn accent" style={{ marginTop: 20 }} disabled={pct !== null}>Lancer le traitement</button>
    </form>
  );
}
