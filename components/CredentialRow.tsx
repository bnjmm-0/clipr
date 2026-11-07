"use client";
import { useActionState } from "react";
import { saveCredential, type FormState } from "@/app/actions";

export default function CredentialRow({ name, label, help, last4, url }: { name: string; label: string; help: string; last4?: string; url?: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveCredential, undefined);
  return (
    <form action={run} style={{ padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
      <input type="hidden" name="name" value={name} />
      <div className="row"><span>{label}</span>
        <span className="tag"><span className={`dot ${last4 ? "ok" : ""}`} />{last4 ? <span className="num">Enregistrée ····{last4}</span> : "Non renseignée"}</span>
        <span className="sp" />{last4 && <button name="delete" value="1" className="btn quiet sm" disabled={pending}>Supprimer</button>}
      </div>
      <div className="xs muted" style={{ margin: "4px 0 8px" }}>{help}{url && <> · <a href={url} target="_blank" rel="noreferrer" className="credlink">Créer la clé ↗</a></>}</div>
      <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
        <input name="value" type="password" autoComplete="off" placeholder={last4 ? "Remplacer la clé" : "Coller la clé"} />
        <button className="btn ghost sm" disabled={pending}>Enregistrer</button>
      </div>
      {state?.error && <p className="alert">{state.error}</p>}
      {state?.ok && <p className="okmsg">{state.ok}</p>}
    </form>
  );
}
