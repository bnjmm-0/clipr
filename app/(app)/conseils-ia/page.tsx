import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { FEATURES, getSettings } from "@/lib/settings";
import { ADVICE_DATE, CREATORS, PROJECTS, TOOLBOX, type AiTool } from "@/lib/ai-advice";
import AiCardFx from "@/components/AiCardFx";
import { GLOW } from "@/lib/ai-glow";
import PageHero from "@/components/PageHero";

// Couleur des effets de survol, prise sur l'illustration de la bulle.
const glow = (key: string) => ({ "--glow": GLOW[key] }) as React.CSSProperties;

const ToolName = ({ tool }: { tool: AiTool }) => <a href={tool.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{tool.name}</a>;
// Dans la boîte à outils : l'outil s'ouvre dans Clipr quand c'est possible, sinon sur son site.
const Logo = ({ tool, sm }: { tool: AiTool; sm?: boolean }) => <img src={`/conseils-ia/logos/${tool.slug}.png`} alt="" className={`ailogo${sm ? " sm" : ""}`} />;
const ToolCell = ({ tool }: { tool: AiTool }) => tool.app
  ? <><Logo tool={tool} sm /><Link href={`/conseils-ia/outil/${tool.app}`} style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{tool.name}</Link></>
  : <><Logo tool={tool} sm /><ToolName tool={tool} /> <span className="xs muted">↗</span></>;

export default async function AiAdvice({ searchParams }: { searchParams: Promise<{ projet?: string }> }) {
  const u = await requireUser();
  const s = await getSettings();
  const { projet } = await searchParams;
  const p = PROJECTS.find((x) => x.id === projet) ?? PROJECTS[0];
  const showClipr = p.inClipr && s.features[p.inClipr.feature];
  const featureLabel = p.inClipr && FEATURES.find((f) => f.key === p.inClipr!.feature)?.label;
  return (
    <div className="page">
      <AiCardFx key={`fx-${p.id}`} />
      <PageHero name="conseils" title="Conseils IA"><p className="sec" style={{ marginTop: 8 }}>Quelles IA utiliser selon ton projet, étape par étape. Sélection de {ADVICE_DATE} : les outils évoluent vite, vérifie les prix et les conditions d'usage commercial sur leur site.</p></PageHero>

      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {PROJECTS.map((x) => (
          <Link key={x.id} href={`/conseils-ia?projet=${x.id}`} className={`btn sm ${x.id === p.id ? "ghost" : "quiet"}`} aria-current={x.id === p.id ? "page" : undefined}>{x.title}</Link>
        ))}
      </div>

      <div className="stack-24 swap" key={p.id}>
        <div className="panel stack aitool aiproject" style={glow(`projets/${p.id}`)}>
          <span className="aibg" style={{ backgroundImage: `url(/conseils-ia/projets/${p.id}.webp)` }} aria-hidden />
          <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
            <h2>{p.title}</h2>
            {CREATORS[p.id] && <Link href={`/conseils-ia/creer?projet=${p.id}`} className="btn accent sm">Créer avec l'IA</Link>}
          </div>
          <p className="sec">{p.pitch}</p>
          {showClipr && (
            <div className="note row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 280px" }}><b style={{ color: "var(--text)" }}>Dans Clipr :</b> {p.inClipr!.how}</span>
              <Link href={p.inClipr!.href} className="btn accent sm">{p.inClipr!.label}</Link>
            </div>
          )}
          {!showClipr && p.inClipr && u.role === "admin" && (
            <p className="note">Clipr sait aussi le faire : active « {featureLabel} » dans <Link href="/reglages" style={{ textDecoration: "underline" }}>Réglages</Link>.</p>
          )}
        </div>

        {p.steps.map((st, i) => (
          <div key={st.title}>
            <h3 style={{ marginBottom: 12 }}><span className="muted num" style={{ marginRight: 8 }}>{i + 1}</span>{st.title}</h3>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
              {st.tools.map((tool, j) => (
                <div key={tool.name} className="card stack-8 aitool" style={{ ...glow(`bg/${tool.slug}`), animationDelay: `${(i * 2 + j) * 60}ms` }}>
                  <span className="aibg" style={{ backgroundImage: `url(/conseils-ia/bg/${tool.slug}.webp)` }} aria-hidden />
                  <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}><Logo tool={tool} /><b><ToolName tool={tool} /></b></div>
                  <p className="small sec">{tool.why}</p>
                  <div className="row" style={{ gap: 8, marginTop: 12 }}>
                    {tool.app && <Link href={`/conseils-ia/outil/${tool.app}`} className="btn accent sm">Utiliser ici</Link>}
                    <a href={tool.url} target="_blank" rel="noreferrer" className="btn quiet sm">Site officiel ↗</a>
                    <span className="sp" />
                    <span className="tag" style={{ whiteSpace: "nowrap" }}>{tool.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="panel">
          <h3 style={{ marginBottom: 8 }}>Conseils</h3>
          <ul className="small sec" style={{ paddingLeft: 18, display: "grid", gap: 6 }}>
            {p.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
        </div>

        <div className="panel" style={{ padding: "8px 24px" }}>
          <h2 style={{ padding: "16px 0 8px" }}>La boîte à outils</h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Besoin</th><th>Notre choix</th><th>Alternative</th></tr></thead>
              <tbody>
                {TOOLBOX.map((r) => (
                  <tr key={r.need}><td>{r.need}</td><td><ToolCell tool={r.pick} /></td><td className="sec"><ToolCell tool={r.alt} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
