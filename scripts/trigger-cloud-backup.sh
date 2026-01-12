#!/bin/bash

# Script to trigger a cloud backup on Vercel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Trigger Cloud Backup ===${NC}\n"

# Get API URL
API_URL="${API_URL:-https://k2-chicken-pos-api.vercel.app}"

# Get BACKUP_SECRET from environment or prompt
if [ -z "$BACKUP_SECRET" ]; then
    echo -e "${YELLOW}BACKUP_SECRET not found in environment.${NC}"
    echo -e "${BLUE}You can:${NC}"
    echo -e "  1. Export it: export BACKUP_SECRET='your-secret'"
    echo -e "  2. Or get it from: Vercel Dashboard → Project → Settings → Environment Variables"
    echo ""
    read -sp "Enter BACKUP_SECRET (or press Ctrl+C to cancel): " BACKUP_SECRET
    echo ""
fi

if [ -z "$BACKUP_SECRET" ]; then
    echo -e "${RED}Error: BACKUP_SECRET is required${NC}"
    exit 1
fi

echo -e "${BLUE}Triggering backup on: ${API_URL}${NC}\n"
echo -e "${YELLOW}Please wait...${NC}\n"

# Trigger backup
RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/backup/create" \
    -H "X-Backup-Secret: ${BACKUP_SECRET}" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")

# Extract HTTP status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

# Check result
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Backup triggered successfully!${NC}\n"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${RED}✗ Backup failed (HTTP $HTTP_STATUS)${NC}\n"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Backup Complete ===${NC}"
echo -e "${BLUE}Check Vercel Blob Storage or your configured storage for the backup file.${NC}"


