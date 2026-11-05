import fs from "node:fs";
import path from "node:path";

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");

export function projectDir(projectId: string) {
  const d = path.join(STORAGE_DIR, "projects", projectId);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
export function genDir() {
  const d = path.join(STORAGE_DIR, "generations");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
// Empêche toute sortie du dossier de stockage.
export function safeResolve(p: string) {
  const r = path.resolve(p);
  if (!r.startsWith(STORAGE_DIR + path.sep)) throw new Error("Chemin hors stockage");
  return r;
}
