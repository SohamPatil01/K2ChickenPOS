#!/usr/bin/env bash
# Native PostgreSQL dump for migrating off Supabase (schema + data + enums).
# Requires non-pooling DATABASE_URL or SUPABASE_DATABASE_URL (port 5432).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUPS_DIR="${BACKUPS_DIR:-$ROOT/backups}"
mkdir -p "$BACKUPS_DIR"

DB_URL="${SUPABASE_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "Error: set SUPABASE_DATABASE_URL or DATABASE_URL (non-pooling, port 5432)."
  echo "  Supabase → Settings → Database → Connection string → URI (not pooler 6543)"
  exit 1
fi

if echo "$DB_URL" | grep -q ':6543/'; then
  echo "Warning: URL uses port 6543 (pooler). pg_dump needs direct port 5432."
fi

TS=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
OUT_SQL="${BACKUPS_DIR}/pg_dump_${TS}.sql"
OUT_CUSTOM="${BACKUPS_DIR}/pg_dump_${TS}.dump"

echo "=== PostgreSQL full dump ==="
echo "Output: $OUT_SQL"
echo "Custom: $OUT_CUSTOM"

pg_dump "$DB_URL" \
  --no-owner \
  --no-acl \
  --format=plain \
  --file="$OUT_SQL"

pg_dump "$DB_URL" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file="$OUT_CUSTOM"

echo "Done."
echo "  SQL:    $OUT_SQL ($(du -h "$OUT_SQL" | cut -f1))"
echo "  Custom: $OUT_CUSTOM ($(du -h "$OUT_CUSTOM" | cut -f1))"
echo ""
echo "Restore on new host:"
echo "  psql \"\$NEW_DATABASE_URL\" -f \"$OUT_SQL\""
echo "  # or: pg_restore --no-owner --no-acl -d \"\$NEW_DATABASE_URL\" \"$OUT_CUSTOM\""
