import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logout } from "./actions";

export const metadata = { title: "Clipr — vidéos longues en clips verticaux", description: "Colle un lien, récupère tes meilleurs moments, poste." };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const u = await currentUser();
  const f = u ? (await getSettings()).features : null;
  return (
    <html lang="fr">
      <body>
        <nav className="nav">
          <div className="wrap">
            <Link href="/" className="logo"><i />Clipr</Link>
            {u && f && (
              <>
                {f.clips && <Link className="l" href="/tableau-de-bord">Clips</Link>}
                {(f.textToImage || f.textToVideo) && <Link className="l" href="/generer">Générer</Link>}
                {f.tiktokCoach && <Link className="l" href="/coach">Coach TikTok</Link>}
                <Link className="l" href="/usage">Usage</Link>
                {u.role === "admin" && <Link className="l" href="/reglages">Réglages</Link>}
              </>
            )}
            <span className="sp" />
            {u ? (
              <form action={logout}><span className="muted small" style={{ marginRight: 12 }}>{u.email}</span><button className="btn ghost sm">Déconnexion</button></form>
            ) : (
              <><Link className="l" href="/connexion">Connexion</Link><Link className="btn sm" href="/inscription">Essai gratuit</Link></>
            )}
          </div>
        </nav>
        {children}
        <footer><div className="wrap row"><span>© {new Date().getFullYear()} Clipr</span><span className="sp" /><Link href="/cgu">CGU et droits sur les vidéos</Link></div></footer>
      </body>
    </html>
  );
}
