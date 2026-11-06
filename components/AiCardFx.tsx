"use client";
import { useEffect } from "react";

// Effets des bulles .aitool (voir globals.css) :
// - apparition au fil du défilement pour les cases sous l'écran (téléphone compris) ;
// - halo qui suit la souris et inclinaison 3D (ordinateur uniquement).
// Tout est coupé si le système demande de réduire les animations.
export default function AiCardFx() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const hidden = [...document.querySelectorAll<HTMLElement>(".card.aitool:not(.aibanner)")].filter((c) => c.getBoundingClientRect().top > innerHeight);
    hidden.forEach((c) => c.setAttribute("data-reveal", ""));
    const io = new IntersectionObserver((entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.animationDelay = `${k++ * 70}ms`;
        el.setAttribute("data-in", "");
        io.unobserve(el);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    hidden.forEach((c) => io.observe(c));

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
    const pointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (pointer) document.addEventListener("pointermove", move, { passive: true });
    return () => {
      io.disconnect();
      if (pointer) document.removeEventListener("pointermove", move);
    };
  }, []);
  return null;
}
