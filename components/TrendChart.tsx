"use client";
import { useState } from "react";

// Courbe d'évolution (une série) avec aire, curseur vertical et infobulle au survol.
const fmt = (v: number) => (Math.abs(v) >= 1e4 ? `${(v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : Math.round(v).toLocaleString("fr-FR"));

export default function TrendChart({ points, label, height = 260 }: { points: { t: string; v: number }[]; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = height, P = { l: 52, r: 16, t: 16, b: 28 };
  if (points.length < 2) return <div className="chartempty" style={{ height }}><span className="xs muted">La courbe apparaît après deux relevés (toutes les 6 h)</span></div>;
  const xs = points.map((p) => Date.parse(p.t)), ys = points.map((p) => p.v);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  // Graduations rondes : pas de 1, 2 ou 5 × 10^n.
  const raw = ((y1 - y0) * 1.3 || Math.max(1, y1 * 0.1)) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((x) => x >= raw) ?? 10 * mag;
  const lo = Math.max(0, Math.floor((y0 - step * 0.3) / step) * step), hi = Math.ceil((y1 + step * 0.3) / step) * step;
  const X = (t: number) => P.l + ((t - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${X(x1).toFixed(1)},${H - P.b} L${X(x0).toFixed(1)},${H - P.b} Z`;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const h = hover ?? points.length - 1;
  const date = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    xs.forEach((t, i) => { if (Math.abs(X(t) - x) < Math.abs(X(xs[best]) - x)) best = i; });
    setHover(best);
  };
  return (
    <div className="chartwrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`${label} : ${fmt(points[0].v)} le ${date(xs[0])}, ${fmt(points.at(-1)!.v)} le ${date(x1)}`}
        onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id={`g-${label}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5d90a" stopOpacity=".22" /><stop offset="1" stopColor="#f5d90a" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="rgba(237,237,237,.07)" /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="#85858b" className="num">{fmt(v)}</text></g>)}
        {[0, points.length - 1].map((i) => <text key={i} x={X(xs[i])} y={H - 8} textAnchor={i ? "end" : "start"} fontSize="12" fill="#85858b">{date(xs[i])}</text>)}
        <path d={area} fill={`url(#g-${label})`} className="chartarea" />
        <path d={line} fill="none" stroke="#f5d90a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="chartline" pathLength={1} />
        {hover !== null && <line x1={X(xs[h])} x2={X(xs[h])} y1={P.t} y2={H - P.b} stroke="rgba(237,237,237,.25)" strokeDasharray="3 3" />}
        <circle cx={X(xs[h])} cy={Y(points[h].v)} r="5" fill="#f5d90a" stroke="#19191b" strokeWidth="2" />
        <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="transparent" />
      </svg>
      {hover !== null && (
        <div className="charttip" style={{ left: `${(X(xs[h]) / W) * 100}%`, top: `${(Y(points[h].v) / H) * 100}%` }}>
          <div className="xs muted">{new Date(xs[h]).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
          <b className="num">{points[h].v.toLocaleString("fr-FR")}</b> <span className="xs muted">{label.toLowerCase()}</span>
        </div>
      )}
    </div>
  );
}
