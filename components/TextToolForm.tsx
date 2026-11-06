"use client";
import { useActionState, useState } from "react";
import { runTextTool, type TextToolState } from "@/app/actions";
import type { ToolField } from "@/lib/ai-tools";

// Formulaire ChatGPT / Claude : la réponse s'affiche sous le formulaire, avec un bouton Copier.
export default function TextToolForm({ tool, placeholder, fields, models, defaultModel }: { tool: string; placeholder: string; fields: ToolField[]; models: string[]; defaultModel?: string }) {
  const [state, run, pending] = useActionState<TextToolState, FormData>(runTextTool, undefined);
  const [copied, setCopied] = useState(false);
  return (
    <>
      <form action={run} className="panel" style={{ maxWidth: 820 }}>
        <input type="hidden" name="tool" value={tool} />
        <label htmlFor="prompt" style={{ marginTop: 0 }}>Ton sujet</label>
        <textarea id="prompt" name="prompt" rows={3} required maxLength={2000} placeholder={placeholder} />
        {fields.map((f) => (
          <div key={f.name}>
            <label>{f.label}</label>
            <div className="seg">{f.choices.map((ch, i) => <label key={ch.v}><input type="radio" name={f.name} value={ch.v} defaultChecked={i === 0} />{ch.label}</label>)}</div>
          </div>
        ))}
        {models.length > 0 && (
          <>
            <label htmlFor="model">Modèle</label>
            <select id="model" name="model" defaultValue={defaultModel && models.includes(defaultModel) ? defaultModel : models[0]} style={{ maxWidth: 360 }}>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </>
        )}
        <div className="row" style={{ marginTop: 20 }}><button className="btn accent" disabled={pending}>{pending ? "Écriture en cours…" : "Écrire"}</button></div>
        {state?.error && <p className="alert">{state.error}</p>}
      </form>
      {state?.text && (
        <div className="panel" style={{ maxWidth: 820, marginTop: 24 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Résultat</h2>
            <button type="button" className="btn ghost sm" onClick={() => { navigator.clipboard.writeText(state.text!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copié" : "Copier"}</button>
          </div>
          <div className="small" style={{ whiteSpace: "pre-wrap", marginTop: 12, lineHeight: "22px" }}>{state.text}</div>
        </div>
      )}
    </>
  );
}
