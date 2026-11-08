// Créateur de personnages (page Personnages) : choix proposés et description assemblée.
// Fichier sans dépendance serveur : utilisé par le formulaire (aperçu en direct) et par le serveur.

export const FRUITS: [string, string][] = [
  ["🍓", "fraise"], ["🍌", "banane"], ["🍑", "pêche"], ["🥝", "kiwi"], ["🍍", "ananas"], ["🍉", "pastèque"],
  ["🍋", "citron"], ["🥑", "avocat"], ["🍇", "grappe de raisin"], ["🍒", "cerise"], ["🍊", "orange"], ["🍎", "pomme"],
  ["🥭", "mangue"], ["🥥", "noix de coco"], ["🍐", "poire"], ["🫐", "myrtille"], ["🥕", "carotte"], ["🍅", "tomate"],
];

export const BUILDER = {
  gender: ["fille", "garçon", "sans genre"],
  age: ["bébé", "ado", "adulte", "senior"],
  body: ["mignon et tout rond", "élancé", "musclé", "tout petit", "dodu"],
  eyes: ["grands yeux brillants avec de longs cils", "yeux en amande", "yeux endormis à demi fermés", "petits yeux malins", "yeux immenses et innocents"],
  mood: ["souriant", "boudeur", "charmeur", "timide", "colérique", "malicieux", "triste"],
  accessories: ["lunettes de soleil", "chaîne dorée", "casquette", "nœud papillon", "rouge à lèvres", "boucles d'oreilles", "couronne", "chapeau", "collier de perles", "tablier", "écouteurs", "sac à main", "montre en or", "bandeau"],
  outfits: ["maillot de bain", "costume élégant", "robe de soirée", "jogging", "tenue de chef cuisinier", "uniforme d'école", "blouse de docteur", "tenue de sport"],
  textures: [
    ["3D hyperréaliste façon film d'animation", "peau brillante et juteuse, gouttes de rosée"],
    ["Photo macro réaliste", "vraie texture du fruit, détails naturels"],
    ["Pâte à modeler", "texture pâte à modeler faite main"],
    ["Dessin animé 2D", "contours nets, couleurs vives et unies"],
    ["Anime", "style anime japonais, ombrage en aplats"],
  ] as [string, string][],
  personality: ["jalouse", "dramatique", "drôle", "menteur", "charmeur", "timide", "naïf", "rusé", "colérique", "romantique", "sûr de lui", "gentil", "paresseux", "ambitieux"],
};

export type BuilderState = {
  fruit: string; gender: string; age: string; body: string; eyes: string; mood: string;
  accessories: string[]; outfit: string; texture: string; details: string; personality: string[];
};

// Description d'apparence en français (reprise dans le prompt de la fiche et de chaque image).
export function assembleLook(s: BuilderState) {
  const tex = BUILDER.textures.find(([l]) => l === s.texture);
  const who = [s.gender !== "sans genre" ? s.gender : "", s.age].filter(Boolean).join(", ");
  return [
    `${s.fruit || "fruit"} anthropomorphe${who ? ` (${who})` : ""}`,
    s.body && `corps ${s.body}`,
    s.eyes,
    s.mood && `air ${s.mood}`,
    "petite bouche expressive, bras et jambes fins",
    s.outfit && `porte ${/^(un|une|des|le|la|les) /.test(s.outfit) ? s.outfit : `une tenue : ${s.outfit}`}`,
    s.accessories.length && `accessoires : ${s.accessories.join(", ")}`,
    tex && tex[1],
    s.details.trim(),
  ].filter(Boolean).join(", ");
}
