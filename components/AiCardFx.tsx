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

    // Boucles vidéo (Higgsfield) : video.bgvid tourne tant qu'elle est à l'écran ;
    // video.aivid dans une bulle démarre au survol (ordinateur) ou quand la bulle est visible (téléphone).
    const play = (v: HTMLVideoElement) => { v.preload = "auto"; v.play().catch(() => {}); };
    const vids = [...document.querySelectorAll<HTMLVideoElement>("video.bgvid, video.aivid")];
    vids.forEach((v) => v.addEventListener("playing", () => v.classList.add("on"), { once: true }));
    const vio = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && (v.classList.contains("bgvid") || !pointer)) play(v); else v.pause();
      }
    }, { threshold: 0.4 });
    vids.forEach((v) => vio.observe(v));
    const cards = vids.filter((v) => v.classList.contains("aivid")).map((v) => [v.closest<HTMLElement>(".aitool")!, v] as const);
    const enter = (v: HTMLVideoElement) => () => play(v), leave = (v: HTMLVideoElement) => () => v.pause();
    const handlers = cards.map(([c, v]) => [c, enter(v), leave(v)] as const);
    if (pointer) handlers.forEach(([c, on, off]) => { c.addEventListener("pointerenter", on); c.addEventListener("pointerleave", off); });

    return () => {
      io.disconnect();
      vio.disconnect();
      if (pointer) handlers.forEach(([c, on, off]) => { c.removeEventListener("pointerenter", on); c.removeEventListener("pointerleave", off); });
      if (pointer) document.removeEventListener("pointermove", move);
    };
  }, []);
  return null;
}
