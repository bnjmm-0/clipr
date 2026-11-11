// Aide à l'idée des vidéos IA et des séries : recettes d'histoires prêtes à l'emploi (gratuites),
// remplies avec les personnages cochés. Fichier sans dépendance serveur (utilisé par le formulaire).

export type Recipe = { id: string; label: string; video: string; series: string };

// {A}, {B}, {C} : personnages cochés dans l'ordre (sinon des fruits par défaut).
export const STORY_RECIPES: Recipe[] = [
  { id: "trahison", label: "💔 Trahison",
    video: "{A} surprend {B} en train d'embrasser {C} à la soirée piscine. {A} explose devant tout le monde ; {B} jure que c'est un malentendu… jusqu'à ce qu'une photo tombe sur le téléphone de {A}. Fin : {A} prépare sa revanche.",
    series: "Une villa, des fruits en couple. Chaque épisode, une trahison, une dispute ou un nouveau couple : {A} la jalouse, {B} le menteur, {C} qui sème la zizanie. Chaque fin laisse une question ouverte." },
  { id: "victime", label: "🥺 Victime attachante",
    video: "{A}, un peu abîmé(e), se fait rejeter de partout : le frigo, le panier, la salade de fruits. Au moment où on le/la jette, {B} prend sa défense… et tout bascule. Fin émouvante et inattendue.",
    series: "{A}, fruit abîmé que tout le monde rejette, cherche sa place. Chaque épisode, une nouvelle humiliation puis une petite victoire, avec {B} comme seul allié et {C} comme rival qui le méprise." },
  { id: "jalousie", label: "😤 Jalousie",
    video: "{A} est persuadé(e) que {B} lui cache quelque chose : messages effacés, retards, parfum inconnu. {A} mène l'enquête avec {C}… et découvre la vérité au pire moment.",
    series: "{A} jaloux(se) maladif(ve), {B} qui a vraiment des secrets, {C} l'ami(e) qui sait tout. Chaque épisode, un nouvel indice et une nouvelle crise." },
  { id: "revanche", label: "😈 Revanche",
    video: "{B} a humilié {A} devant tout le marché. Une semaine plus tard, {A} revient transformé(e) et retourne la situation de façon spectaculaire. Dernière réplique qui claque.",
    series: "{A} prépare sa revanche contre {B} qui l'a trahi(e). Chaque épisode, une étape du plan, un imprévu, et {C} qui hésite entre les deux camps." },
  { id: "amour", label: "💘 Amour interdit",
    video: "{A} et {B} tombent amoureux mais leurs familles se détestent (la corbeille de fruits contre le panier de légumes). Rendez-vous secret au clair de lune… interrompu par {C}.",
    series: "Amour impossible entre {A} et {B}, de deux camps rivaux. Chaque épisode, un rendez-vous secret, un obstacle, et {C} qui menace de tout révéler." },
  { id: "secret", label: "🤫 Secret de famille",
    video: "Au repas de famille, {C} lâche une phrase qui fait tomber le masque : {A} n'est pas qui il/elle prétend être. Silence, regards, puis la révélation finale de {B}.",
    series: "Une famille de fruits pleine de secrets. Chaque épisode révèle une vérité cachée sur {A}, {B} ou {C}, et finit sur un nouveau mystère." },
  { id: "comedie", label: "😂 Défi absurde",
    video: "{A} parie avec {B} qu'il/elle peut tenir une journée entière sans se faire éplucher. Tout tourne mal de façon de plus en plus absurde. Chute drôle avec {C}.",
    series: "{A} et {B}, duo de colocataires que tout oppose. Chaque épisode, un défi absurde, des catastrophes en chaîne et une chute drôle, avec {C} en voisin(e) exaspéré(e)." },
  { id: "mystere", label: "🔍 Mystère",
    video: "Quelqu'un a croqué le gâteau d'anniversaire de {A}. Tous les suspects sont dans la cuisine : {B}, {C}… {A} mène l'enquête, et le coupable est celui qu'on attendait le moins.",
    series: "Une cuisine, un mystère par épisode. {A} détective, {B} suspect idéal, {C} trop calme pour être innocent. Chaque fin révèle un indice sur un mystère plus grand." },
];

const DEFAULTS = ["la fraise", "la banane", "le kiwi"];

// Remplit une recette avec les noms des personnages cochés (dans l'ordre), ou des fruits par défaut.
export function fillRecipe(r: Recipe, kind: "video" | "series", names: string[]) {
  const n = [...names.filter(Boolean), ...DEFAULTS.filter((d) => !names.some((x) => x.toLowerCase() === d.split(" ")[1]))];
  return r[kind].replace(/\{([ABC])\}/g, (_, k: string) => n["ABC".indexOf(k)] ?? DEFAULTS["ABC".indexOf(k)]).replace(/^(.)/, (c) => c.toUpperCase());
}
