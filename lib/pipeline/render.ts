import fs from "node:fs";
import path from "node:path";
import { run } from "./ffmpeg";
import { buildAss } from "./captions";
import type { Word } from "../providers/stt";

export type Keyframe = { t: number; x: number };

// Expression FFmpeg d'interpolation linéaire du centre de recadrage dans le temps.
export function cropXExpr(keys: Keyframe[], cropW: number, srcW: number) {
  const clampX = (cx: string) => `max(0,min(${srcW - cropW},(${cx})*${srcW}-${cropW / 2}))`;
  if (!keys.length) return clampX("0.5");
  if (keys.length === 1) return clampX(String(keys[0].x));
  let expr = String(keys[keys.length - 1].x);
  for (let i = keys.length - 2; i >= 0; i--) {
    const a = keys[i], b = keys[i + 1];
    const seg = `${a.x}+(${b.x - a.x})*(t-${a.t})/${Math.max(0.01, b.t - a.t)}`;
    expr = `if(lt(t,${b.t}),${seg},${expr})`;
  }
  expr = `if(lt(t,${keys[0].t}),${keys[0].x},${expr})`;
  return clampX(expr);
}

export async function faceTrack(video: string, s: number, e: number): Promise<Keyframe[]> {
  try {
    const script = path.join(process.cwd(), "worker", "facetrack.py");
    const out = await run("python3", [script, video, String(s), String(e)], { timeoutMs: 120_000 });
    return JSON.parse(out) as Keyframe[];
  } catch {
    return []; // OpenCV absent ou échec : recadrage centré
  }
}

export async function renderClip(o: {
  src: string; srcW: number; srcH: number; s: number; e: number; words: Word[]; style: string; hook?: string;
  cropMode: string; cropOffset: number; keyframes: Keyframe[]; outFile: string; thumbFile: string; watermark?: string;
}) {
  const dur = o.e - o.s;
  const rel = o.words.map((w) => ({ w: w.w, s: Math.max(0, w.s - o.s), e: Math.min(dur, w.e - o.s) }));
  const assFile = o.outFile.replace(/\.mp4$/, ".ass");
  fs.writeFileSync(assFile, buildAss(rel, o.style, { hook: o.hook, duration: dur }));
  const assArg = assFile.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

  let base: string;
  if (o.cropMode === "none") {
    base = `[0:v]scale=1080:1920,setsar=1[v0]`; // source déjà au format 9:16 (vidéos IA)
  } else if (o.cropMode === "wide" || o.srcW / o.srcH < 0.7) {
    // Plan large : vidéo entière au centre, fond flou animé (léger zoom lent).
    base = `[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:2,eq=brightness=-0.08,` +
      `zoompan=z='min(1.0+on/3000,1.08)':d=1:s=1080x1920:fps=30[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v0]`;
  } else {
    const cropW = Math.round((o.srcH * 9) / 16 / 2) * 2;
    const keys = o.keyframes.length ? o.keyframes : [{ t: 0, x: o.cropOffset }];
    base = `[0:v]crop=w=${cropW}:h=${o.srcH}:x='${cropXExpr(keys, cropW, o.srcW)}':y=0,scale=1080:1920,setsar=1[v0]`;
  }
  // Barre de progression animée en bas + sous-titres animés.
  const filters = `${base};color=c=0xFFE100:s=1080x10:r=30[bar];[v0][bar]overlay=x='-W+W*t/${dur.toFixed(2)}':y=H-10:shortest=1[v1];` +
    `[v1]subtitles='${assArg}'${o.watermark ? `,drawtext=text='${o.watermark}':fontcolor=white@0.6:fontsize=36:x=w-tw-30:y=60` : ""}[v]`;
  await run("ffmpeg", ["-y", "-ss", o.s.toFixed(2), "-t", dur.toFixed(2), "-i", o.src, "-filter_complex", filters,
    "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", "30", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", o.outFile]);
  await run("ffmpeg", ["-y", "-ss", String(Math.min(1, dur / 2)), "-i", o.outFile, "-frames:v", "1", "-vf", "scale=360:-2", o.thumbFile]);
}
