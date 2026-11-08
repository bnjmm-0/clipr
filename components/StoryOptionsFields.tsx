import { STORY_FIELDS } from "@/lib/story-options";

// Bloc « Plus d'options » des formulaires de vidéo IA et de série (lu par readStoryOptions).
// `id` distingue les suggestions de décor quand le bloc apparaît deux fois sur la page.
export default function StoryOptionsFields({ id, open = false, series = false }: { id: string; open?: boolean; series?: boolean }) {
  return (
    <details className="moreopts" open={open}>
      <summary>Plus d'options <span className="xs muted">genre, accroche, fin, rythme, décor, lumière, style…</span></summary>
      <div className="grid optgrid">
        {STORY_FIELDS.map((f) => f.kind === "select" ? (
          <div key={f.name}><label>{f.label}</label>
            <select name={`opt_${f.name}`} defaultValue={f.choices[0].v}>{f.choices.map((c) => <option key={c.v} value={c.v} title={c.hint}>{c.label}</option>)}</select></div>
        ) : (
          <div key={f.name} className={f.name === "inspiration" ? "full" : ""}><label>{f.label}</label>
            <input name={`opt_${f.name}`} maxLength={f.max} placeholder={f.placeholder} list={f.suggestions ? `${id}-${f.name}` : undefined} />
            {f.suggestions && <datalist id={`${id}-${f.name}`}>{f.suggestions.map((s) => <option key={s} value={s} />)}</datalist>}</div>
        ))}
        {series && <label className="check full" style={{ marginTop: 12 }}><input type="checkbox" name="opt_episodeLabel" defaultChecked /><span className="small">Afficher « Épisode N » au début de chaque épisode</span></label>}
      </div>
    </details>
  );
}
