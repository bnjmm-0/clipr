"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createRemix } from "@/app/actions";
import DurationField from "./DurationField";

export default function RemixForm({ characters, videoModel, defaultUrl }: { characters: { id: string; name: string }[]; videoModel: boolean; defaultUrl?: string }) {
  const r = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  async function submit(fd: FormData) {
    setErr("");
    if (!file && !String(fd.get("url") || "").trim()) return setErr("Ajoute un fichier ou un lien");
    try {
      const { id } = await createRemix(fd);
      if (file) {
        setPct(0);
        await new Promise<void>((res, rej) => {
          const x = new XMLHttpRequest();
          x.open("PUT", `/api/episodes/${id}/upload?name=${encodeURIComponent(file.name)}`);
          x.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
          x.onload = () => (x.status < 300 ? res() : rej(new Error(x.responseText || "Échec de l'envoi")));
          x.onerror = () => rej(new Error("Échec de l'envoi"));
          x.send(file);
        });
      }
      r.push(`/videos-ia/${id}`);
    } catch (e) { setErr((e as Error).message); setPct(null); }
  }
  return (
    <form action={submit} className="panel">
      <h2 style={{ marginBottom: 16 }}>Vidéo à reprendre</h2>
      <div className="drop" onClick={() => ref.current?.click()}>
        <input ref={ref} type="file" accept="video/*,audio/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? <span className="num">{file.name} · {(file.size / 1e6).toFixed(0)} Mo</span> : <><div>Choisis un fichier vidéo ou audio</div><div className="xs muted" style={{ marginTop: 4 }}>ou colle un lien ci-dessous</div></>}
      </div>
      <label>Lien</label><input name="url" placeholder="https://" disabled={!!file} defaultValue={defaultUrl} />
      <label>Ce que tu veux changer</label>
      <textarea name="brief" rows={2} placeholder="Ex. même structure, mais sur la cuisine végétarienne, avec mon personnage" />
      <DurationField />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <div><label>Personnage</label><select name="characterId"><option value="">Sans personnage</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label>Visuels</label><select name="visualMode"><option value="image">Images animées</option><option value="video" disabled={!videoModel}>Plans vidéo IA</option></select></div>
        <div><label>Sous-titres</label><select name="captionStyle"><option value="bold">Pop</option><option value="bounce">Rebond</option><option value="box">Encadré</option><option value="typewriter">Machine à écrire</option></select></div>
        <div><label>Langue</label><select name="language"><option value="fr">Français</option><option value="en">Anglais</option><option value="es">Espagnol</option><option value="ar">Arabe</option></select></div>
      </div>
      <label className="check" style={{ marginTop: 16 }}><input type="checkbox" name="rights" required /><span className="small">Je peux utiliser cette vidéo comme source d'inspiration ; la nouvelle version ne reprend aucune phrase ni image</span></label>
      {err && <p className="alert">{err}</p>}
      {pct !== null && <div style={{ marginTop: 16 }}><div className="progress"><i style={{ transform: `scaleX(${pct / 100})` }} /></div><p className="xs muted num" style={{ marginTop: 8 }}>Envoi {pct} %</p></div>}
      <button className="btn accent" style={{ marginTop: 20 }} disabled={pct !== null}>Analyser et créer ma version</button>
    </form>
  );
}
