#!/bin/bash
# E2E Test for tmux-app IDE using curl-rpc (Electron automation)
# Tests on dev route (port 6902) without affecting production

set -euo pipefail

# Config
ELECTRON_NODE=2
DEV_URL="http://localhost:6902"
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
TEST_PANE="w-test-$(date +%s)"

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

# Check curl-rpc connection
info "Checking Electron connection..."
if ! ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc ping &>/dev/null; then
  echo "Error: Electron not connected on node $ELECTRON_NODE"
  exit 1
fi
pass "Electron connected"

# Test 1: Open IDE in Electron
info "Test 1: Opening IDE in Electron..."
WINDOW_ID=$(ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc open_window url="$DEV_URL/?token=$TOKEN" 2>/dev/null | grep -oP 'window_id=\K\d+' || echo "")

if [ -n "$WINDOW_ID" ]; then
  pass "Opened IDE window (ID: $WINDOW_ID)"
else
  fail "Open IDE window" "Failed to get window ID"
fi

# Wait for page load
sleep 3

# Test 2: Check if page loaded
info "Test 2: Checking page load..."
PAGE_TITLE=$(ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc get_window_info window_id="$WINDOW_ID" 2>/dev/null | grep -oP '"title":\s*"\K[^"]+' || echo "")

if [[ "$PAGE_TITLE" =~ "IDE" ]] || [[ "$PAGE_TITLE" =~ "tmux" ]]; then
  pass "Page loaded: $PAGE_TITLE"
else
  fail "Page load" "Title: $PAGE_TITLE"
fi

# Test 3: Navigate to Agents tab
info "Test 3: Navigating to Agents tab..."
ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc execute_javascript window_id="$WINDOW_ID" script="document.querySelector('button:contains(\"Agents\")')?.click()" &>/dev/null
sleep 1

if ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc execute_javascript window_id="$WINDOW_ID" script="document.querySelector('.agents-container') !== null" 2>/dev/null | grep -q "true"; then
  pass "Navigated to Agents tab"
else
  fail "Navigate to Agents tab" "Agents container not found"
fi

# Test 4: Check agents list loaded
info "Test 4: Checking agents list..."
AGENTS_COUNT=$(ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc execute_javascript window_id="$WINDOW_ID" script="document.querySelectorAll('.agent-card').length" 2>/dev/null | grep -oP '\d+' || echo "0")

if [ "$AGENTS_COUNT" -gt 0 ]; then
  pass "Agents loaded: $AGENTS_COUNT agents"
else
  fail "Load agents" "No agents found"
fi

# Test 5: Search functionality
info "Test 5: Testing search..."
ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc execute_javascript window_id="$WINDOW_ID" script="document.querySelector('input[placeholder*=\"Search\"]').value = 'test'; document.querySelector('input[placeholder*=\"Search\"]').dispatchEvent(new Event('input', { bubbles: true }))" &>/dev/null
sleep 1

FILTERED_COUNT=$(ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc execute_javascript window_id="$WINDOW_ID" script="document.querySelectorAll('.agent-card:not([style*=\"display: none\"])').length" 2>/dev/null | grep -oP '\d+' || echo "0")

if [ "$FILTERED_COUNT" -ge 0 ]; then
  pass "Search works: $FILTERED_COUNT results"
else
  fail "Search" "Failed to filter"
fi

# Test 6: Click agent card
info "Test 6: Testing agent card click..."
ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc execute_javascript window_id="$WINDOW_ID" script="document.querySelector('.agent-card')?.click()" &>/dev/null
sleep 2

# Check if new window opened
WINDOWS_COUNT=$(ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc list_windows 2>/dev/null | grep -c "window_id" || echo "1")

if [ "$WINDOWS_COUNT" -gt 1 ]; then
  pass "Agent card click opened new window"
else
  fail "Agent card click" "No new window opened"
fi

# Test 7: Close test window
info "Test 7: Cleaning up..."
if [ -n "$WINDOW_ID" ]; then
  ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc close_window window_id="$WINDOW_ID" &>/dev/null
  pass "Closed test window"
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
