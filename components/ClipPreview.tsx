"use client";
import { useEffect, useRef } from "react";

// Aperçu du produit : un clip vertical en vidéo (public/accueil/apercu.mp4), et la timeline des moments notés.
const BARS = Array.from({ length: 64 }, (_, i) => 18 + Math.round(70 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.31))));
const SEGS = [{ l: 8, w: 14, s: 74 }, { l: 37, w: 18, s: 91 }, { l: 66, w: 12, s: 68 }];

export default function ClipPreview() {
  const ref = useRef<HTMLVideoElement>(null);
  // Lecture seulement quand l'aperçu est à l'écran, et jamais si le visiteur a demandé moins d'animations (l'image fixe reste).
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <div className="preview">
      <div className="phone">
        <video ref={ref} src="/accueil/apercu.mp4" poster="/accueil/apercu.webp" muted loop playsInline preload="metadata" aria-label="Aperçu d'un clip vertical" />
      </div>
      <div className="timeline stack-24" style={{ minWidth: 0, width: "100%" }}>
        <div>
          <div className="xs muted" style={{ marginBottom: 32 }}>podcast-episode-42.mp4 · 1 h 12 min</div>
          <div className="lane">
            <div className="wave">{BARS.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
            {SEGS.map((s) => <div key={s.l} className={`seg ${s.s > 90 ? "top" : ""}`} style={{ left: `${s.l}%`, width: `${s.w}%` }} />)}
          </div>
          <div style={{ position: "relative", height: 0 }}>{SEGS.map((s) => <span key={s.l} className="num" style={{ left: `${s.l}%`, top: -68, position: "absolute", fontSize: 12, color: s.s > 90 ? "var(--text)" : "var(--muted)" }}>{s.s}</span>)}</div>
        </div>
        <div>
          {[["Publie chaque jour pendant un mois", "0:42", 91], ["Le jour où j'ai tout arrêté", "0:38", 74], ["Ce que les chiffres cachent", "0:29", 68]].map(([t, d, s]) => (
            <div key={t as string} className="cliprow" style={{ gap: 12 }}><span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span><span className="muted num" style={{ whiteSpace: "nowrap" }}>{d} · {s}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}
