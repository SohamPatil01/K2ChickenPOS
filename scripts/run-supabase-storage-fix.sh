#!/usr/bin/env bash
# Run supabase-storage-fix.sql against your Supabase Postgres (includes VACUUM).
#
# Get the URI from Supabase → Project Settings → Database → Connection string → URI
# Use port 5432 (direct/session), NOT 6543 transaction pooler, for VACUUM.
#
#   export DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
#   ./scripts/run-supabase-storage-fix.sh
#
# Do NOT commit DATABASE_URL or paste passwords into chat.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="${ROOT}/scripts/supabase-storage-fix.sql"

if [ -f "${ROOT}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

DB_URL="${SUPABASE_DATABASE_URL:-${DATABASE_URL:-}}"

if [ -z "$DB_URL" ]; then
  echo "Error: set DATABASE_URL or SUPABASE_DATABASE_URL (Supabase URI, port 5432)."
  echo ""
  echo "Project dashboard: https://vkhworlflayiqinqknnk.supabase.co"
  echo "Settings → Database → Connection string → URI (copy password from same page)"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql not found. Install PostgreSQL client (brew install libpq)."
  exit 1
fi

echo "=== Testing connection ==="
psql "$DB_URL" -c "SELECT current_database(), pg_size_pretty(pg_database_size(current_database())) AS size;"

echo ""
echo "=== Running storage fix SQL ==="
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"

echo ""
echo "=== After cleanup ==="
psql "$DB_URL" -c "
  SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;
  SELECT pg_size_pretty(COALESCE((SELECT SUM(size) FROM pg_ls_waldir()), 0)::bigint) AS wal_size;
"
