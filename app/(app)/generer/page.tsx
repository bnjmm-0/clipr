import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import Poller from "@/components/Poller";
import { createGeneration } from "@/app/actions";

export default async function Generate() {
  const u = await requireUser();
  const { features } = await getSettings();
  const gens = await prisma.generation.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 30 });
  if (!features.textToImage && !features.textToVideo) return <div className="page"><p className="note">Fonction désactivée dans Réglages.</p></div>;
  return (
    <div className="page">
      <Poller active={gens.some((g) => ["queued", "running"].includes(g.status))} />
      <div className="pagehead"><div><h1>Images et vidéos</h1><p>Un visuel ou un plan vidéo à partir d'une description, pour une miniature, un fond ou un plan de coupe.</p></div></div>
      <form action={createGeneration} className="panel" style={{ maxWidth: 720 }}>
        <label>Décrivez ce que vous voulez</label>
        <textarea name="prompt" rows={3} required placeholder="Un micro de podcast sous une lumière néon rose, plan serré, format vertical" />
        <div className="row" style={{ marginTop: 12 }}>
          {features.textToImage && <button name="kind" value="image" className="btn accent">Générer une image</button>}
          {features.textToVideo && <button name="kind" value="video" className="btn ghost">Générer une vidéo</button>}
        </div>
        <p className="xs muted" style={{ marginTop: 12 }}>Les contenus générés par IA doivent être signalés comme tels lors de leur publication.</p>
      </form>
      <div className="grid" style={{ marginTop: 24, gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
        {gens.map((g) => (
          <div key={g.id} className="card clip">
            {g.status === "ready" ? (g.kind === "image" ? <img className="media" src={`/api/files?gen=${g.id}`} alt={g.prompt} /> : <video src={`/api/files?gen=${g.id}`} controls playsInline />)
              : <div className="placeholder"><span className="tag"><span className={`dot ${g.status === "failed" ? "err" : "live"}`} />{g.status === "failed" ? "Échec" : "Génération en cours"}</span></div>}
            <div className="b"><p className="small">{g.prompt}</p>{g.error && <p className="alert">{g.error}</p>}
              {g.status === "ready" && <a className="btn sm" href={`/api/files?gen=${g.id}&dl=1`}>Télécharger</a>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
