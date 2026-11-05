"use client";
import { useEffect, useState } from "react";

// Aperçu du produit : un clip 9:16 dont le mot prononcé s'allume en rythme, et la timeline des moments notés.
const LINES = [["Personne", "ne", "te", "dit"], ["ça", "au", "début"], ["publie", "chaque", "jour"], ["pendant", "un", "mois"]];
const BARS = Array.from({ length: 64 }, (_, i) => 18 + Math.round(70 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.31))));
const SEGS = [{ l: 8, w: 14, s: 74 }, { l: 37, w: 18, s: 91 }, { l: 66, w: 12, s: 68 }];

export default function ClipPreview() {
  const [k, setK] = useState(0);
  const total = LINES.flat().length;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setK((x) => (x + 1) % total), 420);
    return () => clearInterval(t);
  }, [total]);
  let idx = k, li = 0;
  while (idx >= LINES[li].length) { idx -= LINES[li].length; li++; }
  return (
    <div className="preview">
      <div className="phone" aria-label="Aperçu d'un clip vertical sous-titré">
        <div className="scene" /><div className="person" /><div className="mic" />
        <div className="hook"><span>Le secret des comptes qui percent</span></div>
        <div className="caps">{LINES[li].map((w, i) => <span key={i}>{i === idx ? <b>{w}</b> : w}{" "}</span>)}</div>
        <div className="bar" style={{ width: `${((k + 1) / total) * 100}%`, transition: "width .4s linear" }} />
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
