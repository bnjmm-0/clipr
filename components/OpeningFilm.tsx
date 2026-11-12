"use client";
// Ouverture « film au défilement » : la vidéo d'ouverture de Clipr avance image par image
// au rythme du scroll (97 images WebP dessinées dans un canvas), avec trois temps de texte.
import Link from "next/link";
import { useEffect, useRef } from "react";

const COUNT = 97;
const src = (dir: "d" | "m", i: number) => `/intro/${dir}/${String(i + 1).padStart(3, "0")}.webp`;

// Fenêtres d'apparition des textes, en part du défilement (0 → 1).
const BEATS: [number, number, number, number][] = [
  [-1, 0, 0.08, 0.15], // A : visible dès l'arrivée, part vers 0,15
  [0.17, 0.22, 0.33, 0.4], // B : avant le flash lumineux de la vidéo
  [0.8, 0.88, 2, 2], // C : reste jusqu'à la fin
];
const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
function beat(p: number, [a, b, c, d]: number[]) {
  if (p < a || p > d) return 0;
  if (p < b) return ease((p - a) / (b - a));
  if (p <= c) return 1;
  return 1 - ease((p - c) / (d - c));
}

export default function OpeningFilm({ cta, label }: { cta: string; label: string }) {
  const box = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const beats = useRef<(HTMLDivElement | null)[]>([]);
  const hint = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current!, cv = canvas.current!, ctx = cv.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dir = innerWidth < 760 ? "m" : "d";
    const imgs: HTMLImageElement[] = [];
    let want = reduce ? COUNT - 1 : 0, drawn = -1, raf = 0;

    const size = () => {
      const r = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(cv.clientWidth * r); cv.height = Math.round(cv.clientHeight * r); drawn = -1; draw();
    };
    function draw() {
      // image chargée la plus proche de celle demandée
      let i = want; while (i > 0 && !imgs[i]?.complete) i--;
      const im = imgs[i]; if (!im?.complete || !im.naturalWidth || i === drawn) return;
      const W = cv.width, H = cv.height, ar = im.naturalWidth / im.naturalHeight;
      // toute la largeur de la vidéo reste visible (le logo final ne doit pas être rogné) ;
      // sur un écran plus large que 16:9, l'image déborde en hauteur
      const w = W, h = w / ar;
      ctx.fillStyle = "#0b0b0c"; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); drawn = i;
    }
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const p = reduce ? 1 : Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
        want = Math.round(p * (COUNT - 1)); draw();
        BEATS.forEach((b, k) => {
          const n = beats.current[k]; if (!n) return;
          const o = reduce ? (k === 2 ? 1 : 0) : beat(p, b);
          n.style.opacity = String(o); n.style.transform = `translateY(${(1 - o) * 12}px)`;
          n.style.visibility = o < 0.01 ? "hidden" : "visible";
        });
        if (hint.current) hint.current.style.opacity = String(p < 0.03 ? 1 : 0);
      });
    };
    // première image d'abord, puis le reste dans l'ordre
    const order = reduce ? [COUNT - 1] : [0, ...Array.from({ length: COUNT - 1 }, (_, i) => i + 1)];
    order.forEach((i) => { const im = new Image(); im.decoding = "async"; im.src = src(dir, i); im.onload = () => { if (i <= want) { drawn = -1; draw(); } }; imgs[i] = im; });
    size(); onScroll();
    addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", size);
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", size); cancelAnimationFrame(raf); };
  }, []);

  const set = (k: number) => (n: HTMLDivElement | null) => { beats.current[k] = n; };
  return (
    <section ref={box} className="film" aria-label="Ouverture">
      <div className="stage">
        <canvas ref={canvas} aria-hidden="true" />
        <div className="shade" aria-hidden="true" />
        <div className="beat a" ref={set(0)}>
          <h1>Le studio où tes fruits deviennent des stars</h1>
          <p>Personnages IA, séries, clips, tendances et publication : Clipr tourne tes vidéos courtes à ta place.</p>
        </div>
        <div className="beat b" ref={set(1)} style={{ opacity: 0, visibility: "hidden" }}>
          <h2>Une idée, une troupe, un épisode qui <span className="word">accroche</span></h2>
        </div>
        <div className="beat c" ref={set(2)} style={{ opacity: 0, visibility: "hidden" }}>
          <p>Clips, séries IA, tendances et publication, au même endroit.</p>
          <div className="row">
            <Link className="btn accent" href={cta}>{label}</Link>
            <a className="btn ghost" href="#produit">Voir le produit</a>
          </div>
        </div>
        <div className="hint" ref={hint} aria-hidden="true">Fais défiler</div>
      </div>
    </section>
  );
}
