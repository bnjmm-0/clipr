import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { YT_DAILY_QUOTA, YT_QUOTA, quotaDayStart } from "@/lib/providers/youtube";

const usd = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

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
  // Le quota YouTube est commun à tout le projet Google : on l'affiche pour tous les utilisateurs confondus.
  const yt = await prisma.usageEvent.aggregate({ where: { provider: "youtube", kind: "quota", createdAt: { gte: quotaDayStart() } }, _sum: { units: true } });
  const ytUsed = yt._sum.units ?? 0;
  const ytConnected = (await prisma.socialAccount.count({ where: { platform: "youtube" } })) > 0;
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Usage</h1><p>Dépense estimée à partir des tarifs saisis dans Réglages. La facture exacte reste celle de chaque fournisseur.{u.role === "admin" ? " Vue de tous les utilisateurs." : ""}</p></div><span className="sp" />
        <div className="seg">{[7, 30, 90].map((d) => <a key={d} href={`?j=${d}`} className={`btn sm ${d === days ? "" : "ghost"}`}>{d} jours</a>)}</div></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
        <div className="card stat"><div className="xs muted">Dépense estimée sur {days} jours</div><div className="v">{usd(total)}</div></div>
        <div className="card stat"><div className="xs muted">Appels API</div><div className="v">{events.length}</div></div>
        <div className="card stat"><div className="xs muted">Minutes transcrites</div><div className="v">{events.filter((e) => e.kind === "transcription").reduce((a, e) => a + e.units, 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</div></div>
      </div>
      {ytConnected && <div className="card stat" style={{ marginTop: 24 }}>
          <div className="xs muted">Quota YouTube du jour (remis à zéro à minuit, heure du Pacifique)</div>
          <div className="v num">{ytUsed.toLocaleString("fr-FR")} <span className="small muted">/ {YT_DAILY_QUOTA.toLocaleString("fr-FR")} unités · environ {Math.max(0, Math.floor((YT_DAILY_QUOTA - ytUsed) / YT_QUOTA.upload))} Shorts restants</span></div>
          <div style={{ height: 4, background: "var(--line)", borderRadius: 2, marginTop: 12 }}><div style={{ width: `${Math.min(100, (ytUsed / YT_DAILY_QUOTA) * 100)}%`, height: "100%", background: ytUsed / YT_DAILY_QUOTA > 0.85 ? "var(--err)" : "var(--accent)", borderRadius: 2 }} /></div>
        </div>}
      <div className="panel" style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 16 }}>Par jour</h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, borderBottom: "1px solid var(--line)" }}>
          {dayList.map((x, i) => (
            <div key={x.d} title={`${x.d} : ${usd(x.v)}`} style={{ flex: 1, height: `${Math.max(1, (x.v / max) * 100)}%`, background: i === dayList.length - 1 ? "var(--accent)" : "#3a3a3e", borderRadius: "3px 3px 0 0" }} />
          ))}
        </div>
        <div className="row xs muted num" style={{ marginTop: 8 }}><span>{dayList[0]?.d.split("-").reverse().slice(0, 2).join("/")}</span><span className="sp" /><span>Aujourd'hui</span></div>
      </div>
      <div className="panel" style={{ marginTop: 24, padding: "8px 24px" }}>
        <h2 style={{ padding: "16px 0 8px" }}>Par service</h2>
        <table><thead><tr><th>Service</th><th className="r">Appels</th><th className="r">Volume</th><th className="r">Coût estimé</th></tr></thead><tbody>
          {[...byKind.entries()].sort((a, b) => b[1].cost - a[1].cost).map(([k, v]) => <tr key={k}><td>{k}</td><td className="r">{v.n}</td><td className="r">{v.units.toLocaleString("fr-FR", { maximumFractionDigits: v.label === "tokens" ? 0 : 2 })} {v.label}</td><td className="r">{usd(v.cost)}</td></tr>)}
          {byKind.size === 0 && <tr><td colSpan={4} className="muted">Aucun appel sur la période.</td></tr>}
        </tbody></table>
      </div>
      <div className="panel" style={{ marginTop: 24, padding: "8px 24px" }}>
        <h2 style={{ padding: "16px 0 8px" }}>Derniers appels</h2>
        <table><thead><tr><th>Date</th>{u.role === "admin" && <th>Utilisateur</th>}<th>Service</th><th className="r">Volume</th><th className="r">Coût</th></tr></thead><tbody>
          {events.slice(0, 50).map((e) => <tr key={e.id}><td className="num">{e.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>{u.role === "admin" && <td>{e.user?.email ?? "—"}</td>}<td>{e.kind} · {e.provider}</td><td className="r">{e.units.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {e.unitLabel}</td><td className="r">{usd(e.costUsd)}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
