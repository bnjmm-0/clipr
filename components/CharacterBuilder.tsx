"use client";
import { useState } from "react";
import { BUILDER, FRUITS, assembleLook, type BuilderState } from "@/lib/fruit-builder";
import { createCharacter } from "@/app/actions";

// Créateur de personnages : choix en un clic, description assemblée et visible en direct,
// puis createCharacter (fiche de référence, ou 3 variantes au choix, générée en arrière-plan).
// `voices` : options de la liste « Voix » (VoiceOptions, rendues côté serveur).
export default function CharacterBuilder({ voices, defaultVoice = "alloy" }: { voices: React.ReactNode; defaultVoice?: string }) {
  const start: BuilderState = { fruit: "fraise", gender: "fille", age: "adulte", body: BUILDER.body[0], eyes: BUILDER.eyes[0], mood: "souriant", accessories: [], outfit: "", texture: BUILDER.textures[0][0], details: "", personality: [] };
  const [s, setS] = useState<BuilderState>(start);
  const [other, setOther] = useState("");
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [variants, setVariants] = useState("3");
  const up = <K extends keyof BuilderState>(k: K, v: BuilderState[K]) => setS((p) => ({ ...p, [k]: v }));
  const toggle = (k: "accessories" | "personality", v: string) => setS((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  const look = assembleLook({ ...s, fruit: other.trim() || s.fruit });
  const personality = [...s.personality, extra.trim()].filter(Boolean).join(", ");
  const one = (k: "gender" | "age", options: string[]) => (
    <div className="chips">{options.map((o) => <button key={o} type="button" className={`chip ${s[k] === o ? "on" : ""}`} onClick={() => up(k, o)}>{o}</button>)}</div>
  );
  async function submit(fd: FormData) {
    await createCharacter(fd);
    setName(""); setExtra("");
  }
  return (
    <form action={submit} className="panel builder">
      <h2>Créer un personnage</h2>
      <p className="xs muted" style={{ marginTop: 4 }}>Choisis en quelques clics : Clipr écrit la description et dessine sa fiche de référence, qui le garde identique dans toutes tes vidéos.</p>

      <label>Fruit</label>
      <div className="fruitpick">{FRUITS.map(([e, f]) => (
        <button key={f} type="button" className={`fruit ${!other && s.fruit === f ? "on" : ""}`} onClick={() => { setOther(""); up("fruit", f); }} aria-pressed={!other && s.fruit === f}><span aria-hidden>{e}</span>{f}</button>
      ))}</div>
      <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Autre : un légume, un objet, un animal…" style={{ marginTop: 8 }} maxLength={60} />

      <div className="grid builder2">
        <div><label>Nom</label><input name="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex. Mme Pêche, Banana Joe" /></div>
        <div><label>Style</label><select name="visualStyle" value={s.texture} onChange={(e) => up("texture", e.target.value)}>{BUILDER.textures.map(([l]) => <option key={l}>{l}</option>)}</select></div>
        <div><label>Genre</label>{one("gender", BUILDER.gender)}</div>
        <div><label>Âge</label>{one("age", BUILDER.age)}</div>
        <div><label>Corps</label><select value={s.body} onChange={(e) => up("body", e.target.value)}>{BUILDER.body.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label>Yeux</label><select value={s.eyes} onChange={(e) => up("eyes", e.target.value)}>{BUILDER.eyes.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label>Expression</label><select value={s.mood} onChange={(e) => up("mood", e.target.value)}>{BUILDER.mood.map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label>Tenue</label><input value={s.outfit} onChange={(e) => up("outfit", e.target.value)} list="builder-outfits" maxLength={80} placeholder="Ex. maillot de bain" />
          <datalist id="builder-outfits">{BUILDER.outfits.map((o) => <option key={o} value={o} />)}</datalist></div>
      </div>

      <label>Accessoires</label>
      <div className="chips">{BUILDER.accessories.map((o) => <button key={o} type="button" className={`chip ${s.accessories.includes(o) ? "on" : ""}`} onClick={() => toggle("accessories", o)}>{o}</button>)}</div>
      <label>Détails en plus (facultatif)</label>
      <input value={s.details} onChange={(e) => up("details", e.target.value)} maxLength={200} placeholder="Ex. une feuille en forme de mèche, une tache de rousseur" />

      <label>Personnalité (elle guide ses répliques et le ton de sa voix)</label>
      <div className="chips">{BUILDER.personality.map((o) => <button key={o} type="button" className={`chip ${s.personality.includes(o) ? "on" : ""}`} onClick={() => toggle("personality", o)}>{o}</button>)}</div>
      <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={120} placeholder="Autre trait : ex. parle toujours de son ex" style={{ marginTop: 8 }} />

      <div className="grid builder2">
        <div><label>Voix</label><select name="voice" defaultValue={defaultVoice}>{voices}</select></div>
        <div><label>Fiche de référence</label><select name="variants" value={variants} onChange={(e) => setVariants(e.target.value)}>
          <option value="3">3 propositions au choix (≈ 0,19 $)</option><option value="1">1 seule (≈ 0,06 $)</option></select></div>
      </div>

      <div className="lookpreview">
        <span className="xs muted">Description utilisée pour chaque image</span>
        <p>{look}</p>
        {personality && <p className="xs muted" style={{ marginTop: 6 }}>Personnalité : {personality}</p>}
      </div>
      <input type="hidden" name="look" value={look} />
      <input type="hidden" name="personality" value={personality} />
      <button className="btn accent" style={{ marginTop: 16 }} disabled={!name.trim()}>Créer le personnage</button>
    </form>
  );
}
