#!/bin/bash
# E2E Test for tmux-app IDE
# Tests on dev route (port 6902)

DEV_URL="http://localhost:6902"
API_URL="http://localhost:14444"
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")

PASS=0
FAIL=0

echo "================================"
echo "tmux-app IDE E2E Tests"
echo "================================"
echo ""

# Test 1: Dev server
echo "Test 1: Dev server..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEV_URL")
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ PASS: Dev server running (HTTP $HTTP_CODE)"
  ((PASS++))
else
  echo "  ✗ FAIL: Dev server not responding (HTTP $HTTP_CODE)"
  ((FAIL++))
fi

# Test 2: API health
echo "Test 2: API health..."
HEALTH=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/health")
if echo "$HEALTH" | grep -q "ok"; then
  echo "  ✓ PASS: API healthy"
  ((PASS++))
else
  echo "  ✗ FAIL: API unhealthy - $HEALTH"
  ((FAIL++))
fi

# Test 3: Agents API
echo "Test 3: Agents API..."
AGENTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/tmux/status/all")
COUNT=$(echo "$AGENTS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$COUNT" -gt 0 ]; then
  echo "  ✓ PASS: Loaded $COUNT agents"
  ((PASS++))
else
  echo "  ✗ FAIL: No agents loaded"
  ((FAIL++))
fi

# Test 4: Panes API
echo "Test 4: Panes API..."
PANES=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/tmux/panes")
if echo "$PANES" | grep -q "pane_id"; then
  echo "  ✓ PASS: Panes API works"
  ((PASS++))
else
  echo "  ✗ FAIL: Panes API failed"
  ((FAIL++))
fi

# Test 5: IDE page with token
echo "Test 5: IDE page load..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DEV_URL/?token=$TOKEN")
if [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ PASS: IDE page loads (HTTP $HTTP_CODE)"
  ((PASS++))
else
  echo "  ✗ FAIL: IDE page failed (HTTP $HTTP_CODE)"
  ((FAIL++))
fi

# Summary
echo ""
echo "================================"
echo "Results: $PASS passed, $FAIL failed"
echo "================================"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
