// Règles d'écriture des prompts des vidéos IA (scénario, images, mouvement, voix).
// Elles reprennent les bonnes pratiques de génération d'images et de vidéos : image de départ soignée,
// apparence verrouillée par une image de référence, une seule action par plan, aucun texte généré.

export const SCRIPT_RULES = `Règles du scénario :
- Les 2 premières secondes décident de tout : la première réplique est une accroche (conflit, question, révélation), jamais une présentation.
- Trois temps : accroche (premier tiers), développement concret, chute ou retournement à la fin. Un plan calme juste avant la chute la rend plus forte.
- Une seule idée et une seule action par scène. Phrases courtes, faites pour l'oral.
- Les nombres et sigles s'écrivent en toutes lettres dans les répliques (« dix-sept heures », « i-a »).
- N'invente aucun chiffre ni aucun fait présenté comme réel.`;

export const SERIES_RULES = `Règles d'une série : chaque épisode garde les mêmes personnages et leurs traits, fait avancer une intrigue (amour, rivalité, trahison, secret) et finit sur une question ou un rebondissement qui donne envie de voir le suivant.`;

export const VISUAL_RULES = `Règles du champ "visual" (prompt d'image, en anglais) :
- Ordre : cadrage et focale équivalente (ex. "medium close-up, 50mm equivalent") ; personnage(s) ; pose, regard, expression ; décor habité ; lumière avec ses sources et sa température en Kelvin ; captation (ex. "shot on a full-frame camera, ISO 200") ; puis "no text, no logo".
- Un personnage qui a une image de référence ne se redécrit pas : écris "the <nom> from the reference image, 100% matches the reference" et décris seulement sa pose, son expression et ce qui change.
- Une seule action visible. Mots concrets et mesurables plutôt que "beau" ou "joli".
- Pas d'écran ni d'interface, pas de texte, pas de logo : les sous-titres sont ajoutés au montage.`;

export const MOTION_RULES = `Règles du champ "motion" (prompt de mouvement pour animer l'image de la scène, en anglais) :
- Un mouvement de caméra précis (static shot, slow push-in, handheld natural sway, orbit, tracking shot).
- Une seule action principale, avec l'émotion du personnage ; s'il parle, "talks expressively, mouth moving naturally".
- Termine par "Keep the characters, outfits, set and lighting exactly as in the starting image. No text, no logo."`;

// Stratégie TikTok (Coach) : régularité, part de contenu découverte, pépites à refaire.
export const COACH_RULES = `Règles de stratégie :
- Régularité avant perfection : 3 à 7 vidéos par semaine, aux mêmes créneaux.
- 70 à 90 % de contenu « découverte » (épisodes, rebondissements, tendances), 15 à 20 % de contenu « confiance » (coulisses, making-of, avant/après), 5 à 10 % d'appel à l'action (s'abonner pour la suite, lien).
- Une « pépite » est une vidéo qui fait au moins 5 fois les vues habituelles du compte : identifie-la et propose de la refaire (même sujet, même accroche, même format, en mieux).
- Pour chaque idée, analyse trois choses : l'accroche des 2 premières secondes (dite, écrite, visuelle), le format, le montage et l'appel à l'action.
- Pour une série de personnages IA : épisodes numérotés, fin sur une question ou un rebondissement, mention « contenu généré par IA » à la publication.`;

// Fiche de référence d'un personnage : une seule vue de face, fond neutre, mains vides.
export function referencePrompt(c: { name: string; look: string; visualStyle: string }) {
  return `Character reference image of ${c.name}: a single front view, centered, waist-up (full body if it is a small creature or an object), relaxed neutral expression with a slight smile, empty hands, neutral light grey seamless background, soft even daylight 5500K, sharp focus. Appearance: ${c.look}. Style: ${c.visualStyle}. No other character, no props, no text, no logo.`;
}

// Direction de voix d'un personnage, identique dans toutes ses répliques (voix OpenAI).
export function voiceDirection(c?: { name: string; personality: string } | null) {
  return c ? `Joue ${c.name}, personnage de mini-feuilleton : ${c.personality || "expressif"}. Français de France, rythme vif, émotions marquées, sans pause longue.` : "Ton dynamique de créateur de contenu, français de France, rythme soutenu, sans pause longue.";
}
