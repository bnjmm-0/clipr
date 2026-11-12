import Link from "next/link";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const u = await currentUser();
  return (
    <>
      <header className="topnav">
        <div className="in">
          <Link href="/" className="brand"><span className="mark"><i /></span>Clipr</Link>
          <Link className="l" href="/pourquoi">Pourquoi Clipr</Link>
          <Link className="l" href="/tendances">Tendances</Link>
          <span className="sp" />
          {u ? <Link className="btn sm" href="/studio">Ouvrir l'appli</Link> : (
            <><Link className="l" href="/connexion">Connexion</Link><Link className="btn sm" href="/inscription">Essai gratuit</Link></>
          )}
        </div>
      </header>
      {children}
      <footer className="site"><div className="in"><span>Clipr</span><span className="sp" /><Link href="/pourquoi">Pourquoi Clipr</Link><Link href="/cgu">Conditions et droits sur les vidéos</Link></div></footer>
    </>
  );
}
