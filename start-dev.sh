#!/bin/bash

# Set environment variables
export API_PORT=3001
export NEXT_PUBLIC_API_URL=http://localhost:3001

# Change to project directory
cd "$(dirname "$0")"

# Start API server in background
echo "Starting API server on port 3001..."
API_PORT=3001 npx pnpm --filter @azela-pos/api dev > api.log 2>&1 &
API_PID=$!

# Start Web app in background
echo "Starting Web app on port 3000..."
npx pnpm --filter @azela-pos/web dev > web.log 2>&1 &
WEB_PID=$!

# Start HQ Web app in background
echo "Starting HQ Web app on port 3002..."
NEXT_PUBLIC_API_URL=http://localhost:3001 npx pnpm --filter @azela-pos/hq-web dev > hq-web.log 2>&1 &
HQ_PID=$!

echo "All servers starting..."
echo "API PID: $API_PID"
echo "Web PID: $WEB_PID"
echo "HQ Web PID: $HQ_PID"
echo ""
echo "Logs:"
echo "  API: tail -f api.log"
echo "  Web: tail -f web.log"
echo "  HQ: tail -f hq-web.log"
echo ""
echo "To stop: kill $API_PID $WEB_PID $HQ_PID"

# Wait a bit and check status
sleep 5
echo ""
echo "Checking server status..."
curl -s http://localhost:3001/health > /dev/null && echo "✓ API server (3001) is running" || echo "✗ API server (3001) not responding"
curl -s http://localhost:3000 > /dev/null && echo "✓ Web app (3000) is running" || echo "✗ Web app (3000) not responding yet"
curl -s http://localhost:3002 > /dev/null && echo "✓ HQ Web app (3002) is running" || echo "✗ HQ Web app (3002) not responding yet"
