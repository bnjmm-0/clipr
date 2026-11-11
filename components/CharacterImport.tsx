"use client";
import { useRef, useState } from "react";
import { importCharacter } from "@/app/actions";

// Import d'un personnage fait ailleurs : l'image est réduite dans le navigateur (1024 px, JPEG)
// avant l'envoi, puis importCharacter en fait la fiche de référence et lance son analyse.
// `voices` : options de la liste « Voix » (VoiceOptions, rendues côté serveur).
export default function CharacterImport({ voices }: { voices: React.ReactNode }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);

  async function pick(f: File | undefined) {
    setMsg(null);
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setMsg({ text: "Format non pris en charge : utilise une image PNG, JPEG ou WebP." });
    const img = await createImageBitmap(f).catch(() => null);
    if (!img) return setMsg({ text: "Image illisible : essaie avec un autre fichier." });
    const k = Math.min(1, 1024 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); // fond blanc si l'image est transparente
    g.drawImage(img, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!b) return setMsg({ text: "Image illisible : essaie avec un autre fichier." });
    setBlob(b);
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(b); });
  }

  async function submit(fd: FormData) {
    if (!blob) return setMsg({ text: "Choisis une image de ton personnage." });
    setBusy(true);
    fd.set("image", new File([blob], "personnage.jpg", { type: "image/jpeg" }));
    const r = await importCharacter(fd).catch(() => ({ error: "Envoi impossible : réessaie." }));
    setBusy(false);
    if (r.error) return setMsg({ text: r.error });
    setMsg({ ok: true, text: "Personnage ajouté : l'analyse de l'image arrive dans « Mes personnages »." });
    setBlob(null);
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={submit} className="panel builder">
      <h2>Importer un personnage</h2>
      <p className="xs muted" style={{ marginTop: 4 }}>Tu as créé ton fruit ailleurs (Midjourney, Magnific…) ? Dépose son image : elle devient sa fiche de référence, sans rien générer. Clipr l'analyse une seule fois et écrit une description courte, réutilisée dans chaque image pour économiser des tokens.</p>
      <div className={`dropz ${over ? "over" : ""}`} role="button" tabIndex={0} style={{ marginTop: 12 }}
        onClick={() => fileRef.current?.click()} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
        {preview ? <img src={preview} alt="Aperçu du personnage" style={{ maxHeight: 180, borderRadius: 10, display: "block", margin: "0 auto" }} />
          : <span className="small">Dépose l'image ici, ou clique pour la choisir <span className="xs muted">· PNG, JPEG ou WebP</span></span>}
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginTop: 12 }}>
        <div><label>Nom <span className="xs muted">(facultatif)</span></label><input name="name" maxLength={60} placeholder="Sinon, l'IA en propose un" /></div>
        <div><label>Voix</label><select name="voice" defaultValue="alloy">{voices}</select></div>
      </div>
      <label>Personnalité <span className="xs muted">(facultatif)</span></label>
      <input name="personality" maxLength={600} placeholder="Ex. jalouse, dramatique. Sinon, l'IA la devine" />
      {msg && <p className="xs" style={{ marginTop: 10, color: msg.ok ? "var(--accent)" : "var(--err)" }}>{msg.text}</p>}
      <button className="btn accent" style={{ marginTop: 14, width: "100%" }} disabled={busy || !blob}>{busy ? "Envoi…" : "Importer et analyser"}</button>
    </form>
  );
}
