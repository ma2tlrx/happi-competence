#!/usr/bin/env bash
# Sauvegarde logique de la base HAPPI Compétence (en plus des sauvegardes de Supabase).
#
#   DATABASE_URL='postgresql://…' scripts/backup-db.sh
#
# Variables :
#   DATABASE_URL          chaîne de connexion (obligatoire ; jamais écrite dans le dépôt ni affichée)
#                         Supabase : Project Settings → Database → Connection string (« Session pooler », port 5432)
#   BACKUP_DIR            dossier de destination (défaut : ./backups, à placer hors du dépôt)
#   RETENTION_DAYS        durée de conservation locale des sauvegardes (défaut : 35 jours)
#   BACKUP_GPG_RECIPIENT  si défini, chiffre chaque fichier pour cette clé GPG (recommandé :
#                         les sauvegardes contiennent des données personnelles)
#   PG_DUMP / PSQL        binaires à utiliser (défaut : pg_dump / psql ; version 17 au moins)
#
# Produit, horodatés (UTC) :
#   happi-<date>-app.dump   schémas public, private et supabase_migrations : structure, droits, RLS, données
#   happi-<date>-auth.dump  données du schéma auth (comptes, identités, facteurs MFA), sans sa structure
#                           (fournie par Supabase sur le projet cible)
#   happi-<date>-auth-triggers.sql  déclencheurs de l'application posés sur les tables de auth
#   happi-<date>.sha256     empreintes de contrôle
# Restauration : docs/exploitation.md, section « Restauration ».
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL est requis (chaîne de connexion PostgreSQL).}"
PG_DUMP="${PG_DUMP:-pg_dump}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-35}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

command -v "$PG_DUMP" >/dev/null || { echo "✖ $PG_DUMP introuvable (paquet postgresql-client-17)." >&2; exit 1; }
major="$("$PG_DUMP" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
if [ "$major" -lt 17 ]; then echo "✖ pg_dump $major : la version 17 au moins est requise (serveur PostgreSQL 17)." >&2; exit 1; fi

umask 077
mkdir -p "$BACKUP_DIR"
app="$BACKUP_DIR/happi-$STAMP-app.dump"
auth="$BACKUP_DIR/happi-$STAMP-auth.dump"

echo "▸ Sauvegarde de l'application (public, private, supabase_migrations)…"
"$PG_DUMP" "$DATABASE_URL" --format=custom --compress=6 --no-owner \
  --schema=public --schema=private --schema=supabase_migrations --file="$app"

echo "▸ Sauvegarde des comptes (données du schéma auth)…"
# auth.schema_migrations appartient au service d'authentification de Supabase (déjà rempli sur la cible).
"$PG_DUMP" "$DATABASE_URL" --format=custom --compress=6 --no-owner --data-only --schema=auth \
  --exclude-table=auth.schema_migrations --file="$auth"

# Déclencheurs posés par les migrations sur les tables de auth (création de profil, audit MFA) :
# ils appartiennent au schéma auth et ne figurent donc dans aucun des deux fichiers précédents.
triggers="$BACKUP_DIR/happi-$STAMP-auth-triggers.sql"
PSQL="${PSQL:-psql}"
"$PSQL" "$DATABASE_URL" -X -At -v ON_ERROR_STOP=1 -c "select pg_get_triggerdef(t.oid) || ';' from pg_trigger t
  join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid join pg_namespace pn on pn.oid = p.pronamespace
  where not t.tgisinternal and n.nspname = 'auth' and pn.nspname in ('public', 'private') order by t.tgname" > "$triggers"

files=("$app" "$auth" "$triggers")
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "▸ Chiffrement GPG…"
  for f in "${files[@]}"; do gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$f.gpg" "$f" && rm -f "$f"; done
  files=("$app.gpg" "$auth.gpg" "$triggers.gpg")
fi

(cd "$BACKUP_DIR" && sha256sum "${files[@]##*/}" > "happi-$STAMP.sha256")

echo "▸ Purge des sauvegardes de plus de $RETENTION_DAYS jours…"
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'happi-*' -mtime +"$RETENTION_DAYS" -delete

ls -l "${files[@]}"
echo "✔ Sauvegarde terminée : $BACKUP_DIR (happi-$STAMP-*)"
