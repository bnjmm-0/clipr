import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NewProject from "@/components/NewProject";
import AiCardFx from "@/components/AiCardFx";
import EngineFields from "@/components/EngineFields";

const STATUS: Record<string, [string, string]> = { ready: ["Prêt", "ok"], failed: ["Échec", "err"] };

// Visuels générés avec Magnific (public/clips/).
const STEPS = [
  { img: "/clips/etape-1.webp", t: "Importe ta vidéo", d: "Un fichier ou un lien : podcast, live, interview, jusqu'à plusieurs heures." },
  { img: "/clips/etape-2.webp", t: "Clipr trouve les meilleurs moments", d: "Transcription mot à mot, chaque passage noté sur 100 : accroche, émotion, fin nette." },
  { img: "/clips/etape-3.webp", t: "Publie en vertical", d: "Recadrage 9:16 qui suit la personne qui parle, sous-titres animés, miniature, publication." },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const u = await requireUser();
  const { url } = await searchParams;
  const projects = await prisma.project.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, include: { clips: { select: { id: true, status: true } } } });
  const credits = await prisma.creditLedger.aggregate({ where: { userId: u.id }, _sum: { minutes: true } });
  const readyClips = projects.reduce((n, p) => n + p.clips.filter((c) => c.status === "ready").length, 0);
  return (
    <div className="page">
      <AiCardFx />
      <div className="panel aitool aiproject clipshero">
        <span className="aibg" style={{ backgroundImage: "url(/clips/hero.webp)" }} aria-hidden />
        <div style={{ maxWidth: 600 }}>
          <h1>Clips</h1>
          <p className="sec" style={{ marginTop: 8 }}>Importe une vidéo longue : Clipr garde les meilleurs passages et les rend en vertical avec sous-titres animés et miniature.</p>
          <div className="row" style={{ gap: 10, marginTop: 20 }}>
            <a href="#nouveau" className="btn accent">Nouveau projet</a>
            <Link href="/tendances-du-moment" className="btn ghost">Trouver une vidéo qui monte</Link>
          </div>
          <div className="herostats">
            <span><b className="num">{projects.length}</b> projet{projects.length > 1 ? "s" : ""}</span>
            <span><b className="num">{readyClips}</b> clip{readyClips > 1 ? "s" : ""} prêt{readyClips > 1 ? "s" : ""}</span>
            <span><b className="num">{u.role === "admin" ? "∞" : Math.max(0, credits._sum.minutes ?? 0)}</b> {u.role === "admin" ? "minutes (admin)" : "min restantes"}</span>
          </div>
        </div>
      </div>

      {projects.length < 3 && (
        <div className="steps3">
          {STEPS.map((s, i) => (
            <div key={s.t} className="card stepcard" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="stepimg"><img src={s.img} alt="" loading="lazy" /><span className="stepnum num">{i + 1}</span></div>
              <h3>{s.t}</h3>
              <p className="small sec">{s.d}</p>
            </div>
          ))}
        </div>
      )}

      <div id="nouveau" className="grid" style={{ gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.9fr)", alignItems: "start", gap: 24, scrollMarginTop: 80 }}>
        <NewProject defaultUrl={url} engines={<EngineFields only={["script"]} scriptLabel="IA qui choisit les moments forts" />} />
        <div className="panel" style={{ padding: "8px 24px" }}>
          <h2 style={{ padding: "16px 0 8px" }}>Projets</h2>
          {projects.length === 0 && (
            <div className="emptystate">
              <img src="/clips/vide.webp" alt="" />
              <p><b>Aucun projet pour l'instant</b></p>
              <p className="small sec">Glisse ta première vidéo dans le formulaire : tes clips apparaîtront ici, prêts à publier.</p>
            </div>
          )}
          {projects.map((p) => {
            const [label, cls] = STATUS[p.status] ?? [`${p.stage} · ${p.progress} %`, "live"];
            return (
              <Link key={p.id} href={`/projets/${p.id}`} className="cliprow" style={{ height: 56 }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}<span className="xs muted" style={{ display: "block" }}>{p.clips.filter((c) => c.status === "ready").length} clips · {p.createdAt.toLocaleDateString("fr-FR")}</span></span>
                <span className="tag"><span className={`dot ${cls}`} />{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
