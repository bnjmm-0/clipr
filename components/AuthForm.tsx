"use client";
import { useActionState } from "react";
import type { FormState } from "@/app/actions";

export default function AuthForm({ action, mode }: { action: (s: FormState, f: FormData) => Promise<FormState>; mode: "login" | "register" }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="card reveal" style={{ maxWidth: 420, margin: "60px auto" }}>
      <h2>{mode === "login" ? "Connexion" : "Créer un compte"}</h2>
      {mode === "register" && (<><label>Nom</label><input name="name" autoComplete="name" /></>)}
      <label>Email</label><input name="email" type="email" required autoComplete="email" />
      <label>Mot de passe</label><input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={pending}>{pending ? "…" : mode === "login" ? "Se connecter" : "Commencer gratuitement"}</button>
    </form>
  );
}
