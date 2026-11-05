"use client";
import { useActionState } from "react";
import { runCoach, type FormState } from "@/app/actions";
export default function CoachForm({ connected }: { connected: boolean }) {
  const [state, run, pending] = useActionState<FormState, FormData>(runCoach, undefined);
  return (
    <form action={run} className="panel">
      <h2>Nouvelle analyse</h2>
      <label>Thème du compte</label><input name="niche" required placeholder="Podcast business en français" />
      <label>Objectif</label><input name="goal" placeholder="Passer de 2 000 à 10 000 abonnés en 3 mois" />
      <label>Publications par semaine</label><input name="freq" type="number" defaultValue={5} min={1} max={21} />
      <label className="check" style={{ marginTop: 16 }}><input type="checkbox" name="useAccount" defaultChecked={connected} disabled={!connected} /><span className="small">Analyser mes vraies vidéos TikTok{connected ? "" : " (compte non connecté)"}</span></label>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn accent" style={{ marginTop: 20 }} disabled={pending}>{pending ? "Analyse en cours" : "Lancer le coach"}</button>
    </form>
  );
}
