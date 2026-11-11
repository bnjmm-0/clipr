"use client";
import { useRef, useState } from "react";
import { STORY_RECIPES, fillRecipe } from "@/lib/story-ideas";
import { improveStoryIdea } from "@/app/actions";

// Champ « idée » des vidéos IA et des séries, avec son aide : recettes d'histoires (gratuites, remplies avec les
// personnages cochés du formulaire) et « Améliorer avec l'IA » (3 propositions à choisir).
export default function StoryIdeaField({ name, label, kind, defaultValue = "", placeholder, rows = 3 }: {
  name: string; label: string; kind: "video" | "series"; defaultValue?: string; placeholder?: string; rows?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<{ title: string; idea: string }[]>([]);
  const [error, setError] = useState("");

  // Personnages cochés dans le même formulaire (cases « cast », dans l'ordre d'affichage).
  const cast = () => [...(box.current?.closest("form")?.querySelectorAll<HTMLInputElement>('input[name="cast"]:checked') ?? [])];

  async function improve() {
    setBusy(true); setError(""); setIdeas([]);
    const r = await improveStoryIdea({ idea: text, cast: cast().map((c) => c.value), kind }).catch(() => ({ error: "Envoi impossible : réessaie." }));
    setBusy(false);
    if ("ideas" in r && r.ideas) setIdeas(r.ideas); else setError(r.error ?? "L'IA n'a rien proposé : réessaie.");
  }

  return (
    <div ref={box}>
      <label>{label}</label>
      <textarea name={name} rows={rows} required value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <div className="xs muted" style={{ marginTop: 8 }}>Besoin d'une idée ? Choisis une recette (elle reprend tes personnages cochés) ou fais améliorer la tienne.</div>
      <div className="chips" style={{ marginTop: 6 }}>
        {STORY_RECIPES.map((r) => (
          <button key={r.id} type="button" className="chip" onClick={() => { setText(fillRecipe(r, kind, cast().map((c) => c.dataset.name ?? ""))); setIdeas([]); }}>{r.label}</button>
        ))}
      </div>
      <button type="button" className="btn ghost sm" style={{ marginTop: 8 }} onClick={improve} disabled={busy}>
        {busy ? "L'IA écrit 3 idées…" : text.trim() ? "✨ Améliorer mon idée avec l'IA" : "✨ Trouver 3 idées avec l'IA"}
      </button>
      {error && <p className="xs" style={{ color: "var(--err)", marginTop: 8 }}>{error}</p>}
      {ideas.length > 0 && (
        <div className="stack-8" style={{ marginTop: 10 }}>
          {ideas.map((x, i) => (
            <div key={i} className="raised" style={{ padding: 12 }}>
              <div className="row"><b className="small" style={{ flex: 1 }}>{x.title || `Idée ${i + 1}`}</b>
                <button type="button" className="btn sm" onClick={() => { setText(x.idea); setIdeas([]); }}>Utiliser</button></div>
              <p className="xs sec" style={{ marginTop: 6 }}>{x.idea}</p>
            </div>
          ))}
          <p className="xs muted">Clique sur « Utiliser » : tu peux encore la modifier avant de générer.</p>
        </div>
      )}
    </div>
  );
}
