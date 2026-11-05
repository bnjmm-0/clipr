"use client";
import { useActionState } from "react";
import { saveCredential, type FormState } from "@/app/actions";

export default function CredentialRow({ name, label, help, last4 }: { name: string; label: string; help: string; last4?: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveCredential, undefined);
  return (
    <form action={run} className="toggle" style={{ display: "block" }}>
      <input type="hidden" name="name" value={name} />
      <div className="row"><b>{label}</b>{last4 ? <span className="pill ok">Enregistrée ••••{last4}</span> : <span className="pill">Non renseignée</span>}<span className="sp" />
        {last4 && <button name="delete" value="1" className="btn ghost sm" disabled={pending}>Supprimer</button>}
      </div>
      <div className="small muted" style={{ margin: "4px 0 8px" }}>{help}</div>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input name="value" type="password" autoComplete="off" placeholder={last4 ? "Remplacer la clé…" : "Coller la clé…"} />
        <button className="btn sm" disabled={pending}>Enregistrer</button>
      </div>
      {state?.error && <p className="alert small">{state.error}</p>}
      {state?.ok && <p className="small" style={{ color: "var(--ok)" }}>{state.ok}</p>}
    </form>
  );
}
