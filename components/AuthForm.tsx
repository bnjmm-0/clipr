"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions";

export default function AuthForm({ action, mode }: { action: (s: FormState, f: FormData) => Promise<FormState>; mode: "login" | "register" }) {
  const [state, run, pending] = useActionState(action, undefined);
  return (
    <form action={run} className="panel enter" style={{ maxWidth: 400, margin: "96px auto" }}>
      <h1 style={{ fontSize: 28 }}>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
      {mode === "register" && (<><label>Nom</label><input name="name" autoComplete="name" /></>)}
      <label>Email</label><input name="email" type="email" required autoComplete="email" />
      <label>Mot de passe</label><input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn accent" style={{ width: "100%", marginTop: 24 }} disabled={pending}>{pending ? "Un instant" : mode === "login" ? "Se connecter" : "Commencer gratuitement"}</button>
      <p className="xs muted" style={{ marginTop: 16, textAlign: "center" }}>{mode === "login" ? <>Pas encore de compte ? <Link href="/inscription" style={{ textDecoration: "underline" }}>Essai gratuit</Link></> : <>Déjà inscrit ? <Link href="/connexion" style={{ textDecoration: "underline" }}>Connexion</Link></>}</p>
    </form>
  );
}
