#!/bin/bash
# Run entire project: API (3003), Web (3001), HQ Web (3002)
# Use: ./run-all.sh   (from project root, with pnpm installed)

set -e
cd "$(dirname "$0")"

export API_PORT=3003
export NEXT_PUBLIC_API_URL=http://localhost:3003

# Optional: free ports if already in use (uncomment to force restart)
# for port in 3001 3002 3003; do
#   lsof -ti:$port | xargs kill -9 2>/dev/null || true
# done
# sleep 1

echo "Starting entire project (API, Web, HQ Web)..."
echo ""

if command -v pnpm &>/dev/null; then
  pnpm dev
else
  echo "pnpm not found. Install with: npm install -g pnpm"
  echo "Or start manually:"
  echo "  Terminal 1: cd apps/api && API_PORT=3003 npx tsx watch src/index.ts"
  echo "  Terminal 2: cd apps/web && NEXT_PUBLIC_API_URL=http://localhost:3003 npx next dev -p 3001"
  echo "  Terminal 3: cd apps/hq-web && NEXT_PUBLIC_API_URL=http://localhost:3003 npx next dev -p 3002"
  exit 1
fi
