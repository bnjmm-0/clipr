import crypto from "node:crypto";

// Chiffrement AES-256-GCM des secrets (clés API, jetons TikTok).
// La clé maître vient de ENCRYPTION_KEY (variable d'environnement serveur), jamais du code.
function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY manquante : lancez `npm run gen:key` et ajoutez-la au .env");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY doit faire 32 octets en base64");
  return key;
}

export type Sealed = { ciphertext: string; iv: string; tag: string };

export function seal(plain: string, aad = "clip-saas"): Sealed {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { ciphertext: ct.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

export function open(s: Sealed, aad = "clip-saas"): string {
  const d = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(s.iv, "base64"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(s.ciphertext, "base64")), d.final()]).toString("utf8");
}

export const sealJson = (plain: string, aad?: string) => JSON.stringify(seal(plain, aad));
export const openJson = (json: string, aad?: string) => open(JSON.parse(json) as Sealed, aad);

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (n = 32) => crypto.randomBytes(n).toString("base64url");
