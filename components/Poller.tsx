"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
// Rafraîchit la page tant qu'un traitement est en cours.
export default function Poller({ active, ms = 3000 }: { active: boolean; ms?: number }) {
  const r = useRouter();
  useEffect(() => { if (!active) return; const t = setInterval(() => r.refresh(), ms); return () => clearInterval(t); }, [active, ms, r]);
  return null;
}
