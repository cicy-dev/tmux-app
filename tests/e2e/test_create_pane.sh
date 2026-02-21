#!/bin/bash
# ttyd-proxy/tests/e2e/test_create_pane.sh
# E2E 测试：创建 pane 对话框交互
source "$(dirname "$0")/lib.sh"

echo "=== E2E: test_create_pane.sh ==="

# 0. 确保窗口并登录
WIN_ID=$(ensure_window)
if [ -z "$WIN_ID" ]; then
  fail "window" "无法找到 ttyd-proxy 窗口" && summarize
fi
echo "  Window ID: $WIN_ID"
do_login "$WIN_ID"

# 1. 主界面已加载
echo "[1] 主界面已加载"
wait_for_js "$WIN_ID" '!!document.querySelector("button[title=\"Create\"]") ? "true" : "false"' 10 \
  && pass "Create button exists" \
  || { fail "Create button exists" "not found after 10s"; take_screenshot "$WIN_ID" "no_create_btn"; }

# 2. 点击 Create 按钮
echo "[2] 打开创建对话框"
exec_js "$WIN_ID" 'document.querySelector("button[title=\"Create\"]")?.click()' > /dev/null
sleep 1
assert_js_contains "create dialog visible" "$WIN_ID" \
  'document.body.innerText' "Create New Window"

# 3. 找到输入框
echo "[3] 对话框输入框"
INPUT_EXISTS=$(exec_js "$WIN_ID" '!!document.getElementById("create-dialog-input") ? "yes" : "no"')
[ "$INPUT_EXISTS" = "yes" ] && pass "dialog input found" || fail "dialog input" "not found"

# 4. 输入 window name
echo "[4] 输入 window name"
exec_js "$WIN_ID" 'document.getElementById("create-dialog-input").value = "e2e_test_auto"' > /dev/null
sleep 1
assert_js_equals "input value set" "$WIN_ID" \
  'document.getElementById("create-dialog-input").value' "e2e_test_auto"

# 5. 取消（不真正创建）
echo "[5] 取消对话框"
exec_js "$WIN_ID" \
  'document.querySelectorAll("button").forEach(b => { if(b.textContent?.trim()==="Cancel") b.click() })' > /dev/null
sleep 1
# 对话框应消失
DIALOG_GONE=$(exec_js "$WIN_ID" \
  '!document.body.innerText.includes("Create New Window") ? "gone" : "still-visible"')
[ "$DIALOG_GONE" = "gone" ] && pass "dialog closed after cancel" || fail "dialog closed" "still visible"

summarize
