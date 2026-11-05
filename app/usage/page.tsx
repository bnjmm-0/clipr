import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const usd = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`;

export default async function Usage({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  const u = await requireUser();
  const days = Math.max(1, Math.min(365, Number((await searchParams).j) || 30));
  const since = new Date(Date.now() - days * 864e5);
  const where = { createdAt: { gte: since }, ...(u.role === "admin" ? {} : { userId: u.id }) };
  const events = await prisma.usageEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, include: { user: { select: { email: true } } } });
  const total = events.reduce((a, e) => a + e.costUsd, 0);
  const byKind = new Map<string, { cost: number; units: number; label: string; n: number }>();
  for (const e of events) {
    const k = `${e.kind} · ${e.provider}${e.model ? ` · ${e.model}` : ""}`;
    const v = byKind.get(k) ?? { cost: 0, units: 0, label: e.unitLabel, n: 0 };
    v.cost += e.costUsd; v.units += e.units; v.n++; byKind.set(k, v);
  }
  const perDay = new Map<string, number>();
  for (const e of events) { const d = e.createdAt.toISOString().slice(0, 10); perDay.set(d, (perDay.get(d) ?? 0) + e.costUsd); }
  const dayList = [...Array(Math.min(days, 30))].map((_, i) => { const d = new Date(Date.now() - (Math.min(days, 30) - 1 - i) * 864e5).toISOString().slice(0, 10); return { d, v: perDay.get(d) ?? 0 }; });
  const max = Math.max(...dayList.map((x) => x.v), 0.0001);
  return (
    <main className="wrap page">
      <div className="row"><h1>Compteur d'usage</h1><span className="sp" />
        {[7, 30, 90].map((d) => <a key={d} href={`?j=${d}`} className={`btn sm ${d === days ? "" : "ghost"}`}>{d} j</a>)}</div>
      <p className="muted small">Estimation à partir des tarifs saisis dans Réglages. La facture exacte reste celle de chaque fournisseur.{u.role === "admin" ? " Vue de tous les utilisateurs." : ""}</p>
      <div className="grid g3" style={{ marginTop: 16 }}>
        <div className="card reveal"><div className="muted small">Dépense estimée ({days} j)</div><div className="stat grad">{usd(total)}</div></div>
        <div className="card reveal d1"><div className="muted small">Appels API</div><div className="stat">{events.length}</div></div>
        <div className="card reveal d2"><div className="muted small">Minutes transcrites</div><div className="stat">{events.filter((e) => e.kind === "transcription").reduce((a, e) => a + e.units, 0).toFixed(1)}</div></div>
      </div>
      <div className="card reveal d3" style={{ marginTop: 18 }}>
        <h3>Par jour (30 derniers jours max)</h3>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140 }}>
          {dayList.map((x, i) => (
            <div key={x.d} title={`${x.d} : ${usd(x.v)}`} style={{ flex: 1, height: `${Math.max(2, (x.v / max) * 100)}%`, background: "linear-gradient(180deg,var(--accent),var(--accent2))", borderRadius: "4px 4px 0 0", transformOrigin: "bottom", animation: `fadeUp .6s ${i * 0.02}s both` }} />
          ))}
        </div>
      </div>
      <div className="card reveal d4" style={{ marginTop: 18 }}>
        <h3>Par service</h3>
        <table><thead><tr><th>Service</th><th>Appels</th><th>Volume</th><th>Coût estimé</th></tr></thead><tbody>
          {[...byKind.entries()].sort((a, b) => b[1].cost - a[1].cost).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td>{v.units.toFixed(v.label === "tokens" ? 0 : 2)} {v.label}</td><td>{usd(v.cost)}</td></tr>)}
          {byKind.size === 0 && <tr><td colSpan={4} className="muted">Aucun appel sur la période.</td></tr>}
        </tbody></table>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Derniers appels</h3>
        <table><thead><tr><th>Date</th>{u.role === "admin" && <th>Utilisateur</th>}<th>Service</th><th>Volume</th><th>Coût</th></tr></thead><tbody>
          {events.slice(0, 50).map((e) => <tr key={e.id}><td>{e.createdAt.toLocaleString("fr-FR")}</td>{u.role === "admin" && <td>{e.user?.email ?? "—"}</td>}<td>{e.kind} · {e.provider}</td><td>{e.units.toFixed(2)} {e.unitLabel}</td><td>{usd(e.costUsd)}</td></tr>)}
        </tbody></table>
      </div>
    </main>
  );
}
