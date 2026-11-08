import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import RemixForm from "@/components/RemixForm";
import EngineFields from "@/components/EngineFields";

export default async function Remix({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const u = await requireUser();
  const s = await getSettings();
  if (!s.features.remix) return <div className="page"><p className="note">Fonction désactivée dans Réglages.</p></div>;
  const { url } = await searchParams;
  const characters = await prisma.character.findMany({ where: { userId: u.id }, select: { id: true, name: true } });
  const remixes = await prisma.episode.findMany({ where: { userId: u.id, origin: "remix" }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div className="page">
      <div className="pagehead"><div><h1>Reprendre une vidéo</h1><p>Clipr transcrit une vidéo qui marche, en analyse la mécanique (accroche, rythme, chute) et écrit ta propre version, doublée et illustrée, à la durée que tu choisis.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.9fr)", gap: 24, alignItems: "start" }}>
        <RemixForm characters={characters} engines={<EngineFields />} defaultUrl={url} />
        <div className="panel" style={{ padding: "8px 24px" }}>
          <h2 style={{ padding: "16px 0 8px" }}>Versions créées</h2>
          {remixes.length === 0 && <p className="sec small" style={{ paddingBottom: 16 }}>Aucune pour l'instant.</p>}
          {remixes.map((e) => (
            <Link key={e.id} href={`/videos-ia/${e.id}`} className="cliprow" style={{ height: 56 }}>
              <span style={{ minWidth: 0 }}>{e.title}<span className="xs muted" style={{ display: "block" }}>{e.sourceUrl ?? "Fichier importé"}</span></span>
              <span className="tag"><span className={`dot ${e.status === "ready" ? "ok" : e.status === "failed" ? "err" : "live"}`} />{e.status === "ready" ? "Prête" : e.status === "failed" ? "Échec" : e.stage}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
