import fs from "node:fs";
import path from "node:path";
import { probe, run } from "./ffmpeg";

// Miniature 1080×1920 : l'image la plus nette parmi plusieurs instants, assombrie en bas, avec le titre et un mot clé en jaune.
// opts.from/to : plage à explorer dans la source ; opts.vf : recadrage à appliquer (image sans sous-titres incrustés).
export async function makeCover(video: string, title: string, outFile: string, opts: { from?: number; to?: number; vf?: string } = {}) {
  const from = opts.from ?? 0;
  const duration = (opts.to ?? (await probe(video)).duration) - from;
  const dir = path.dirname(outFile);
  const base = path.basename(outFile, ".jpg");
  let best = "", bestSize = -1;
  for (const f of [0.15, 0.3, 0.45, 0.6, 0.75]) {
    const fr = path.join(dir, `${base}_f${Math.round(f * 100)}.jpg`);
    await run("ffmpeg", ["-y", "-v", "error", "-ss", (from + duration * f).toFixed(2), "-i", video, "-frames:v", "1", ...(opts.vf ? ["-vf", opts.vf] : []), "-q:v", "3", fr]);
    const size = fs.existsSync(fr) ? fs.statSync(fr).size : 0; // plus de détails = fichier JPEG plus lourd
    if (size > bestSize) { bestSize = size; best = fr; }
  }
  const words = title.replace(/[{}\\]/g, "").split(/\s+/).filter(Boolean);
  const key = words.reduce((a, w) => (w.replace(/\W/g, "").length > a.replace(/\W/g, "").length ? w : a), words[0] ?? "");
  const text = words.map((w) => (w === key ? `{\\1c&H0AD9F5&}${w.toUpperCase()}{\\1c&HFFFFFF&}` : w.toUpperCase())).join(" ");
  const ass = path.join(dir, `${base}.ass`);
  fs.writeFileSync(ass, `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,DejaVu Sans,104,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,6,0,2,80,80,260,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,T,,0,0,0,,${text}
`);
  const assArg = ass.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  await run("ffmpeg", ["-y", "-v", "error", "-i", best, "-f", "lavfi", "-i", "color=c=black:s=1080x1920,format=rgba",
    "-filter_complex", `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,eq=saturation=1.15:contrast=1.05[b];` +
    `[1:v]geq=r=0:g=0:b=0:a='if(gt(Y,H*0.45),255*min(1,(Y-H*0.45)/(H*0.4))*0.85,0)'[g];[b][g]overlay=format=auto,subtitles='${assArg}'`,
    "-frames:v", "1", "-q:v", "2", outFile]);
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`${base}_f`)) fs.rmSync(path.join(dir, f));
  return outFile;
}
