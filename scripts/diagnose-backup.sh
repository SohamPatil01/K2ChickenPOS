#!/bin/bash

# Script to diagnose automatic backup issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Automatic Backup Diagnostic Tool ===${NC}\n"

# Get API URL from environment or use default
API_URL="${API_URL:-https://k2-chicken-pos-api.vercel.app}"

echo -e "${BLUE}Testing API: ${API_URL}${NC}\n"

# Step 1: Test health endpoint
echo -e "${YELLOW}Step 1: Testing backup health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "${API_URL}/api/v1/backup/health" || echo "ERROR")
if [[ "$HEALTH_RESPONSE" == *"ok"* ]] || [[ "$HEALTH_RESPONSE" == *"connected"* ]]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "$HEALTH_RESPONSE"
fi
echo ""

# Step 2: Test cron detection endpoint
echo -e "${YELLOW}Step 2: Testing cron detection endpoint...${NC}"
CRON_TEST_RESPONSE=$(curl -s "${API_URL}/api/v1/backup/test-cron" || echo "ERROR")
if [[ "$CRON_TEST_RESPONSE" == *"success"* ]]; then
    echo -e "${GREEN}✓ Cron test endpoint accessible${NC}"
    echo "$CRON_TEST_RESPONSE" | jq '.cronDetection' 2>/dev/null || echo "$CRON_TEST_RESPONSE"
else
    echo -e "${RED}✗ Cron test endpoint failed${NC}"
    echo "$CRON_TEST_RESPONSE"
fi
echo ""

# Step 3: Check vercel.json configuration
echo -e "${YELLOW}Step 3: Checking vercel.json configuration...${NC}"
if [ -f "apps/api/vercel.json" ]; then
    echo -e "${GREEN}✓ vercel.json found${NC}"
    CRON_CONFIG=$(cat apps/api/vercel.json | jq '.crons' 2>/dev/null || echo "[]")
    if [[ "$CRON_CONFIG" != "[]" ]] && [[ "$CRON_CONFIG" != "null" ]]; then
        echo -e "${GREEN}✓ Cron jobs configured:${NC}"
        echo "$CRON_CONFIG" | jq '.'
    else
        echo -e "${RED}✗ No cron jobs configured in vercel.json${NC}"
    fi
else
    echo -e "${RED}✗ vercel.json not found${NC}"
fi
echo ""

# Step 4: Check environment variables (local check)
echo -e "${YELLOW}Step 4: Checking local environment variables...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file found${NC}"
    if grep -q "BACKUP_SECRET" .env; then
        echo -e "${GREEN}✓ BACKUP_SECRET is set${NC}"
    else
        echo -e "${YELLOW}⚠ BACKUP_SECRET not found in .env (may be set in Vercel)${NC}"
    fi
    if grep -q "BACKUP_STORAGE_METHOD" .env; then
        echo -e "${GREEN}✓ BACKUP_STORAGE_METHOD is set${NC}"
        grep "BACKUP_STORAGE_METHOD" .env | sed 's/=.*/=***/'
    else
        echo -e "${YELLOW}⚠ BACKUP_STORAGE_METHOD not found (will default to vercel-blob)${NC}"
    fi
    if grep -q "BLOB_READ_WRITE_TOKEN" .env; then
        echo -e "${GREEN}✓ BLOB_READ_WRITE_TOKEN is set${NC}"
    else
        echo -e "${YELLOW}⚠ BLOB_READ_WRITE_TOKEN not found in .env (may be set in Vercel)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ .env file not found (environment variables may be set in Vercel)${NC}"
fi
echo ""

# Step 5: Test manual backup (if BACKUP_SECRET is available)
if [ -n "$BACKUP_SECRET" ]; then
    echo -e "${YELLOW}Step 5: Testing manual backup trigger...${NC}"
    BACKUP_RESPONSE=$(curl -s -X POST "${API_URL}/api/v1/backup/create" \
        -H "X-Backup-Secret: ${BACKUP_SECRET}" \
        -H "Content-Type: application/json" || echo "ERROR")
    if [[ "$BACKUP_RESPONSE" == *"success"* ]] && [[ "$BACKUP_RESPONSE" == *"true"* ]]; then
        echo -e "${GREEN}✓ Manual backup test successful${NC}"
        echo "$BACKUP_RESPONSE" | jq '.' 2>/dev/null || echo "$BACKUP_RESPONSE"
    else
        echo -e "${RED}✗ Manual backup test failed${NC}"
        echo "$BACKUP_RESPONSE"
    fi
else
    echo -e "${YELLOW}Step 5: Skipping manual backup test (BACKUP_SECRET not set)${NC}"
    echo -e "${BLUE}   To test manually, run:${NC}"
    echo -e "${BLUE}   curl -X POST ${API_URL}/api/v1/backup/create -H \"X-Backup-Secret: your-secret\"${NC}"
fi
echo ""

# Step 6: Recommendations
echo -e "${YELLOW}=== Recommendations ===${NC}\n"
echo -e "${BLUE}1. Verify Cron Job in Vercel Dashboard:${NC}"
echo -e "   - Go to: https://vercel.com/dashboard"
echo -e "   - Select your project → Settings → Cron Jobs"
echo -e "   - Verify cron job exists and is Active"
echo -e "   - Check last execution time and logs"
echo ""
echo -e "${BLUE}2. Check Vercel Environment Variables:${NC}"
echo -e "   - Go to: Project Settings → Environment Variables"
echo -e "   - Verify these are set:"
echo -e "     * BACKUP_SECRET (optional but recommended)"
echo -e "     * BACKUP_STORAGE_METHOD (defaults to vercel-blob)"
echo -e "     * BLOB_READ_WRITE_TOKEN (if using vercel-blob)"
echo -e "     * DATABASE_URL"
echo ""
echo -e "${BLUE}3. Check Vercel Function Logs:${NC}"
echo -e "   - Go to: Project → Deployments → Latest → Functions"
echo -e "   - Look for /api/v1/backup/create"
echo -e "   - Check for errors or authentication failures"
echo ""
echo -e "${BLUE}4. Verify Vercel Plan:${NC}"
echo -e "   - Cron jobs require Hobby plan ($20/month) or higher"
echo -e "   - Free plan does not support cron jobs"
echo ""
echo -e "${BLUE}5. Test Cron Job Manually:${NC}"
echo -e "   - Use the test-cron endpoint to see what headers Vercel sends:"
echo -e "   - curl ${API_URL}/api/v1/backup/test-cron"
echo ""
echo -e "${GREEN}=== Diagnostic Complete ===${NC}\n"



