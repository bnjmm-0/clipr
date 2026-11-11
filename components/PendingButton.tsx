"use client";
import { useFormStatus } from "react-dom";

// Bouton d'envoi qui affiche un texte d'attente tant que l'action du formulaire tourne (ex. « Écouter sa voix »).
export default function PendingButton({ children, pending, className = "btn quiet sm" }: { children: React.ReactNode; pending: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  return <button className={className} disabled={busy}>{busy ? pending : children}</button>;
}
