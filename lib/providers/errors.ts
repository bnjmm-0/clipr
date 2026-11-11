// Message clair quand un service d'IA refuse un appel : clé refusée ou crédit épuisé chez le fournisseur.
// Ces deux cas ne se règlent pas en réessayant (voir onFail dans worker/index.ts).
export function apiError(service: string, status: number, body: unknown): Error {
  const raw = typeof body === "string" ? body : JSON.stringify(body ?? "");
  let detail: unknown;
  try { const j = typeof body === "string" ? JSON.parse(body) : (body as Record<string, any>); detail = j?.error?.message ?? j?.detail?.message ?? j?.detail ?? j?.message; } catch {}
  if (status === 402 || /insufficient_quota|no credits|credit balance|quota_exceeded|billing|RESOURCE_EXHAUSTED/i.test(raw)) return new Error(`Crédit ${service} épuisé : ajoutez du crédit sur votre compte ${service}, puis relancez.`);
  if (status === 401 || /invalid[_ ]api[_ ]key|incorrect api key|invalid x-api-key|API_KEY_INVALID|API key not valid/i.test(raw)) return new Error(`Clé ${service} refusée : vérifiez-la dans Réglages.`);
  return new Error(`${service} : ${String(detail ?? raw).slice(0, 300) || status}`);
}
