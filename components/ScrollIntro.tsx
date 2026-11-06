"use client";
import { useEffect, useRef } from "react";

/**
 * Ouverture de site pilotée par le scroll : la vidéo avance quand on descend.
 * 0 → 28 % : accroche, 28 → 100 % : la caméra traverse le studio puis révèle le logo.
 * Si la vidéo est absente ou si l'utilisateur préfère moins d'animation, la section disparaît.
 */
export default function ScrollIntro() {
  const box = useRef<HTMLElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const copy = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current!, v = vid.current!, c = copy.current!, h = hint.current!, f = veil.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.display = "none"; return; }

    let target = 0, cur = 0, raf = 0, dur = 0;
    const clamp = (x: number) => Math.min(1, Math.max(0, x));
    const measure = () => {
      const total = el.offsetHeight - window.innerHeight;
      target = total > 0 ? clamp(-el.getBoundingClientRect().top / total) : 0;
    };
    const onMeta = () => { dur = v.duration || 0; v.pause(); };
    const tick = () => {
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0005) cur = target;
      if (dur) {
        const t = Math.min(dur - 0.05, cur * dur);
        if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t;
      }
      // accroche : visible au début, s'efface quand la caméra avance
      const a = clamp(1 - cur / 0.24);
      c.style.opacity = String(a);
      c.style.transform = `translate3d(0,${(-(1 - a) * 48).toFixed(1)}px,0)`;
      h.style.opacity = String(clamp(1 - cur / 0.08));
      // fondu final vers le fond du site pour enchaîner avec la section suivante
      f.style.opacity = String(clamp((cur - 0.9) / 0.1));
      raf = requestAnimationFrame(tick);
    };

    v.addEventListener("loadedmetadata", onMeta);
    if (v.readyState >= 1) onMeta();
    v.addEventListener("error", () => { el.style.display = "none"; });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    measure();
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("loadedmetadata", onMeta);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section className="intro" ref={box} aria-label="Présentation de Clipr">
      <div className="intro-stick">
        <video ref={vid} className="intro-video" src="/intro.mp4" muted playsInline preload="auto" aria-hidden="true" />
        <div className="intro-shade" />
        <div className="intro-copy" ref={copy}>
          <h1>Tes vidéos longues deviennent des clips qui <span className="word">accrochent</span></h1>
        </div>
        <div className="intro-hint" ref={hint}>Fais défiler<i /></div>
        <div className="intro-veil" ref={veil} />
      </div>
    </section>
  );
}
