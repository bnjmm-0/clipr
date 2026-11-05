// Courbe simple en SVG : une série, grille discrète, dernière valeur mise en avant.
export default function LineChart({ points, height = 280 }: { points: { t: Date; v: number }[]; height?: number }) {
  const W = 800, H = height, P = { l: 48, r: 16, t: 16, b: 28 };
  if (points.length < 2) return <div className="placeholder" style={{ aspectRatio: "auto", height, borderRadius: 10 }}><span className="xs muted">La courbe apparaît après deux relevés (toutes les 6 h)</span></div>;
  const xs = points.map((p) => p.t.getTime()), ys = points.map((p) => p.v);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = (y1 - y0) * 0.15 || Math.max(1, y1 * 0.05);
  const lo = Math.max(0, y0 - pad), hi = y1 + pad;
  const X = (t: number) => P.l + ((t - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(p.t.getTime()).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const last = points[points.length - 1];
  const fmt = (v: number) => (v >= 1e3 ? `${(v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : Math.round(v).toLocaleString("fr-FR"));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Évolution des abonnés">
      {ticks.map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="rgba(237,237,237,.08)" /><text x={P.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="12" fill="#85858b" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</text></g>)}
      {[points[0], last].map((p, i) => <text key={i} x={X(p.t.getTime())} y={H - 8} textAnchor={i ? "end" : "start"} fontSize="12" fill="#85858b">{p.t.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</text>)}
      <path d={d} fill="none" stroke="#f5d90a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(last.t.getTime())} cy={Y(last.v)} r="4" fill="#f5d90a" />
    </svg>
  );
}
