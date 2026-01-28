#!/bin/bash

# Helper script to apply sinkage migration to production
# This will guide you through getting DATABASE_URL and running the migration

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================="
echo "Production Migration Helper"
echo "==========================================${NC}"
echo ""

echo -e "${YELLOW}To apply the migration, we need your production DATABASE_URL${NC}"
echo ""
echo "You can get it from Vercel in one of these ways:"
echo ""
echo "Option 1: Vercel Dashboard (Easiest)"
echo "  1. Go to: https://vercel.com/sohams-projects-cd6fc827/k2-chicken-pos-api/settings/environment-variables"
echo "  2. Find DATABASE_URL in the Production environment"
echo "  3. Copy the value"
echo ""
echo "Option 2: Vercel CLI (if installed)"
echo "  vercel env pull"
echo "  # Then check .env.local for DATABASE_URL"
echo ""
echo "Option 3: Direct Database Connection"
echo "  If you have direct access to your PostgreSQL database,"
echo "  use that connection string"
echo ""

read -p "Do you have the DATABASE_URL ready? (y/n): " ready

if [ "$ready" != "y" ] && [ "$ready" != "Y" ]; then
    echo ""
    echo "Please get your DATABASE_URL from Vercel and run this script again."
    echo "Or run the migration manually:"
    echo "  export DATABASE_URL='your-database-url'"
    echo "  ./scripts/apply-sinkage-migration-production.sh"
    exit 0
fi

echo ""
echo -e "${YELLOW}Please paste your DATABASE_URL below:${NC}"
echo "(It will start with 'postgresql://' or 'postgres://')"
read -sp "DATABASE_URL: " DATABASE_URL
echo ""

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL is empty${NC}"
    exit 1
fi

# Validate it looks like a database URL
if [[ ! "$DATABASE_URL" =~ ^postgres ]]; then
    echo -e "${YELLOW}Warning: DATABASE_URL doesn't start with 'postgres'${NC}"
    echo "Are you sure this is correct? (y/n)"
    read -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}Setting DATABASE_URL and running migration...${NC}"
echo ""

export DATABASE_URL
./scripts/apply-sinkage-migration-production.sh

