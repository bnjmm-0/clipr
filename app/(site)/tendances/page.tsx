import { latestTrends } from "@/lib/trends";
import TrendsView from "@/components/TrendsView";

export const metadata = { title: "Tendances du moment · Clipr" };
export const dynamic = "force-dynamic";

export default async function PublicTrends() {
  const t = await latestTrends();
  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <div className="pagehead"><div><h1 style={{ fontSize: 44, letterSpacing: "-.03em" }}>Ce qui <span className="word">monte</span> en ce moment</h1><p>Les vidéos longues qui prennent le plus de vues par heure et les recherches en hausse, relevées toutes les 6 heures.</p></div></div>
      <TrendsView t={t} app={false} />
    </main>
  );
}
