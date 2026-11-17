#!/usr/bin/env bash
# Restauration d'une sauvegarde produite par scripts/backup-db.sh dans une base cible VIDE
# (nouveau projet Supabase, ou base temporaire de test). Ne restaure jamais par-dessus des données.
#
#   TARGET_DATABASE_URL='postgresql://…' scripts/restore-db.sh <dossier> <horodatage>
#   ex. : scripts/restore-db.sh ./backups 20261117T075752Z
#
# Étapes : contrôle des empreintes → structure et données de public/private/supabase_migrations →
# données de auth (comptes) → index, contraintes, RLS → déclencheurs de l'application sur auth.
# Les fichiers chiffrés (.gpg) sont déchiffrés à la volée dans un dossier temporaire supprimé à la fin.
set -euo pipefail

: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL est requis (base cible, vide).}"
dir="${1:?Dossier de sauvegarde requis.}"
stamp="${2:?Horodatage requis (ex. 20261117T075752Z).}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
PSQL="${PSQL:-psql}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
(cd "$dir" && sha256sum -c "happi-$stamp.sha256")
for part in app.dump auth.dump auth-triggers.sql; do
  src="$dir/happi-$stamp-$part"
  if [ -f "$src.gpg" ]; then gpg --batch --quiet --decrypt --output "$work/$part" "$src.gpg"; else cp "$src" "$work/$part"; fi
done

existing="$("$PSQL" "$TARGET_DATABASE_URL" -X -At -c "select count(*) from pg_tables where schemaname in ('public', 'private')")"
if [ "$existing" != "0" ]; then
  echo "✖ La base cible contient déjà $existing table(s) dans public/private : restauration refusée." >&2
  exit 1
fi

# Le schéma public existe déjà sur toute base PostgreSQL / Supabase : on n'en rejoue pas la création,
# ni les droits par défaut des rôles internes de Supabase (déjà posés, non modifiables par postgres).
"$PG_RESTORE" -l "$work/app.dump" | grep -v -e ' SCHEMA - public ' -e 'DEFAULT ACL .* supabase_admin$' > "$work/app.list"
restore_app() { "$PG_RESTORE" --dbname="$TARGET_DATABASE_URL" --no-owner --exit-on-error --use-list="$work/app.list" "$@" "$work/app.dump"; }

echo "▸ Application : structure (tables, fonctions, droits)…"
restore_app --section=pre-data
echo "▸ Application : données…"
restore_app --section=data

echo "▸ Comptes (données de auth)…"
# Avant les contraintes de l'application (profiles.id → auth.users.id). Mode réplica : aucun
# déclencheur ne rejoue (méthode admise par Supabase pour le rôle postgres, non propriétaire de auth).
{ echo 'SET session_replication_role = replica;'; "$PG_RESTORE" --data-only --no-owner --file=- "$work/auth.dump"; } \
  | "$PSQL" "$TARGET_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction

echo "▸ Application : index, contraintes, déclencheurs, politiques RLS…"
restore_app --section=post-data

echo "▸ Déclencheurs de l'application sur auth…"
"$PSQL" "$TARGET_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -f "$work/auth-triggers.sql"

"$PSQL" "$TARGET_DATABASE_URL" -X -q -c "notify pgrst, 'reload schema';" || true
echo "✔ Restauration terminée. Vérifiez : select count(*) from public.skills; (34 attendu) et une connexion de test."
