#!/bin/bash
# ttyd-proxy/tests/e2e/lib.sh
# E2E 测试公共函数库 — 所有 e2e 脚本必须 source 本文件

CURL_RPC=${CURL_RPC:-curl-rpc}
ELECTRON_MCP_URL=${ELECTRON_MCP_URL:-http://localhost:8101}
export ELECTRON_MCP_URL

PASS=0; FAIL=0

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1: $2"; ((FAIL++)); }

# 动态获取前端窗口 ID（必须用此函数，禁止硬编码 win_id）
get_win_id() {
  local url="${TTYD_PROXY_URL:-http://localhost:16901}"
  $CURL_RPC get_windows 2>/dev/null \
    | python3 -c "
import sys, json
try:
    wins = json.load(sys.stdin)
    for w in wins:
        u = w.get('url','')
        if '16901' in u or '${url}' in u:
            print(w['id']); break
except:
    pass
" 2>/dev/null
}

# 打开或复用窗口
ensure_window() {
  local url="${TTYD_PROXY_URL:-http://localhost:16901}"
  local win_id
  win_id=$(get_win_id)
  if [ -z "$win_id" ]; then
    win_id=$($CURL_RPC open_window url="$url" 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
    sleep 3
    win_id=$(get_win_id)
  fi
  echo "$win_id"
}

# 执行 JS 并返回结果（去掉 --- 分隔符）
exec_js() {
  local win_id="$1" code="$2"
  $CURL_RPC exec_js win_id="$win_id" code="$code" 2>/dev/null \
    | grep -v '^---' | grep -v '^$' | head -1
}

# 断言 JS 结果包含期望字符串
assert_js_contains() {
  local desc="$1" win_id="$2" code="$3" expected="$4"
  local result
  result=$(exec_js "$win_id" "$code")
  if echo "$result" | grep -q "$expected"; then
    pass "$desc"
  else
    fail "$desc" "expected '$expected', got '$result'"
  fi
}

# 断言 JS 结果等于期望值
assert_js_equals() {
  local desc="$1" win_id="$2" code="$3" expected="$4"
  local result
  result=$(exec_js "$win_id" "$code")
  if [ "$result" = "$expected" ]; then
    pass "$desc"
  else
    fail "$desc" "expected '$expected', got '$result'"
  fi
}

# 等待 JS 条件成立（默认最多 10 秒）
wait_for_js() {
  local win_id="$1" condition="$2" timeout="${3:-10}"
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    result=$(exec_js "$win_id" "$condition" 2>/dev/null || echo "false")
    [ "$result" = "true" ] && return 0
    sleep 1; elapsed=$((elapsed+1))
  done
  return 1
}

# 登录（写入 localStorage token 并刷新页面）
do_login() {
  local win_id="$1"
  local token
  token=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
  exec_js "$win_id" "localStorage.setItem('token','$token'); location.reload()" > /dev/null
  sleep 2
}

# 登出
do_logout() {
  local win_id="$1"
  exec_js "$win_id" "localStorage.removeItem('token'); location.reload()" > /dev/null
  sleep 2
}

# 截图（测试失败时调用）
take_screenshot() {
  local win_id="$1" label="${2:-debug}"
  local path="/tmp/e2e_${label}_$(date +%s).png"
  $CURL_RPC webpage_snapshot win_id="$win_id" save_path="$path" 2>/dev/null || true
  echo "  Screenshot saved: $path"
}

# 汇总并退出
summarize() {
  echo ""
  echo "PASS: $PASS  FAIL: $FAIL"
  [ "$FAIL" -eq 0 ] && exit 0 || exit 1
}
