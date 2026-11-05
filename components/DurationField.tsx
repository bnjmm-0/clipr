"use client";
import { useState } from "react";
// Durée de la vidéo IA, de 15 s à 10 min, avec l'estimation du nombre de scènes.
const PRESETS = [30, 60, 90, 180, 300, 600];
const fmt = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`);
export default function DurationField({ defaultValue = 60 }: { defaultValue?: number }) {
  const [v, setV] = useState(defaultValue);
  const scenes = Math.max(3, Math.min(60, Math.round(v / 6)));
  return (
    <div>
      <label>Durée</label>
      <div className="seg">{PRESETS.map((p) => <label key={p}><input type="radio" name="_preset" checked={v === p} onChange={() => setV(p)} />{fmt(p)}</label>)}</div>
      <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
        <input type="number" name="durationSec" min={15} max={600} value={v} onChange={(e) => setV(Number(e.target.value) || 15)} style={{ width: 120 }} />
        <span className="xs muted num">secondes · environ {scenes} scènes, {Math.round(v * 2.4)} mots de voix off</span>
      </div>
    </div>
  );
}
