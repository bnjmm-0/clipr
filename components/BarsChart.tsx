"use client";
import { useState } from "react";

// Barres verticales (une série) avec infobulle au survol ; la plus haute est en jaune, les autres en gris.
const fmt = (v: number) => (Math.abs(v) >= 1e4 ? `${(v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : Math.round(v).toLocaleString("fr-FR"));

export type Bar = { label: string; v: number; tip?: string; n?: number };

export default function BarsChart({ bars, unit, height = 200, showLabels = true }: { bars: Bar[]; unit: string; height?: number; showLabels?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.v));
  const top = bars.findIndex((b) => b.v === max && b.v > 0);
  if (!bars.some((b) => b.v > 0)) return <div className="chartempty" style={{ height }}><span className="xs muted">Pas encore assez de données</span></div>;
  return (
    <div className="chartwrap">
      <div className="bars" style={{ height }} onPointerLeave={() => setHover(null)}>
        {bars.map((b, i) => (
          <div key={i} className={`barcol ${hover === i ? "on" : ""}`} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${b.tip ?? b.label} : ${fmt(b.v)} ${unit}`}>
            {i === top && hover === null && <b className="barpeak num">{fmt(b.v)}</b>}
            <i className={i === top ? "top" : ""} style={{ height: `${Math.max(b.v > 0 ? 3 : 0, (b.v / max) * 88)}%`, animationDelay: `${i * 30}ms` }} />
            {showLabels && <span className="xs muted">{b.label}</span>}
            {hover === i && <div className="charttip bartip"><div className="xs muted">{b.tip ?? b.label}</div><b className="num">{b.v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}</b> <span className="xs muted">{unit}{b.n !== undefined ? ` · ${b.n} vidéo${b.n > 1 ? "s" : ""}` : ""}</span></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
