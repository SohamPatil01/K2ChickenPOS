#!/bin/bash

# Script to verify that a migration is safe (doesn't delete data)
# Usage: ./scripts/verify-migration-safety.sh [migration_file_path]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${RED}Error: Migration file path required!${NC}"
    echo "Usage: $0 [migration_file_path]"
    echo "Example: $0 packages/db/prisma/migrations/20240101_add_feature/migration.sql"
    exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}Error: Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}=== Migration Safety Check ===${NC}\n"
echo -e "Checking: ${YELLOW}$MIGRATION_FILE${NC}\n"

# Dangerous SQL patterns
DANGEROUS_PATTERNS=(
    "DROP TABLE"
    "TRUNCATE TABLE"
    "DELETE FROM"
    "DROP COLUMN"
    "DROP INDEX.*ON"
)

SAFE=true
ISSUES=()

# Check for dangerous patterns
for pattern in "${DANGEROUS_PATTERNS[@]}"; do
    if grep -qi "$pattern" "$MIGRATION_FILE"; then
        SAFE=false
        LINE_NUM=$(grep -ni "$pattern" "$MIGRATION_FILE" | head -1 | cut -d: -f1)
        ISSUES+=("Line $LINE_NUM: Contains '$pattern'")
    fi
done

# Check for safe patterns
SAFE_PATTERNS=(
    "CREATE TABLE"
    "ALTER TABLE.*ADD"
    "CREATE INDEX"
    "CREATE UNIQUE INDEX"
)

SAFE_COUNT=0
for pattern in "${SAFE_PATTERNS[@]}"; do
    if grep -qi "$pattern" "$MIGRATION_FILE"; then
        COUNT=$(grep -ci "$pattern" "$MIGRATION_FILE" || echo "0")
        SAFE_COUNT=$((SAFE_COUNT + COUNT))
    fi
done

# Display results
if [ "$SAFE" = true ]; then
    echo -e "${GREEN}✓ Migration appears SAFE${NC}"
    echo -e "  Found $SAFE_COUNT safe operations\n"
    
    echo -e "${BLUE}Safe operations detected:${NC}"
    for pattern in "${SAFE_PATTERNS[@]}"; do
        if grep -qi "$pattern" "$MIGRATION_FILE"; then
            echo -e "  ${GREEN}✓${NC} $pattern"
        fi
    done
    echo ""
else
    echo -e "${RED}⚠ WARNING: Migration contains potentially dangerous operations!${NC}\n"
    
    echo -e "${RED}Issues found:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo -e "  ${RED}✗${NC} $issue"
    done
    echo ""
    
    echo -e "${YELLOW}⚠ Review the migration carefully before deploying!${NC}"
    echo -e "${YELLOW}⚠ Consider creating a backup before running this migration.${NC}\n"
    
    # Show the dangerous lines
    echo -e "${BLUE}Dangerous lines:${NC}"
    for pattern in "${DANGEROUS_PATTERNS[@]}"; do
        if grep -qi "$pattern" "$MIGRATION_FILE"; then
            echo -e "\n${YELLOW}Lines containing '$pattern':${NC}"
            grep -ni "$pattern" "$MIGRATION_FILE" | head -5
        fi
    done
    echo ""
    
    exit 1
fi

echo -e "${GREEN}=== Safety Check Complete ===${NC}"
echo -e "Migration appears safe to deploy.\n"

