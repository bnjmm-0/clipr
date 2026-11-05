# Clipr — SaaS de clipping vidéo

Transforme une vidéo longue (podcast, interview, live) en clips verticaux 9:16 avec sous-titres animés,
puis les publie sur TikTok. Modules optionnels : texte → image / vidéo et Coach TikTok.

## Principes

- **L'exploitant choisit les fonctions** : le premier compte créé est administrateur. Dans **Réglages**, il active
  ou désactive Clips, Texte → image, Texte → vidéo, Coach TikTok et Publication TikTok.
- **Ses propres clés API** (OpenAI, Anthropic, Groq, Replicate, TikTok) sont saisies dans Réglages.
  Elles sont chiffrées en AES-256-GCM côté serveur avec une clé maître `ENCRYPTION_KEY` (variable d'environnement).
  Elles ne sont jamais dans le code ni renvoyées au navigateur (seuls les 4 derniers caractères s'affichent).
- **Compteur d'usage** (`/usage`) : chaque appel payant (tokens LLM, minutes transcrites, images, vidéos) est
  enregistré avec un coût estimé. Les tarifs par défaut sont indicatifs et modifiables dans Réglages.
- **TikTok** : l'app développeur est créée sous le compte TikTok de l'exploitant (marche à suivre dans Réglages).
  Tant que TikTok n'a pas validé l'app, les publications sont privées.
- **Droits** : chaque import demande de confirmer la détention des droits ; voir `/cgu` (modèle à faire valider).

## Démarrage local

Prérequis : Node 20+, FFmpeg, Python 3 avec `opencv-python-headless` (suivi du visage ; sans lui, recadrage centré),
`yt-dlp` facultatif (import par lien).

```bash
npm install
cp .env.example .env
npm run gen:key          # coller le résultat dans ENCRYPTION_KEY du .env
npx prisma db push
npm run dev              # appli web sur http://localhost:3000
npm run worker           # dans un 2e terminal : traitements en arrière-plan
```

Créez le premier compte (il devient admin), puis renseignez les clés dans Réglages.

## Pipeline des clips (worker)

1. Import (upload en flux ou lien via yt-dlp) → 2. Normalisation FFmpeg (MP4 H.264 + audio mono 16 kHz)
→ 3. Transcription Whisper mot à mot (OpenAI ou Groq, par morceaux de 20 min) → 4. Candidats calés sur les fins de phrase
→ 5. Scoring LLM (accroche, émotion, autonomie, fin nette) → 6. Sélection sans chevauchement
→ 7. Recadrage 9:16 qui suit le visage (OpenCV, lissé) ou plan large sur fond flou → 8. Sous-titres animés (ASS/libass)
→ 9. Export 1080×1920 30 i/s + vignette → 10. Statut visible dans l'appli.

Chaque étape enregistre son résultat : une relance reprend là où le traitement s'est arrêté (3 tentatives).

### Motion design des clips

- 4 styles de sous-titres animés : **Pop** (mot actif jaune qui grossit), **Rebond** (mot qui saute et pivote),
  **Encadré** (mot sur fond coloré), **Machine à écrire** (apparition mot à mot).
- Entrée de chaque groupe de mots en glissé + fondu, titre d'accroche animé en ouverture, barre de progression animée.
- Fond flou avec zoom lent en mode plan large.

## Mise en production

- Base : passer `provider = "postgresql"` dans `prisma/schema.prisma` et `DATABASE_URL` vers Neon/Supabase (UE).
- Web : Vercel ou tout hébergeur Node. Le worker a besoin de FFmpeg et de disque : le déployer sur un serveur
  (Railway, Fly.io, VPS) avec le même `.env` et un `STORAGE_DIR` partagé — ou adapter `lib/storage.ts` vers S3/R2.
- `APP_URL` doit être l'URL publique (sert au retour OAuth TikTok).

## Pas encore fait (prochaines étapes du plan)

- Paiement Stripe (les minutes sont gérées par un registre de crédits, ajout manuel par l'admin dans Réglages).
- Connexion Google et emails (Resend) quand un traitement est prêt.
- Stockage S3/R2 et URL signées (aujourd'hui : disque local servi par une route authentifiée).
- Publication Reels / Shorts, kit de marque, traduction des sous-titres.

## Tests

```bash
npm test   # chiffrement, candidats, sous-titres ASS, rendu FFmpeg 9:16 réel
```

`tests/mock-openai.mjs` simule OpenAI pour un essai de bout en bout sans frais :
`OPENAI_BASE_URL=http://127.0.0.1:4010/v1` avant `npm start` et `npm run worker`.
