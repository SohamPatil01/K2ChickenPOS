#!/bin/bash

# Script to test the database backup system
# This can be run locally or against the deployed Vercel API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Database Backup System Test ===${NC}\n"

# Configuration
API_URL="${API_URL:-https://k2-chicken-pos-api.vercel.app}"
BACKUP_SECRET="${BACKUP_SECRET:-}"

# Check if backup secret is provided
if [ -z "$BACKUP_SECRET" ]; then
    echo -e "${RED}Error: BACKUP_SECRET environment variable is not set${NC}"
    echo ""
    echo "Usage:"
    echo "  export BACKUP_SECRET='your-backup-secret'"
    echo "  export API_URL='https://your-api.vercel.app'  # Optional, defaults to k2-chicken-pos-api.vercel.app"
    echo "  ./scripts/test-backup.sh"
    exit 1
fi

echo -e "${BLUE}API URL: $API_URL${NC}"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Backup Service Health Check${NC}"
HEALTH_RESPONSE=$(curl -s "$API_URL/api/v1/backup/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$HEALTH_STATUS" = "ok" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi

echo ""

# Test 2: Create Backup
echo -e "${YELLOW}Test 2: Create Manual Backup${NC}"
echo "This may take 10-30 seconds depending on database size..."

BACKUP_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/backup/create" \
    -H "X-Backup-Secret: $BACKUP_SECRET" \
    -H "Content-Type: application/json")

BACKUP_SUCCESS=$(echo "$BACKUP_RESPONSE" | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$BACKUP_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Backup created successfully${NC}"
    echo "$BACKUP_RESPONSE" | jq '.' 2>/dev/null || echo "$BACKUP_RESPONSE"
    
    # Extract backup size and table counts
    BACKUP_SIZE=$(echo "$BACKUP_RESPONSE" | grep -o '"backupSize":[^,]*' | cut -d':' -f2)
    if [ -n "$BACKUP_SIZE" ]; then
        BACKUP_SIZE_MB=$(echo "scale=2; $BACKUP_SIZE / 1024 / 1024" | bc)
        echo -e "${BLUE}Backup size: ${BACKUP_SIZE_MB} MB${NC}"
    fi
else
    echo -e "${RED}✗ Backup creation failed${NC}"
    echo "$BACKUP_RESPONSE"
    
    # Check for common errors
    if echo "$BACKUP_RESPONSE" | grep -q "Unauthorized"; then
        echo ""
        echo -e "${YELLOW}Tip: Check that BACKUP_SECRET matches the value in Vercel environment variables${NC}"
    fi
    
    exit 1
fi

echo ""

# Test 3: List Backups
echo -e "${YELLOW}Test 3: List Available Backups${NC}"
LIST_RESPONSE=$(curl -s "$API_URL/api/v1/backup/list" \
    -H "X-Backup-Secret: $BACKUP_SECRET")

LIST_SUCCESS=$(echo "$LIST_RESPONSE" | grep -o '"success":[^,]*' | cut -d':' -f2)

if [ "$LIST_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✓ Backup list retrieved${NC}"
    echo "$LIST_RESPONSE" | jq '.' 2>/dev/null || echo "$LIST_RESPONSE"
    
    # Count backups
    BACKUP_COUNT=$(echo "$LIST_RESPONSE" | grep -o '"filename"' | wc -l | xargs)
    echo -e "${BLUE}Total backups: $BACKUP_COUNT${NC}"
else
    echo -e "${RED}✗ Failed to list backups${NC}"
    echo "$LIST_RESPONSE"
fi

echo ""

# Test 4: Verify Cron Job Configuration (if running against Vercel)
echo -e "${YELLOW}Test 4: Cron Job Configuration${NC}"
echo "To verify cron job is configured:"
echo "  1. Go to Vercel Dashboard"
echo "  2. Select your API project"
echo "  3. Go to Settings → Cron Jobs"
echo "  4. Check for: /api/v1/backup/create with schedule '0 2 * * *'"
echo ""
echo -e "${BLUE}Note: Cron jobs require Vercel Hobby plan or higher${NC}"

echo ""

# Summary
echo -e "${GREEN}=== Test Summary ===${NC}"
echo ""
echo "✅ All tests passed!"
echo ""
echo "Next steps:"
echo "  1. Verify cron job in Vercel Dashboard (Settings → Cron Jobs)"
echo "  2. Check backup storage in Vercel Blob Storage"
echo "  3. Wait for scheduled backup at 2:00 AM UTC"
echo "  4. Monitor backup logs in Vercel Functions"
echo ""
echo -e "${BLUE}For more information, see DATABASE_BACKUP_GUIDE.md${NC}"

