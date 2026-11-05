import { spawn } from "node:child_process";

export function run(cmd: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => { err += d; if (err.length > 20000) err = err.slice(-10000); });
    const t = opts.timeoutMs ? setTimeout(() => p.kill("SIGKILL"), opts.timeoutMs) : null;
    p.on("error", reject);
    p.on("close", (code) => { if (t) clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(`${cmd} a échoué (${code}) : ${err.slice(-800)}`)); });
  });
}

export async function probe(file: string) {
  const j = JSON.parse(await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]));
  const v = (j.streams ?? []).find((s: { codec_type: string }) => s.codec_type === "video");
  const a = (j.streams ?? []).find((s: { codec_type: string }) => s.codec_type === "audio");
  return { duration: Number(j.format?.duration ?? 0), width: v ? Number(v.width) : 0, height: v ? Number(v.height) : 0, hasAudio: Boolean(a) };
}

// MP4 H.264 + piste audio mono 16 kHz (MP3 32 kb/s ≈ 14 Mo/heure, sous la limite de 25 Mo des API Whisper par morceau).
export async function normalize(input: string, outVideo: string, outAudio: string) {
  await run("ffmpeg", ["-y", "-i", input, "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-pix_fmt", "yuv420p", "-vf", "scale='min(1920,iw)':-2", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", outVideo]);
  await run("ffmpeg", ["-y", "-i", outVideo, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", outAudio]);
}

export async function splitAudio(audio: string, chunkSec: number, outPattern: string) {
  await run("ffmpeg", ["-y", "-i", audio, "-f", "segment", "-segment_time", String(chunkSec), "-c", "copy", outPattern]);
}
