"use client";
import { useEffect } from "react";

// Halo qui suit la souris et inclinaison 3D des bulles .aitool (voir globals.css).
// Ordinateur uniquement, et coupé si le système demande de réduire les animations.
export default function AiCardFx() {
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".aitool");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      el.style.setProperty("--ry", `${(x / r.width - 0.5) * 6}deg`);
      el.style.setProperty("--rx", `${(0.5 - y / r.height) * 6}deg`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);
  return null;
}
