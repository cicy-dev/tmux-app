#!/bin/bash
# E2E Test for tmux-app IDE
# Tests on dev route (port 6902) without affecting production

set -euo pipefail

# Config
DEV_URL="http://localhost:6902"
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0

pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

fail() {
  echo -e "${RED}✗${NC} $1: $2"
  ((FAIL++))
}

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

# Test 1: Check dev server is running
info "Test 1: Checking dev server..."
if curl -s -o /dev/null -w "%{http_code}" "$DEV_URL" | grep -q "200\|302"; then
  pass "Dev server is running"
else
  fail "Dev server" "Not responding"
fi

# Test 2: Check API health
info "Test 2: Checking API..."
HEALTH=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:14444/api/health)
if echo "$HEALTH" | grep -q "ok"; then
  pass "API is healthy"
else
  fail "API health" "$HEALTH"
fi

# Test 3: Get agents list
info "Test 3: Fetching agents..."
AGENTS=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:14444/api/tmux/status/all)
AGENT_COUNT=$(echo "$AGENTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$AGENT_COUNT" -gt 0 ]; then
  pass "Agents loaded: $AGENT_COUNT agents"
else
  fail "Load agents" "No agents found"
fi

# Test 4: Check panes API
info "Test 4: Checking panes API..."
PANES=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:14444/api/tmux/panes)
if echo "$PANES" | grep -q "pane_id"; then
  pass "Panes API works"
else
  fail "Panes API" "No panes returned"
fi

# Test 5: Test IDE page loads with token
info "Test 5: Testing IDE page with token..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$DEV_URL/?token=$TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | grep -q "<!DOCTYPE html"; then
  pass "IDE page loads successfully"
else
  fail "IDE page load" "HTTP $HTTP_CODE"
fi

# Test 6: Check if main JS bundle exists
info "Test 6: Checking JS bundle..."
if curl -s -o /dev/null -w "%{http_code}" "$DEV_URL/src/main.tsx" | grep -q "200"; then
  pass "JS bundle accessible"
else
  fail "JS bundle" "Not found"
fi

# Summary
echo ""
echo "================================"
echo "E2E Test Results"
echo "================================"
echo -e "${GREEN}PASS: $PASS${NC}"
echo -e "${RED}FAIL: $FAIL${NC}"
echo "================================"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
