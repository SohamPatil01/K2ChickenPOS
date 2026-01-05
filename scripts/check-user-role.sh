#!/bin/bash

# Script to check and update user role to OWNER
# Usage: ./scripts/check-user-role.sh [user-email-or-phone]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set!${NC}"
    echo "Please set it: export DATABASE_URL='your-database-url'"
    exit 1
fi

echo -e "${BLUE}=== User Role Checker ===${NC}\n"

# Check if user identifier provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Listing all users:${NC}\n"
    psql "$DATABASE_URL" -c "SELECT id, name, email, phone, role, \"storeId\" FROM \"User\" ORDER BY role, name;"
    echo ""
    echo -e "${YELLOW}To update a user's role, run:${NC}"
    echo -e "${BLUE}./scripts/check-user-role.sh [email-or-phone]${NC}"
    exit 0
fi

USER_IDENTIFIER="$1"

echo -e "${YELLOW}Searching for user: ${USER_IDENTIFIER}${NC}\n"

# Check if it's an email or phone
if [[ "$USER_IDENTIFIER" == *"@"* ]]; then
    WHERE_CLAUSE="email = '$USER_IDENTIFIER'"
else
    WHERE_CLAUSE="phone = '$USER_IDENTIFIER'"
fi

# Get user info
USER_INFO=$(psql "$DATABASE_URL" -t -c "SELECT id, name, email, phone, role, \"storeId\" FROM \"User\" WHERE $WHERE_CLAUSE;")

if [ -z "$USER_INFO" ]; then
    echo -e "${RED}User not found!${NC}"
    exit 1
fi

echo -e "${GREEN}Found user:${NC}"
echo "$USER_INFO" | awk '{printf "  ID: %s\n  Name: %s\n  Email: %s\n  Phone: %s\n  Role: %s\n  Store ID: %s\n", $1, $2, $3, $4, $5, $6}'

USER_ID=$(echo "$USER_INFO" | awk '{print $1}')
CURRENT_ROLE=$(echo "$USER_INFO" | awk '{print $5}')

echo ""
if [ "$CURRENT_ROLE" = "OWNER" ]; then
    echo -e "${GREEN}✓ User already has OWNER role${NC}"
else
    echo -e "${YELLOW}Current role: ${CURRENT_ROLE}${NC}"
    echo -e "${YELLOW}Updating to OWNER role...${NC}"
    
    psql "$DATABASE_URL" -c "UPDATE \"User\" SET role = 'OWNER' WHERE id = '$USER_ID';"
    
    echo -e "${GREEN}✓ User role updated to OWNER${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Clear browser localStorage (F12 → Application → Clear Storage)"
    echo "2. Refresh the page"
    echo "3. Login again"
    echo "4. You should now be redirected to /hq"
fi

