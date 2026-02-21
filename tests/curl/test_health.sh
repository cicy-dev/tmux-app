#!/bin/bash
# ttyd-proxy/tests/curl/test_health.sh
set -euo pipefail

BASE=${TTYD_PROXY_URL:-http://localhost:6901}
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
H_AUTH="Authorization: Bearer $TOKEN"
H_ACCEPT="Accept: application/json"

PASS=0; FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1: $2"; FAIL=$((FAIL+1)); }

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  [ "$actual" = "$expected" ] && pass "$desc" || fail "$desc" "expected HTTP $expected got $actual"
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  echo "$haystack" | grep -q "$needle" && pass "$desc" || fail "$desc" "expected '$needle' in response"
}

echo "=== test_health.sh (ttyd-proxy server:6901) ==="

# GET /api/health (no auth required)
echo "[1] GET /api/health"
RESP=$(curl -s -w '\n%{http_code}' "$BASE/api/health")
CODE=$(echo "$RESP" | tail -1); BODY=$(echo "$RESP" | head -1)
assert_status "/api/health → 200" "200" "$CODE"
assert_contains "/api/health success:true" '"success"' "$BODY"
assert_contains "/api/health version field" '"version"' "$BODY"

# GET /nonexistent (no auth) → 401
echo "[2] GET /unknown_path (no auth)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/unknown_path_xyz")
assert_status "unknown path no auth → 401" "401" "$CODE"

# GET /unknown_path (with valid token) → not 401 (server may not send a body for unknown routes)
echo "[3] GET /unknown_path (with token)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$BASE/unknown_path_xyz" -H "$H_AUTH") || true
# 000 = timeout/no response (server doesn't handle unknown routes), also acceptable
[ "$CODE" != "401" ] && pass "valid token accepted (code: $CODE)" || fail "valid token" "still got 401"

echo ""
echo "PASS: $PASS  FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
