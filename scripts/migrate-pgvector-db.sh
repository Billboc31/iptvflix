#!/usr/bin/env bash
# T112 — Production migration: current PostgreSQL DB → new pgvector-capable DB
#
# Prerequisites:
#   pg_dump and pg_restore on PATH (postgres 16 client tools)
#   CURRENT_DB_URL — connection string for the existing production DB (source)
#   NEW_DB_URL     — connection string for the new pgvector DB (destination, currently empty)
#
# This script is SAFE: it never drops the source DB and never overwrites data
# without explicit confirmation. The destination must be empty at the start.
#
# Usage:
#   CURRENT_DB_URL=<url> NEW_DB_URL=<url> ./scripts/migrate-pgvector-db.sh
#
# Outputs:
#   /tmp/iptvflix-backup-<timestamp>.dump  — verified pg_dump backup
set -euo pipefail

: "${CURRENT_DB_URL:?CURRENT_DB_URL must be set}"
: "${NEW_DB_URL:?NEW_DB_URL must be set}"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP_FILE="/tmp/iptvflix-backup-${TIMESTAMP}.dump"

# ---------------------------------------------------------------------------
# Step 1: Verify we are NOT pointing both URLs at the same DB
# ---------------------------------------------------------------------------
echo "[migrate] Checking URLs are distinct..."
if [ "$CURRENT_DB_URL" = "$NEW_DB_URL" ]; then
  echo "[migrate] ERROR: CURRENT_DB_URL and NEW_DB_URL are identical — aborting."
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 2: Pre-flight row count on source DB (must have data)
# ---------------------------------------------------------------------------
echo "[migrate] Source DB row count check..."
MOVIE_COUNT=$(psql "$CURRENT_DB_URL" -t -c "SELECT count(*) FROM movies" 2>/dev/null | tr -d ' ' || echo "0")
if [ "$MOVIE_COUNT" = "0" ] || [ -z "$MOVIE_COUNT" ]; then
  echo "[migrate] ERROR: source DB has 0 movies — aborting to prevent restore of empty DB."
  exit 1
fi
echo "[migrate] Source DB: movies=${MOVIE_COUNT}"

# ---------------------------------------------------------------------------
# Step 3: Verify destination DB is empty (no movies table or 0 rows)
# ---------------------------------------------------------------------------
echo "[migrate] Destination DB empty check..."
DEST_MOVIE_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT count(*) FROM movies" 2>/dev/null | tr -d ' ' || echo "0")
if [ "${DEST_MOVIE_COUNT:-0}" -gt "0" ] 2>/dev/null; then
  echo "[migrate] WARNING: destination DB already has ${DEST_MOVIE_COUNT} movies."
  read -r -p "[migrate] Destination is NOT empty. Continue anyway? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "[migrate] Aborted by user."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Step 4: pg_dump from source
# ---------------------------------------------------------------------------
echo "[migrate] Dumping source DB to ${DUMP_FILE} ..."
pg_dump \
  --no-privileges \
  --no-owner \
  --format=custom \
  --file="${DUMP_FILE}" \
  "$CURRENT_DB_URL"

echo "[migrate] Dump complete: $(du -sh "${DUMP_FILE}" | cut -f1)"

# ---------------------------------------------------------------------------
# Step 5: Verify dump integrity
# ---------------------------------------------------------------------------
echo "[migrate] Verifying dump integrity (pg_restore --list)..."
pg_restore --list "${DUMP_FILE}" > /dev/null
echo "[migrate] Dump verified OK."

# ---------------------------------------------------------------------------
# Step 6: pg_restore into destination
# ---------------------------------------------------------------------------
echo "[migrate] Restoring to destination DB..."
pg_restore \
  --no-privileges \
  --no-owner \
  --clean \
  --if-exists \
  --exit-on-error \
  --dbname="${NEW_DB_URL}" \
  "${DUMP_FILE}"

echo "[migrate] Restore complete."

# ---------------------------------------------------------------------------
# Step 7: Validate row counts match
# ---------------------------------------------------------------------------
echo "[migrate] Validating row counts..."

TABLES=(movies series profiles user_watch_progress my_list media_sources media_embeddings)
ALL_OK=true

for TABLE in "${TABLES[@]}"; do
  SRC=$(psql "$CURRENT_DB_URL" -t -c "SELECT count(*) FROM ${TABLE}" 2>/dev/null | tr -d ' ' || echo "N/A")
  DST=$(psql "$NEW_DB_URL"     -t -c "SELECT count(*) FROM ${TABLE}" 2>/dev/null | tr -d ' ' || echo "N/A")
  STATUS="OK"
  if [ "$SRC" != "$DST" ]; then
    STATUS="MISMATCH"
    ALL_OK=false
  fi
  printf "  %-24s src=%-8s dst=%-8s %s\n" "${TABLE}" "${SRC}" "${DST}" "${STATUS}"
done

echo ""
if [ "$ALL_OK" = "true" ]; then
  echo "[migrate] All row counts match. Backup at: ${DUMP_FILE}"
  echo "[migrate] NEXT STEP: Apply migrations and activate pgvector on the new DB:"
  echo "  DATABASE_URL=\$NEW_DB_URL node apps/api/scripts/migrate-safe.mjs"
  echo ""
  echo "[migrate] Then update DATABASE_URL in Railway to \$NEW_DB_URL and deploy."
else
  echo "[migrate] ERROR: Row count mismatch detected — investigate before cutover."
  echo "[migrate] Backup preserved at: ${DUMP_FILE}"
  exit 1
fi
