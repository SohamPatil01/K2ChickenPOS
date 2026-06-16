#!/usr/bin/env bash
# Diagnose and optionally clean Supabase disk usage via production API.
# Safe default: dry-run only. Set APPLY=1 to delete prunable rows.
set -euo pipefail

API_URL="${API_URL:-https://k2-chicken-pos-api.vercel.app}"
APPLY="${APPLY:-0}"

auth_args=(-H "Content-Type: application/json")
if [ -n "${BACKUP_SECRET:-}" ]; then
  auth_args+=(-H "X-Backup-Secret: $BACKUP_SECRET")
else
  auth_args+=(-H "x-vercel-cron: 1")
fi

echo "=== Supabase storage diagnostics ==="
echo "API: $API_URL"
echo

DIAG=$(curl -s "${API_URL}/api/v1/backup/storage-diagnostics" "${auth_args[@]}")
echo "$DIAG" | jq '.'

if [ "$APPLY" != "1" ]; then
  echo
  echo "Dry-run cleanup plan (no changes):"
  curl -s -X POST "${API_URL}/api/v1/backup/storage-cleanup" \
    "${auth_args[@]}" \
    -d '{"dryRun":true,"vacuum":false}' | jq '.'
  echo
  echo "To apply cleanup: APPLY=1 ./scripts/supabase-storage-cleanup.sh"
  echo "To also VACUUM ANALYZE tables: APPLY=1 VACUUM=1 ./scripts/supabase-storage-cleanup.sh"
  exit 0
fi

BODY='{"dryRun":false,"stripBase64Images":true,"pruneSyncEventsDays":14,"pruneAuditLogDays":180,"vacuum":false}'
if [ "${VACUUM:-0}" = "1" ]; then
  BODY='{"dryRun":false,"stripBase64Images":true,"pruneSyncEventsDays":14,"pruneAuditLogDays":180,"vacuum":true}'
fi

echo
echo "=== Applying storage cleanup ==="
curl -s -X POST "${API_URL}/api/v1/backup/storage-cleanup" \
  "${auth_args[@]}" \
  -d "$BODY" | jq '.'

echo
echo "=== Post-cleanup diagnostics ==="
curl -s "${API_URL}/api/v1/backup/storage-diagnostics" "${auth_args[@]}" | jq '.database, .largeFields, .recommendations'

echo
echo "If Supabase disk is still high, open Supabase SQL editor and run:"
echo "  VACUUM (VERBOSE, ANALYZE);"
