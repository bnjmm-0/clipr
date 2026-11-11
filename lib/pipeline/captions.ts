import type { Word } from "../providers/stt";

// Sous-titres animés (motion design) au format ASS, incrustés par FFmpeg (libass).
// Chaque mot actif déclenche un nouvel événement : on peut donc animer le mot qui démarre
// (pop, rebond, couleur) et l'entrée de chaque groupe de mots.
export const CAPTION_STYLES = {
  bold: { label: "Pop (mot surligné jaune)", font: "DejaVu Sans", size: 84, primary: "&H00FFFFFF", active: "&H0000E1FF", outline: "&H00000000", bord: 6, shadow: 3, upper: true, maxWords: 3 },
  bounce: { label: "Rebond (mot vert qui saute)", font: "DejaVu Sans", size: 88, primary: "&H00FFFFFF", active: "&H0066FF33", outline: "&H00101010", bord: 5, shadow: 2, upper: true, maxWords: 2 },
  box: { label: "Encadré (mot sur fond coloré)", font: "DejaVu Sans", size: 80, primary: "&H00FFFFFF", active: "&H00FFFFFF", outline: "&H00000000", bord: 4, shadow: 0, upper: false, maxWords: 4 },
  typewriter: { label: "Machine à écrire (apparition mot à mot)", font: "DejaVu Sans", size: 76, primary: "&H00FFFFFF", active: "&H00FFD27A", outline: "&H00000000", bord: 4, shadow: 2, upper: false, maxWords: 5 },
} as const;
export type CaptionStyle = keyof typeof CAPTION_STYLES;
// Sans sous-titres : « none » garde le titre d'accroche du début, « notext » n'affiche aucun texte.
export const NO_CAPTIONS = ["none", "notext"];

const W = 1080, H = 1920;

function ts(t: number) {
  t = Math.max(0, t);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60), cs = Math.floor((t % 1) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
const esc = (s: string) => s.replace(/[{}\\]/g, "").replace(/\n/g, " ");

export function groupWords(words: Word[], maxWords: number): Word[][] {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const gap = cur.length ? w.s - cur[cur.length - 1].e : 0;
    if (cur.length && (cur.length >= maxWords || gap > 0.6 || /[.!?,;:]$/.test(cur[cur.length - 1].w))) { groups.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) groups.push(cur);
  return groups;
}

// words : horodatages relatifs au début du clip. hook : titre animé en ouverture.
export function buildAss(words: Word[], styleKey: string, opts: { hook?: string; duration: number }) {
  const st = CAPTION_STYLES[(styleKey in CAPTION_STYLES ? styleKey : "bold") as CaptionStyle];
  const y = Math.round(H * 0.68), x = W / 2;
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${st.font},${st.size},${st.primary},${st.active},${st.outline},&H96000000,1,0,0,0,100,100,1,0,1,${st.bord},${st.shadow},5,60,60,0,1
Style: Hook,${st.font},70,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,3,24,0,8,80,80,220,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines: string[] = [];
  if (opts.hook && styleKey !== "notext") {
    // Titre d'accroche : glisse depuis le haut, léger zoom, puis s'efface.
    const hook = esc(opts.hook).slice(0, 80);
    lines.push(`Dialogue: 2,${ts(0)},${ts(Math.min(3, opts.duration))},Hook,,0,0,0,,{\\an8\\move(${x},120,${x},220,0,280)\\fad(150,350)\\fscx85\\fscy85\\t(0,280,\\fscx100\\fscy100)\\3c&H0AD9F5&\\1c&H141415&}${hook}`);
  }
  for (const g of NO_CAPTIONS.includes(styleKey) ? [] : groupWords(words, st.maxWords)) {
    const gEnd = g[g.length - 1].e + 0.15;
    g.forEach((w, i) => {
      const start = w.s;
      const end = i < g.length - 1 ? g[i + 1].s : gEnd;
      if (end <= start) return;
      const enter = i === 0 ? `\\move(${x},${y + 40},${x},${y},0,140)\\fad(90,0)` : `\\pos(${x},${y})`;
      const parts = g.map((o, k) => {
        let t = esc(st.upper ? o.w.toUpperCase() : o.w);
        if (styleKey === "typewriter" && k > i) return ""; // mots pas encore prononcés
        if (k !== i) return t;
        switch (styleKey) {
          case "bounce":
            return `{\\1c${st.active}\\fscx100\\fscy100\\t(0,70,\\fscx125\\fscy125\\frz-4)\\t(70,170,\\fscx100\\fscy100\\frz0)}${t}{\\r}`;
          case "box":
            return `{\\3c&H00FF4FA0&\\bord18\\1c${st.active}\\t(0,90,\\fscx112\\fscy112)\\t(90,160,\\fscx100\\fscy100)}${t}{\\r}`;
          case "typewriter":
            return `{\\1c${st.active}\\alpha&HFF&\\t(0,80,\\alpha&H00&)}${t}{\\r}`;
          default:
            return `{\\1c${st.active}\\fscx90\\fscy90\\t(0,80,\\fscx118\\fscy118)\\t(80,160,\\fscx106\\fscy106)}${t}{\\r}`;
        }
      }).filter(Boolean);
      lines.push(`Dialogue: 1,${ts(start)},${ts(end)},Cap,,0,0,0,,{${enter}}${parts.join(" ")}`);
    });
  }
  return head + lines.join("\n") + "\n";
}
