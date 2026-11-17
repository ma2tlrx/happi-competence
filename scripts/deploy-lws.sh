#!/usr/bin/env bash
# Déploiement par SSH sur l'hébergement LWS (cPanel, Passenger) : construit le paquet, le synchronise
# par rsync dans le dossier de l'application, puis redémarre l'application (tmp/restart.txt).
#
#   LWS_SSH=utilisateur@serveur.lws-hosting.com LWS_APP_DIR=happi-competence scripts/deploy-lws.sh
#
# Variables :
#   LWS_SSH        compte SSH (cPanel → Accès SSH ; authentification par clé recommandée)
#   LWS_APP_DIR    « Application root » de Setup Node.js App, relatif au dossier personnel
#   LWS_SSH_PORT   port SSH (défaut : 22)
#   SKIP_BUILD=1   réutilise le dernier build standalone
# Aucun secret ici : les variables de l'application se saisissent dans cPanel (docs/hebergement-lws.md).
set -euo pipefail

: "${LWS_SSH:?LWS_SSH est requis (utilisateur@serveur).}"
: "${LWS_APP_DIR:?LWS_APP_DIR est requis (dossier de l’application sur le serveur).}"
port="${LWS_SSH_PORT:-22}"
root="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${SKIP_BUILD:-}" = "1" ]; then
  node "$root/scripts/package-lws.mjs" --skip-build --no-zip
else
  node "$root/scripts/package-lws.mjs" --no-zip
fi

echo "▸ Synchronisation vers $LWS_SSH:$LWS_APP_DIR…"
# --delete : retire les fichiers d'un build précédent (empreintes de .next/static), sans toucher
# aux fichiers propres au serveur (.htaccess, tmp/ de Passenger, journaux).
rsync -az --delete --human-readable --info=stats1 \
  --exclude='.htaccess' --exclude='tmp/' --exclude='*.log' --exclude='.env*' \
  -e "ssh -p $port" "$root/dist/lws/app/" "$LWS_SSH:$LWS_APP_DIR/"

echo "▸ Redémarrage (Passenger)…"
ssh -p "$port" "$LWS_SSH" "mkdir -p '$LWS_APP_DIR/tmp' && touch '$LWS_APP_DIR/tmp/restart.txt'"
echo "✔ Déployé. Vérifiez : curl -fsS https://votre-domaine.fr/api/health"
