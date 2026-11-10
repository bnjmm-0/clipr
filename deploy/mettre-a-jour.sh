#!/usr/bin/env bash
# Met à jour Clipr sur le serveur : récupère le code, installe, adapte la base, rebuild, redémarre.
# À lancer en tant qu'utilisateur clipr dans le dossier de l'appli : bash deploy/mettre-a-jour.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ "${1:-}" = "--sans-redemarrage" ] || git pull --ff-only

# Schéma de prod : identique au schéma du dépôt, avec PostgreSQL à la place de SQLite.
sed 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma > prisma/schema.prod.prisma

npm ci
npx prisma generate --schema prisma/schema.prod.prisma
npx prisma db push --schema prisma/schema.prod.prisma --skip-generate

# Python du suivi de visage (le worker utilise .venv s'il existe) et yt-dlp à jour.
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip opencv-python-headless yt-dlp
mkdir -p "$HOME/.local/bin" && ln -sf "$PWD/.venv/bin/yt-dlp" "$HOME/.local/bin/yt-dlp"

npm run build
[ "${1:-}" = "--sans-redemarrage" ] || pm2 reload deploy/ecosystem.config.cjs
echo "Clipr à jour."
