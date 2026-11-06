// Page « Conseils IA » : quelles IA utiliser selon le type de projet.
// Sélection établie en novembre 2026 à partir de comparatifs publics ; les outils et leurs prix
// changent vite, d'où la mention « à vérifier » sur la page. Mettre à jour ADVICE_DATE à chaque révision.
import type { FeatureKey } from "./settings";

export const ADVICE_DATE = "novembre 2026";

export type AiTool = { name: string; url: string; why: string; price: "Gratuit" | "Gratuit pour tester" | "Payant"; app?: string; slug?: string }; // slug : fond et logo dans public/conseils-ia/ // app : outil utilisable dans Clipr (lib/ai-tools)
export type AiStep = { title: string; tools: AiTool[] };
export type AiProject = {
  id: string;
  title: string;
  pitch: string;
  inClipr?: { feature: FeatureKey; href: string; label: string; how: string };
  steps: AiStep[];
  tips: string[];
};

const T = {
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com", price: "Gratuit pour tester", app: "chatgpt" },
  claude: { name: "Claude", url: "https://claude.ai", price: "Gratuit pour tester", app: "claude" },
  gptImage: { name: "GPT Image 2 (dans ChatGPT)", url: "https://chatgpt.com", price: "Gratuit pour tester", app: "gpt-image" },
  nanoBanana: { name: "Nano Banana (Gemini)", url: "https://gemini.google.com", price: "Gratuit pour tester" },
  midjourney: { name: "Midjourney", url: "https://www.midjourney.com", price: "Payant" },
  flux: { name: "FLUX.2", url: "https://bfl.ai", price: "Gratuit pour tester", app: "flux" },
  kling: { name: "Kling 3.0", url: "https://klingai.com", price: "Gratuit pour tester", app: "kling" },
  veo: { name: "Veo 3.1 (Google)", url: "https://gemini.google.com", price: "Payant", app: "veo" },
  seedance: { name: "Seedance 2.0 (Dreamina)", url: "https://dreamina.capcut.com", price: "Gratuit pour tester", app: "seedance" },
  runway: { name: "Runway Gen-4.5", url: "https://runwayml.com", price: "Gratuit pour tester" },
  higgsfield: { name: "Higgsfield (Soul ID)", url: "https://higgsfield.ai", price: "Payant" },
  elevenlabs: { name: "ElevenLabs", url: "https://elevenlabs.io", price: "Gratuit pour tester", app: "elevenlabs" },
  heygen: { name: "HeyGen", url: "https://www.heygen.com", price: "Gratuit pour tester" },
  hedra: { name: "Hedra", url: "https://www.hedra.com", price: "Gratuit pour tester" },
  suno: { name: "Suno", url: "https://suno.com", price: "Gratuit pour tester" },
  capcut: { name: "CapCut", url: "https://www.capcut.com", price: "Gratuit" },
  opus: { name: "OpusClip", url: "https://www.opus.pro", price: "Gratuit pour tester" },
  vizard: { name: "Vizard", url: "https://vizard.ai", price: "Gratuit pour tester" },
  submagic: { name: "Submagic", url: "https://www.submagic.co", price: "Gratuit pour tester" },
} satisfies Record<string, Omit<AiTool, "why">>;

const t = (k: keyof typeof T, why: string): AiTool => ({ ...T[k], why, slug: k } as AiTool);

export const PROJECTS: AiProject[] = [
  {
    id: "fruit-ia",
    title: "Fruits IA",
    pitch: "Séries de fruits ou d'objets qui parlent, en mini-feuilleton (le format popularisé par « Fruit Love Island » sur TikTok).",
    inClipr: { feature: "aiVideos", href: "/videos-ia", label: "Créer une série", how: "Crée un personnage de type objet ou animal (ta fraise, ton ananas…), puis une série : Clipr écrit chaque épisode en se souvenant des précédents, fait la voix off et monte la vidéo." },
    steps: [
      { title: "Écrire l'épisode", tools: [t("chatgpt", "Dialogues courts, rebondissements et cliffhanger en fin d'épisode."), t("claude", "Très bon pour garder la cohérence des personnages sur plusieurs épisodes.")] },
      { title: "Dessiner les personnages", tools: [t("gptImage", "Celui qui suit le mieux un prompt précis : expressions, décor, tenue."), t("nanoBanana", "Retouche par la conversation pour garder le même fruit d'une image à l'autre.")] },
      { title: "Animer et faire parler", tools: [t("kling", "Personnages expressifs et synchronisation des lèvres, y compris en français."), t("seedance", "Plusieurs images de référence pour garder les personnages identiques d'un plan à l'autre."), t("veo", "Son généré avec l'image (voix, ambiance) et rendu très réaliste.")] },
      { title: "Voix et montage", tools: [t("elevenlabs", "Une voix différente et reconnaissable par personnage."), t("capcut", "Sous-titres, musique et enchaînement des plans.")] },
    ],
    tips: [
      "Garde une fiche par personnage (image de référence + description) et réutilise-la à chaque épisode.",
      "Épisodes de 30 à 60 s, numérotés (« Épisode 4 »), qui finissent sur une question pour faire revenir.",
      "Invente ton propre concept et tes propres personnages plutôt que de reprendre une série existante.",
    ],
  },
  {
    id: "influenceur-ia",
    title: "Influenceur IA",
    pitch: "Un personnage humain virtuel qui publie régulièrement : même visage, même voix, même univers.",
    inClipr: { feature: "aiVideos", href: "/videos-ia", label: "Créer le personnage", how: "Crée un personnage humain réutilisable avec sa description et sa voix : chaque vidéo générée garde la même identité." },
    steps: [
      { title: "Fixer le visage", tools: [t("higgsfield", "Apprend une identité à partir d'une vingtaine de photos : le visage dérive beaucoup moins."), t("nanoBanana", "Repart d'une image de référence pour décliner tenues et décors."), t("flux", "Pour aller plus loin : entraîner un modèle (LoRA) sur le personnage.")] },
      { title: "Le mettre en vidéo", tools: [t("kling", "Le plus convaincant sur les visages et les mouvements humains, avec lip-sync multilingue."), t("runway", "Génère à partir d'une image de référence, avec beaucoup de contrôle sur le plan.")] },
      { title: "Lui donner une voix", tools: [t("elevenlabs", "Crée (ou clone avec autorisation) une voix unique, à réutiliser dans toutes les vidéos."), t("heygen", "Vidéos face caméra et doublage dans d'autres langues.")] },
    ],
    tips: [
      "Valide le visage et la voix avant la première publication : les changer ensuite casse la reconnaissance.",
      "Indique que le compte est généré par IA : TikTok demande d'étiqueter les contenus réalistes créés par IA.",
      "N'imite jamais une personne réelle, ni son visage ni sa voix.",
    ],
  },
  {
    id: "clips",
    title: "Clips d'une vidéo longue",
    pitch: "Découper un podcast, un live ou une interview en clips verticaux avec sous-titres animés.",
    inClipr: { feature: "clips", href: "/tableau-de-bord", label: "Clipper une vidéo", how: "C'est le cœur de Clipr : transcription mot à mot, passages notés sur 100, recadrage 9:16 qui suit la personne qui parle, sous-titres animés et publication." },
    steps: [
      { title: "Peaufiner un clip à la main", tools: [t("capcut", "Retouches fines, effets, musique tendance."), t("submagic", "Sous-titres très travaillés (emojis, zooms) si tu veux un autre style.")] },
      { title: "Autres outils de clipping", tools: [t("opus", "La référence du marché, pour comparer les passages choisis."), t("vizard", "Pratique pour les podcasts et vidéos face caméra.")] },
    ],
    tips: [
      "Pars des vidéos qui montent dans Tendances : un sujet déjà chaud fait plus de vues.",
      "Les 3 premières secondes décident de tout : commence le clip sur la phrase la plus forte.",
      "Ne clippe que les chaînes qui l'autorisent ou les vidéos dont tu as les droits.",
    ],
  },
  {
    id: "faceless",
    title: "Vidéo sans visage",
    pitch: "Histoires racontées, faits étonnants, tops : une voix off sur des images générées, sans jamais apparaître.",
    inClipr: { feature: "aiVideos", href: "/videos-ia", label: "Créer la vidéo", how: "Donne une idée : Clipr écrit le script, fait la voix off, génère une image par scène animée en mouvement de caméra, ajoute les sous-titres et monte la vidéo." },
    steps: [
      { title: "Script", tools: [t("chatgpt", "Structure accroche → histoire → chute, adaptée à la durée."), t("claude", "Récits plus longs et plus naturels à lire à voix haute.")] },
      { title: "Visuels", tools: [t("gptImage", "Scènes fidèles au script, avec du texte lisible dans l'image."), t("midjourney", "Le plus beau rendu artistique pour un style marqué.")] },
      { title: "Voix et musique", tools: [t("elevenlabs", "La voix off française la plus naturelle."), t("suno", "Musique originale : la version payante est nécessaire pour un usage commercial.")] },
    ],
    tips: [
      "Une même voix et un même style d'image sur toute la chaîne : c'est ce qui la rend reconnaissable.",
      "Vise 45 à 75 s pour TikTok, avec un rebondissement toutes les 10 secondes.",
    ],
  },
];

// Vue d'ensemble : le meilleur choix par besoin, et une alternative.
export const TOOLBOX: { need: string; pick: AiTool; alt: AiTool }[] = [
  { need: "Écrire un script", pick: t("chatgpt", ""), alt: t("claude", "") },
  { need: "Image", pick: t("gptImage", ""), alt: t("nanoBanana", "") },
  { need: "Image au style artistique", pick: t("midjourney", ""), alt: t("flux", "") },
  { need: "Vidéo avec personnages", pick: t("kling", ""), alt: t("seedance", "") },
  { need: "Vidéo réaliste avec son", pick: t("veo", ""), alt: t("runway", "") },
  { need: "Voix off française", pick: t("elevenlabs", ""), alt: t("heygen", "") },
  { need: "Faire parler un personnage", pick: t("kling", ""), alt: t("hedra", "") },
  { need: "Musique", pick: t("suno", ""), alt: t("elevenlabs", "") },
  { need: "Montage et sous-titres", pick: t("capcut", ""), alt: t("submagic", "") },
];

// « Créer avec l'IA » : page prompt par projet. L'idée libre + les options choisies donnent le prompt
// envoyé à la génération d'images (ou de vidéo) de Clipr. La première valeur de chaque option est celle par défaut.
export type CreatorField = { name: string; label: string; choices: string[] };
export type Creator = {
  title: string;
  intro: string;
  placeholder: string;
  video: boolean; // la vidéo a un sens pour ce projet (si un modèle vidéo est configuré)
  fields: CreatorField[];
  build: (idea: string, o: Record<string, string>) => string;
};

export const CREATORS: Record<string, Creator> = {
  "fruit-ia": {
    title: "Créer une scène de Fruits IA",
    intro: "Décris la scène de ton épisode : qui parle, ce qui se passe, le rebondissement.",
    placeholder: "La fraise découvre que la banane l'a trompée avec l'ananas, au bord de la piscine",
    video: true,
    fields: [
      { name: "perso", label: "Personnage principal", choices: ["Fraise", "Banane", "Ananas", "Pastèque", "Avocat", "Citron", "Pêche", "Raisin"] },
      { name: "emotion", label: "Émotion", choices: ["choqué", "amoureux", "en colère", "triste", "joyeux", "jaloux"] },
      { name: "style", label: "Style", choices: ["3D façon film d'animation", "réaliste", "pâte à modeler", "dessin animé 2D"] },
      { name: "decor", label: "Décor", choices: ["villa au bord de la piscine", "cuisine", "plage", "intérieur d'un frigo", "marché", "salle de classe"] },
      { name: "plan", label: "Cadrage", choices: ["gros plan sur le visage", "plan moyen", "plan large"] },
      { name: "lumiere", label: "Lumière", choices: ["soleil doré", "néons de nuit", "lumière douce de studio"] },
    ],
    build: (idea, o) => `Style ${o.style}. Personnage : ${o.perso} personnifié avec un visage expressif (grands yeux, bouche, sourcils), émotion : ${o.emotion}. Décor : ${o.decor}. Cadrage : ${o.plan}. Lumière : ${o.lumiere}. Scène : ${idea}. Image verticale, rendu net et coloré, aucun texte.`,
  },
  "influenceur-ia": {
    title: "Créer une photo d'influenceur IA",
    intro: "Décris ton personnage et la photo que tu veux pour son prochain post.",
    placeholder: "Léa, 25 ans, cheveux bruns bouclés, taches de rousseur, boit un café en terrasse",
    video: true,
    fields: [
      { name: "type", label: "Type de photo", choices: ["selfie au smartphone", "photo lifestyle", "portrait studio", "photo en mouvement"] },
      { name: "lieu", label: "Lieu", choices: ["café en terrasse", "salle de sport", "plage", "appartement lumineux", "rue de nuit", "montagne"] },
      { name: "tenue", label: "Tenue", choices: ["décontractée", "streetwear", "élégante", "sport"] },
      { name: "moment", label: "Moment", choices: ["golden hour", "matin", "soirée"] },
      { name: "plan", label: "Cadrage", choices: ["portrait serré", "mi-corps", "en pied"] },
    ],
    build: (idea, o) => `Photo réaliste pour les réseaux sociaux, ${o.type}. Personnage fictif : ${idea}. Lieu : ${o.lieu}. Tenue ${o.tenue}. Moment : ${o.moment}. Cadrage : ${o.plan}. Peau et lumière naturelles, image verticale, aucun texte, ne ressemble à aucune personne réelle.`,
  },
  clips: {
    title: "Créer une miniature de clip",
    intro: "Décris le sujet de ton clip : la miniature doit donner envie de cliquer.",
    placeholder: "Un podcasteur choqué par une révélation sur l'argent",
    video: false,
    fields: [
      { name: "expr", label: "Expression", choices: ["choqué", "souriant", "sérieux", "en train de rire"] },
      { name: "fond", label: "Fond", choices: ["couleur unie vive", "flou de studio", "décor lié au sujet"] },
      { name: "couleur", label: "Couleur dominante", choices: ["jaune", "rouge", "bleu", "vert"] },
      { name: "style", label: "Style", choices: ["photo réaliste", "illustration"] },
    ],
    build: (idea, o) => `Miniature verticale accrocheuse pour une vidéo courte, ${o.style}. Sujet : ${idea}. Personne au premier plan avec une expression ${o.expr}, fond : ${o.fond}, couleur dominante ${o.couleur}, fort contraste, composition simple. Aucun texte.`,
  },
  faceless: {
    title: "Créer une image de vidéo sans visage",
    intro: "Décris la scène à illustrer (une image par scène de ton histoire).",
    placeholder: "Un phare isolé dans la tempête, une silhouette en haut de l'escalier",
    video: true,
    fields: [
      { name: "ambiance", label: "Ambiance", choices: ["mystère", "horreur", "motivation", "histoire vraie", "science", "aventure"] },
      { name: "style", label: "Style visuel", choices: ["cinématique réaliste", "illustration", "peinture numérique", "anime"] },
      { name: "palette", label: "Couleurs", choices: ["sombres", "chaudes", "froides", "pastel"] },
      { name: "plan", label: "Cadrage", choices: ["plan large", "plan moyen", "gros plan"] },
    ],
    build: (idea, o) => `Image ${o.style} pour une vidéo racontée, ambiance ${o.ambiance}. Scène : ${idea}. Couleurs ${o.palette}, ${o.plan}, éclairage dramatique. Image verticale, aucun texte, aucun visage reconnaissable.`,
  },
};
