// Options de création des vidéos IA et des séries (bloc « Plus d'options » des formulaires).
// Chaque choix devient une consigne pour le scénariste (writeScript) ; vide = au choix de l'IA.

type Choice = { v: string; label: string; hint?: string };
export type StoryField =
  | { name: string; label: string; kind: "select"; choices: Choice[] }
  | { name: string; label: string; kind: "text"; placeholder: string; suggestions?: string[]; max: number };

const any: Choice = { v: "", label: "Au choix de l'IA" };

export const STORY_FIELDS: StoryField[] = [
  { name: "genre", label: "Genre", kind: "select", choices: [any,
    { v: "drame", label: "Drame façon télé-réalité", hint: "disputes, jalousie, trahisons, confessions face caméra" },
    { v: "comedie", label: "Comédie", hint: "situations absurdes, répliques qui claquent, comique de répétition" },
    { v: "romance", label: "Romance", hint: "coup de foudre, déclaration, rival amoureux" },
    { v: "suspense", label: "Suspense", hint: "mystère à résoudre, indices, tension qui monte" },
    { v: "horreur", label: "Horreur légère", hint: "frissons sans violence graphique, menace qui approche" },
    { v: "action", label: "Action", hint: "course-poursuite, défi, sauvetage" },
    { v: "absurde", label: "Absurde / WTF", hint: "logique décalée assumée, chute inattendue" },
    { v: "educatif", label: "Éducatif", hint: "une vraie information vérifiable expliquée par les personnages" },
    { v: "motivation", label: "Motivation", hint: "un obstacle, un déclic, une victoire" }] },
  { name: "hook", label: "Accroche", kind: "select", choices: [any,
    { v: "medias", label: "En pleine action", hint: "on arrive au milieu d'une dispute ou d'une scène déjà lancée" },
    { v: "question", label: "Question choc", hint: "la première réplique pose une question qui oblige à rester" },
    { v: "revelation", label: "Révélation / secret", hint: "un secret est annoncé dès la première seconde" },
    { v: "phrase", label: "Phrase choc d'un personnage", hint: "une réplique culte, courte et surprenante" },
    { v: "avantapres", label: "Avant / après", hint: "on montre le contraste entre deux situations" }] },
  { name: "ending", label: "Fin", kind: "select", choices: [any,
    { v: "cliffhanger", label: "Rebondissement « à suivre »", hint: "finit sur une question ouverte qui donne envie de voir la suite" },
    { v: "chute", label: "Chute drôle", hint: "dernière réplique inattendue qui fait rire" },
    { v: "morale", label: "Morale / leçon", hint: "une phrase courte qui résume la leçon" },
    { v: "boucle", label: "Boucle", hint: "la dernière scène renvoie à la première, pour que la vidéo se regarde en boucle" },
    { v: "abonne", label: "Appel à s'abonner", hint: "un personnage invite à s'abonner pour la suite, naturellement" }] },
  { name: "rhythm", label: "Rythme", kind: "select", choices: [
    { v: "dynamique", label: "Dynamique (une scène toutes les 6 s)" },
    { v: "rapide", label: "Très rapide (toutes les 4 s)" },
    { v: "pose", label: "Posé (toutes les 8 s)" }] },
  { name: "audience", label: "Public", kind: "select", choices: [any,
    { v: "famille", label: "Tout public / famille", hint: "aucune vulgarité" },
    { v: "ados", label: "Ados", hint: "références et humour des 13-17 ans, sans vulgarité" },
    { v: "jeunes", label: "Jeunes adultes (18-25)" },
    { v: "adultes", label: "Adultes" }] },
  { name: "register", label: "Langage", kind: "select", choices: [any,
    { v: "courant", label: "Courant" },
    { v: "familier", label: "Familier / jeune", hint: "expressions orales actuelles, sans argot rare difficile à prononcer pour une voix de synthèse" },
    { v: "theatral", label: "Théâtral / dramatique", hint: "répliques exagérées façon soap opera" }] },
  { name: "setting", label: "Décor", kind: "text", max: 120, placeholder: "Ex. villa avec piscine", suggestions: ["villa avec piscine", "cuisine", "intérieur d'un frigo", "plage", "supermarché", "école", "salle de sport", "boîte de nuit", "station spatiale"] },
  { name: "light", label: "Lumière", kind: "select", choices: [any,
    { v: "golden", label: "Coucher de soleil", hint: "golden hour, warm light around 3500K" },
    { v: "soleil", label: "Plein soleil", hint: "bright daylight around 5500K" },
    { v: "neon", label: "Nuit néon", hint: "night, pink and blue neon lights" },
    { v: "studio", label: "Studio doux", hint: "soft even studio light" },
    { v: "pluie", label: "Pluie dramatique", hint: "rainy night, wet reflections, moody contrast" },
    { v: "tamise", label: "Tamisé / bougies", hint: "dim warm candlelight around 2700K" }] },
  { name: "style", label: "Style visuel", kind: "select", choices: [{ v: "", label: "Celui des personnages" },
    { v: "3d", label: "3D hyperréaliste façon film d'animation", hint: "hyperrealistic 3D animated film look, glossy textures" },
    { v: "macro", label: "Photo macro réaliste", hint: "photorealistic macro photography, shallow depth of field" },
    { v: "clay", label: "Pâte à modeler", hint: "claymation, handmade plasticine texture" },
    { v: "anime", label: "Anime", hint: "Japanese anime style, cel shading" },
    { v: "cartoon", label: "Dessin animé 2D", hint: "2D cartoon, bold outlines, flat colors" },
    { v: "cine", label: "Cinématique", hint: "cinematic film look, anamorphic, dramatic lighting" }] },
  { name: "framing", label: "Cadrage", kind: "select", choices: [any,
    { v: "serre", label: "Gros plans sur les émotions", hint: "mostly close-ups and medium close-ups on faces" },
    { v: "large", label: "Plans larges du décor", hint: "mostly wide and medium-wide shots showing the set" },
    { v: "mixte", label: "Mixte", hint: "alternate wide, medium and close-up shots" }] },
  { name: "inspiration", label: "Inspiration", kind: "text", max: 300, placeholder: "Une vidéo qui marche à imiter : lien ou description de sa mécanique" },
];

const SECONDS: Record<string, number> = { rapide: 4, dynamique: 6, pose: 8 };
export type StoryOptions = Record<string, string> & { episodeLabel?: string };

// Lit les options d'un formulaire (valeurs vérifiées) ; null s'il n'y a rien de choisi.
export function readStoryOptions(fd: FormData): string | null {
  const o: Record<string, string> = {};
  for (const f of STORY_FIELDS) {
    const v = String(fd.get(`opt_${f.name}`) ?? "").trim();
    if (!v) continue;
    if (f.kind === "select" ? f.choices.some((c) => c.v === v) : true) o[f.name] = f.kind === "text" ? v.slice(0, f.max) : v;
  }
  if (fd.get("opt_episodeLabel") === "on") o.episodeLabel = "1";
  return Object.keys(o).length ? JSON.stringify(o) : null;
}

export const parseOptions = (json?: string | null): StoryOptions => (json ? JSON.parse(json) : {});
export const secondsPerScene = (o: StoryOptions) => SECONDS[o.rhythm ?? ""] ?? 6;

const choice = (name: string, v?: string) => {
  const f = STORY_FIELDS.find((x) => x.name === name);
  return f?.kind === "select" ? f.choices.find((c) => c.v === v) : undefined;
};

// Consignes pour le scénariste (en français, avec les précisions d'image en anglais pour le champ "visual").
export function optionsPrompt(o: StoryOptions) {
  const lines: string[] = [];
  for (const f of STORY_FIELDS) {
    const v = o[f.name];
    if (!v || f.name === "rhythm") continue;
    if (f.kind === "text") lines.push(f.name === "inspiration" ? `- Inspiration à imiter (mécanique, pas les phrases) : ${v}` : `- ${f.label} : ${v} (le même décor dans toutes les scènes, sauf si l'histoire l'exige)`);
    else { const c = choice(f.name, v); if (c) lines.push(`- ${f.label} : ${c.label}${c.hint ? ` (${c.hint})` : ""}`); }
  }
  return lines.length ? `\nOptions de création choisies (à respecter) :\n${lines.join("\n")}` : "";
}

// Style imposé par les options (remplace celui des personnages dans les images des scènes).
export const styleOverride = (o: StoryOptions) => choice("style", o.style)?.hint;

// Résumé lisible (page de la vidéo).
export function optionsSummary(o: StoryOptions) {
  return STORY_FIELDS.map((f) => {
    const v = o[f.name];
    if (!v) return null;
    return `${f.label} : ${f.kind === "text" ? v : choice(f.name, v)?.label ?? v}`;
  }).filter(Boolean).join(" · ");
}
