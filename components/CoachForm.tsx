"use client";
import { useActionState } from "react";
import { runCoach, type FormState } from "@/app/actions";
export default function CoachForm({ connected }: { connected: boolean }) {
  const [state, run, pending] = useActionState<FormState, FormData>(runCoach, undefined);
  return (
    <form action={run} className="card reveal d1">
      <h2>Nouvelle analyse</h2>
      <label>Niche / thème du compte</label><input name="niche" required placeholder="ex. podcast business en français" />
      <label>Objectif</label><input name="goal" placeholder="ex. passer de 2 000 à 10 000 abonnés en 3 mois" />
      <label>Publications par semaine</label><input name="freq" type="number" defaultValue={5} min={1} max={21} />
      <label className="row" style={{ color: "var(--text)" }}><input type="checkbox" name="useAccount" defaultChecked={connected} disabled={!connected} /> Analyser mes vraies vidéos TikTok</label>
      {state?.error && <p className="alert">{state.error}</p>}
      <button className="btn" style={{ marginTop: 14 }} disabled={pending}>{pending ? "Analyse en cours…" : "Lancer le coach"}</button>
    </form>
  );
}
