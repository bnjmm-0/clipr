import { existsSync } from "node:fs";
import { join } from "node:path";

// Bannière de page avec la troupe Clipr : image (public/troupe/<nom>.webp, Magnific) et sa boucle animée
// (même nom en .mp4, Higgsfield) si elle existe. La boucle démarre quand la bannière est visible (AiCardFx).
export default function PageHero({ name, title, children, className = "" }: { name: string; title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const img = `/troupe/${name}.webp`;
  return (
    <div className={`panel aitool aiproject clipshero troupehero ${className}`}>
      <span className="aibg" style={{ backgroundImage: `url(${img})` }} aria-hidden><TroupeLoop name={name} /></span>
      <div className="troupetext"><h1>{title}</h1>{children}</div>
    </div>
  );
}

// Boucle animée d'une bannière, seulement si le fichier existe (sinon l'image reste seule).
export function TroupeLoop({ name }: { name: string }) {
  const vid = `/troupe/${name}.mp4`;
  return existsSync(join(process.cwd(), "public", vid)) ? <video className="bgvid" src={vid} muted loop playsInline preload="none" /> : null;
}
