#!/bin/bash
set -euo pipefail

BASE_URL=${TTYD_PROXY_URL:-http://localhost:6902}
ELECTRON_WIN=${ELECTRON_WIN:-12}
ELECTRON_NODE=${ELECTRON_MCP_NODE:-2}

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1: $2"; ((FAIL++)); }

echo "=== E2E Test: Middle Column Title ==="
echo

# Test 1: Click first pane in left list
echo "Test 1: Select first pane and check title"
RESULT=$(ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc exec_js win_id=$ELECTRON_WIN code="
const leftPane = document.querySelector('#left-side .w-10');
const title = leftPane?.querySelector('.text-sm')?.textContent || '';
leftPane?.parentElement?.click();
setTimeout(() => {
  const middleTitle = document.querySelector('#main-middle-topbar button')?.textContent || '';
  console.log(JSON.stringify({leftTitle: title, middleTitle: middleTitle}));
}, 500);
'waiting...'
" 2>&1)

if echo "$RESULT" | grep -q "leftTitle"; then
  LEFT_TITLE=$(echo "$RESULT" | grep -o '"leftTitle":"[^"]*"' | cut -d'"' -f4)
  MIDDLE_TITLE=$(echo "$RESULT" | grep -o '"middleTitle":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$LEFT_TITLE" = "$MIDDLE_TITLE" ]; then
    pass "Middle title matches selected pane: $MIDDLE_TITLE"
  else
    fail "Title mismatch" "Left: $LEFT_TITLE, Middle: $MIDDLE_TITLE"
  fi
else
  fail "Failed to get titles" "$RESULT"
fi

# Test 2: Click second pane and verify title updates
echo
echo "Test 2: Select second pane and check title updates"
sleep 1
RESULT=$(ELECTRON_MCP_NODE=$ELECTRON_NODE curl-rpc exec_js win_id=$ELECTRON_WIN code="
const panes = document.querySelectorAll('#left-side .w-10');
if (panes.length > 1) {
  const secondPane = panes[1];
  const title = secondPane?.querySelector('.text-sm')?.textContent || '';
  secondPane?.parentElement?.click();
  setTimeout(() => {
    const middleTitle = document.querySelector('#main-middle-topbar button')?.textContent || '';
    console.log(JSON.stringify({leftTitle: title, middleTitle: middleTitle}));
  }, 500);
  'waiting...'
} else {
  console.log(JSON.stringify({error: 'Not enough panes'}));
  'skip'
}
" 2>&1)

if echo "$RESULT" | grep -q "leftTitle"; then
  LEFT_TITLE=$(echo "$RESULT" | grep -o '"leftTitle":"[^"]*"' | cut -d'"' -f4)
  MIDDLE_TITLE=$(echo "$RESULT" | grep -o '"middleTitle":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$LEFT_TITLE" = "$MIDDLE_TITLE" ]; then
    pass "Middle title updated to: $MIDDLE_TITLE"
  else
    fail "Title not updated" "Left: $LEFT_TITLE, Middle: $MIDDLE_TITLE"
  fi
elif echo "$RESULT" | grep -q "Not enough panes"; then
  echo "  ⊘ Skipped (only 1 pane available)"
else
  fail "Failed to get titles" "$RESULT"
fi

echo
echo "=== Summary ==="
echo "PASS: $PASS  FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
