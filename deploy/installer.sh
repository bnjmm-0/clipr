#!/usr/bin/env bash
# Installation de Clipr sur un VPS Ubuntu 24.04 neuf (Hostinger ou autre).
# À lancer en root sur le VPS :
#   DOMAINE=getclipr.com bash installer.sh        (EMAIL=... facultatif)
# Le dépôt étant privé, le script crée une « clé de déploiement » (lecture seule), l'affiche et attend
# qu'elle soit ajoutée sur GitHub : dépôt > Settings > Deploy keys > Add deploy key.
# Relançable sans risque : chaque étape vérifie ce qui existe déjà.
set -euo pipefail
export HOME="${HOME:-/root}"

DOMAINE="${DOMAINE:?Indique le domaine, ex. DOMAINE=getclipr.com}"
EMAIL="${EMAIL:-}"   # facultatif : sert aux alertes d'expiration du certificat HTTPS
DEPOT="${DEPOT:-git@github.com:bnjmm-0/clipr.git}"
BRANCHE="${BRANCHE:-main}"
APP_USER=clipr
APP_DIR=/home/$APP_USER/app
STORAGE=/home/$APP_USER/storage

echo "==> 1/8 Paquets système (FFmpeg, Python, PostgreSQL, Nginx, polices)"
export DEBIAN_FRONTEND=noninteractive
apt-get -o DPkg::Lock::Timeout=900 update -y
apt-get -o DPkg::Lock::Timeout=900 install -y ca-certificates curl git ffmpeg python3 python3-venv postgresql nginx \
  certbot python3-certbot-nginx fonts-dejavu-core ufw openssl
if ! command -v node >/dev/null || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get -o DPkg::Lock::Timeout=900 install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

echo "==> 2/8 Utilisateur $APP_USER et pare-feu"
id $APP_USER >/dev/null 2>&1 || useradd -m -s /bin/bash $APP_USER
mkdir -p "$STORAGE" && chown $APP_USER:$APP_USER "$STORAGE"
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

echo "==> 3/8 Base PostgreSQL"
if [ ! -f /root/.clipr-db-pass ]; then openssl rand -hex 24 > /root/.clipr-db-pass; chmod 600 /root/.clipr-db-pass; fi
DB_PASS=$(cat /root/.clipr-db-pass)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='clipr'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER clipr WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='clipr'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE clipr OWNER clipr;"

echo "==> 4/8 Code de l'appli"
if [[ "$DEPOT" == git@* ]]; then
  K=/home/$APP_USER/.ssh/id_ed25519
  sudo -H -u $APP_USER mkdir -p -m 700 /home/$APP_USER/.ssh
  if [ -n "${CLE_DEPLOIEMENT:-}" ] && [ ! -f "$K" ]; then
    install -o $APP_USER -g $APP_USER -m 600 "$CLE_DEPLOIEMENT" "$K"
    sudo -H -u $APP_USER ssh-keygen -y -f "$K" > "$K.pub"
  fi
  if [ ! -f "$K" ]; then
    sudo -H -u $APP_USER ssh-keygen -q -t ed25519 -N "" -C "clipr-vps" -f "$K"
  fi
  sudo -H -u $APP_USER bash -c "ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null; sort -u -o ~/.ssh/known_hosts ~/.ssh/known_hosts"
  until sudo -H -u $APP_USER git ls-remote "$DEPOT" >/dev/null 2>&1; do
    if [ ! -t 0 ]; then echo "    En attente de la clé de déploiement sur GitHub..."; sleep 30; continue; fi
    echo
    echo "    Ajoute cette clé sur GitHub (dépôt > Settings > Deploy keys > Add deploy key, sans cocher l'écriture) :"
    echo
    cat "$K.pub"
    echo
    read -r -p "    Appuie sur Entrée une fois la clé ajoutée... " _ </dev/tty
  done
fi
if [ ! -d "$APP_DIR/.git" ]; then sudo -H -u $APP_USER git clone --branch "$BRANCHE" "$DEPOT" "$APP_DIR"
else sudo -H -u $APP_USER git -C "$APP_DIR" pull --ff-only; fi
# Le kit deploy/ doit être sur la branche (PR fusionnée) : on attend qu'il arrive.
until [ -f "$APP_DIR/deploy/mettre-a-jour.sh" ]; do
  echo "    En attente du dossier deploy/ sur la branche $BRANCHE (fusionner la PR)..."; sleep 30
  sudo -H -u $APP_USER git -C "$APP_DIR" pull --ff-only || true
done

echo "==> 5/8 Fichier .env"
if [ ! -f "$APP_DIR/.env" ]; then
  KEY=$(openssl rand -base64 32)
  cat > "$APP_DIR/.env" <<ENV
DATABASE_URL="postgresql://clipr:$DB_PASS@localhost:5432/clipr"
ENCRYPTION_KEY="$KEY"
APP_URL="https://$DOMAINE"
STORAGE_DIR="$STORAGE"
YOUTUBE_DAILY_QUOTA=10000
NODE_ENV=production
ENV
  chown $APP_USER:$APP_USER "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"
  echo "    ENCRYPTION_KEY créée. SAUVEGARDE-LA AILLEURS : grep ENCRYPTION_KEY $APP_DIR/.env"
fi

echo "==> 6/8 Dépendances, base, build"
sudo -H -u $APP_USER bash -lc "cd $APP_DIR && bash deploy/mettre-a-jour.sh --sans-redemarrage"

echo "==> 7/8 Démarrage permanent (PM2)"
sudo -H -u $APP_USER bash -lc "cd $APP_DIR && pm2 startOrReload deploy/ecosystem.config.cjs && pm2 save"
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER >/dev/null

echo "==> 8/8 Nginx + HTTPS"
sed "s/__DOMAINE__/$DOMAINE/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/clipr
ln -sf /etc/nginx/sites-available/clipr /etc/nginx/sites-enabled/clipr
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
if [ -n "$EMAIL" ]; then CB_MAIL=(-m "$EMAIL"); else CB_MAIL=(--register-unsafely-without-email); fi
certbot --nginx --non-interactive --agree-tos "${CB_MAIL[@]}" -d "$DOMAINE" -d "www.$DOMAINE" --redirect \
  || echo "    HTTPS pas encore posé : vérifie que le DNS de $DOMAINE pointe vers ce serveur, puis relance ce script."

echo
echo "Terminé. Ouvre https://$DOMAINE et crée le premier compte (il devient administrateur)."
