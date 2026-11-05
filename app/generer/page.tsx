import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import Poller from "@/components/Poller";
import { createGeneration } from "@/app/actions";

export default async function Generate() {
  const u = await requireUser();
  const { features } = await getSettings();
  const gens = await prisma.generation.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 30 });
  if (!features.textToImage && !features.textToVideo) return <main className="wrap page"><p className="note">Fonction désactivée dans Réglages.</p></main>;
  return (
    <main className="wrap page">
      <Poller active={gens.some((g) => ["queued", "running"].includes(g.status))} />
      <h1 className="reveal">Texte → image / vidéo</h1>
      <form action={createGeneration} className="card reveal d1" style={{ marginTop: 16 }}>
        <label>Décrivez ce que vous voulez</label>
        <textarea name="prompt" rows={3} required placeholder="Un micro de podcast sous une lumière néon rose, plan serré, format vertical" />
        <div className="row" style={{ marginTop: 12 }}>
          {features.textToImage && <button name="kind" value="image" className="btn">Générer une image</button>}
          {features.textToVideo && <button name="kind" value="video" className="btn ghost">Générer une vidéo</button>}
        </div>
        <p className="small muted">Les contenus générés par IA doivent être signalés comme tels lors de leur publication.</p>
      </form>
      <div className="grid g3" style={{ marginTop: 20 }}>
        {gens.map((g, i) => (
          <div key={g.id} className="card clip" style={{ animationDelay: `${i * 0.05}s` }}>
            {g.status === "ready" ? (g.kind === "image" ? <img src={`/api/files?gen=${g.id}`} alt={g.prompt} /> : <video src={`/api/files?gen=${g.id}`} controls playsInline />)
              : <div className="skeleton" style={{ display: "grid", placeItems: "center" }}><span className={`pill ${g.status === "failed" ? "err" : "run"}`}>{g.status === "failed" ? "Échec" : "Génération…"}</span></div>}
            <div className="b"><p className="small">{g.prompt}</p>{g.error && <p className="alert small">{g.error}</p>}
              {g.status === "ready" && <a className="btn sm" href={`/api/files?gen=${g.id}&dl=1`}>Télécharger</a>}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
