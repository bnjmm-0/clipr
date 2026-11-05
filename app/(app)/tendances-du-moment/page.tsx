import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { latestTrends } from "@/lib/trends";
import { prisma } from "@/lib/db";
import TrendsView from "@/components/TrendsView";
import Poller from "@/components/Poller";
import { refreshTrendsNow } from "@/app/actions";

export default async function AppTrends() {
  const u = await requireUser();
  const s = await getSettings();
  if (!s.features.trends) return <div className="page"><p className="note">Fonction désactivée dans Réglages.</p></div>;
  const t = await latestTrends();
  const running = await prisma.job.count({ where: { type: "trends", state: { in: ["queued", "running"] } } });
  return (
    <div className="page">
      <Poller active={running > 0} ms={4000} />
      <div className="pagehead">
        <div><h1>Tendances</h1><p>Vidéos qui montent, recherches en hausse et idées adaptées{s.trendNiche ? ` à « ${s.trendNiche} »` : " à ton thème (à préciser dans Réglages)"}. Mise à jour automatique toutes les 6 h.</p></div>
        <span className="sp" />
        {u.role === "admin" && <form action={refreshTrendsNow}><button className="btn ghost sm" disabled={running > 0}>{running ? "Relevé en cours" : "Actualiser maintenant"}</button></form>}
      </div>
      <TrendsView t={t} app />
    </div>
  );
}
