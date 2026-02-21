#!/bin/bash
# ttyd-proxy/tests/e2e/test_login.sh
# E2E 测试：登录 / 登出 / 认证流程
source "$(dirname "$0")/lib.sh"

echo "=== E2E: test_login.sh ==="

# 0. 确保窗口存在
WIN_ID=$(ensure_window)
if [ -z "$WIN_ID" ]; then
  fail "window" "无法打开或找到 ttyd-proxy 窗口" && summarize
fi
echo "  Window ID: $WIN_ID"

# 1. 登出，确认进入登录页
echo "[1] 登出 → 登录页"
do_logout "$WIN_ID"
assert_js_contains "login input visible after logout" "$WIN_ID" \
  'document.querySelector("input") ? "has-input" : "no-input"' "has-input"

# 2. 页面标题
echo "[2] 页面标题"
TITLE=$(exec_js "$WIN_ID" 'document.title')
echo "  title: $TITLE"
[ -n "$TITLE" ] && pass "page title exists" || fail "page title" "empty title"

# 3. 登录表单：有 input 和 button
echo "[3] 登录表单元素"
BUTTONS=$(exec_js "$WIN_ID" 'document.querySelectorAll("button").length')
echo "  buttons: $BUTTONS"
[ "${BUTTONS:-0}" -ge 1 ] && pass "login button exists" || fail "login button" "no buttons"

INPUT_TYPE=$(exec_js "$WIN_ID" 'document.querySelector("input")?.type || "none"')
echo "  input type: $INPUT_TYPE"
[ "$INPUT_TYPE" != "none" ] && pass "login input exists" || fail "login input" "no input"

# 4. 输入 token 并点击登录
echo "[4] 输入 token"
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
exec_js "$WIN_ID" "document.querySelector('input').value = '$TOKEN'" > /dev/null
sleep 1
INPUT_VAL=$(exec_js "$WIN_ID" "document.querySelector('input').value")
[ "${#INPUT_VAL}" -gt 10 ] && pass "token input filled" || fail "token input" "value not set: $INPUT_VAL"

# 5. 点击登录按钮
echo "[5] 点击登录"
exec_js "$WIN_ID" "document.querySelector('button')?.click()" > /dev/null
sleep 3

# 6. 验证登录后主界面出现
echo "[6] 主界面验证"
BODY_TEXT=$(exec_js "$WIN_ID" 'document.body.innerText' | head -c 200)
echo "  body preview: ${BODY_TEXT:0:80}..."
if echo "$BODY_TEXT" | grep -qiE "worker|session|pane|terminal"; then
  pass "main UI visible after login"
else
  fail "main UI visible after login" "body: ${BODY_TEXT:0:100}"
  take_screenshot "$WIN_ID" "login_fail"
fi

# 7. token 存入 localStorage
echo "[7] localStorage token"
STORED=$(exec_js "$WIN_ID" "localStorage.getItem('token')")
[ "${#STORED}" -gt 10 ] && pass "token stored in localStorage" || fail "token in localStorage" "empty: $STORED"

# 8. 无效 token 登录
echo "[8] 无效 token"
do_logout "$WIN_ID"
exec_js "$WIN_ID" "document.querySelector('input').value = 'invalid_token_12345'" > /dev/null
sleep 1
exec_js "$WIN_ID" "document.querySelector('button')?.click()" > /dev/null
sleep 3
# 应停留在登录页或显示错误（不进入主界面）
BODY_AFTER=$(exec_js "$WIN_ID" 'document.body.innerText' | head -c 100)
if echo "$BODY_AFTER" | grep -qiE "worker|session|pane"; then
  fail "invalid token rejected" "logged in with invalid token"
else
  pass "invalid token rejected (stayed on login page)"
fi

# 9. 恢复正常登录（为后续测试准备）
do_login "$WIN_ID"

summarize
