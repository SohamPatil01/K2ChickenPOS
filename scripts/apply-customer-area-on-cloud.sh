#!/usr/bin/env bash
# Apply Customer.area migration on production via the API (DDL only — no deletes).
set -euo pipefail

API_URL="${API_URL:-https://k2-chicken-pos-api.vercel.app}"

auth_header() {
  if [ -n "${BACKUP_SECRET:-}" ]; then
    echo "X-Backup-Secret: $BACKUP_SECRET"
  else
    echo "x-vercel-cron: 1"
  fi
}

echo "Applying Customer.area migration on $API_URL ..."
RESP=$(curl -s -X POST "${API_URL}/api/v1/backup/apply-customer-area-column" \
  -H "Content-Type: application/json" \
  -H "$(auth_header)")

echo "$RESP" | jq '.' 2>/dev/null || echo "$RESP"

if ! echo "$RESP" | grep -q '"success":true'; then
  exit 1
fi

echo ""
echo "Verifying /api/v1/sales ..."
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/sales?limit=5")
echo "Sales API HTTP $HTTP"
[ "$HTTP" = "200" ]
