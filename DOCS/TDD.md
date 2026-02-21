# TDD 开发规范 — ttyd-proxy

> **强制执行**：所有向此项目贡献代码的 AI Agent 必须完整遵守本规范。
> **核心原则**：先写测试，再写实现；测试不通过，不允许提交代码。

---

## 1. 工具链

| 工具 | 用途 | 获取方式 |
|------|------|---------|
| `curl` | 后端 API（server port 6901）测试 | 系统内置 |
| `curl-rpc` | Electron 窗口 JavaScript 执行 | `npm install -g curl-rpc` |
| `electron-mcp` | 浏览器 UI 自动化（截图/点击/输入） | `bash ~/projects/electron-mcp/main/skills/electron-mcp-service/service.sh start` |
| 命令速查 | electron-mcp 完整 API 文档 | `cat ~/projects/electron-mcp/main/skills/SKILLS-LIST.md` |

### 1.1 环境确认

```bash
# 验证 curl-rpc 可用
curl-rpc ping

# 验证 electron-mcp 运行中（默认 8101）
curl -s http://localhost:8101/health || ~/tools/electron-mcp-daemon.sh start

# 获取 Electron 窗口列表
curl-rpc get_windows

# 获取 API token
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
```

---

## 2. TDD 工作流（强制）

```
┌───────────────────────────────────────────────────────────┐
│  RED → GREEN → REFACTOR → TEST PASS → COMMIT             │
│                                                           │
│  server 变更: curl API 测试 → 实现 → 通过                │
│  frontend 变更: electron-mcp E2E → 实现 → 通过           │
└───────────────────────────────────────────────────────────┘
```

### 每次开发必须按以下顺序进行：

```
Step 1  确定变更范围（server / frontend / 两者）
Step 2  写对应测试：
          server 变更   → tests/curl/test_<feature>.sh
          frontend 变更 → tests/e2e/test_<feature>.sh（使用 curl-rpc）
Step 3  运行测试 → 确认 RED（测试应失败）
Step 4  写实现代码
Step 5  运行测试 → 确认 GREEN（测试通过）
Step 6  运行 pre-commit 全量测试
Step 7  全部通过后才允许 git commit
```

---

## 3. 测试文件组织

```
ttyd-proxy/
├── tests/
│   ├── curl/                        # curl API 测试（server port 6901）
│   │   ├── test_health.sh
│   │   └── test_ttyd_proxy.sh
│   └── e2e/                         # E2E 浏览器测试（curl-rpc + electron-mcp）
│       ├── test_login.sh
│       ├── test_create_pane.sh
│       ├── test_terminal.sh
│       └── lib.sh                   # 公共函数库
├── e2e-test.sh                      # 遗留测试（已有，保留兼容）
├── e2e-test-login.sh                # 遗留测试（已有，保留兼容）
└── run_tests.sh                     # 全量测试入口（pre-commit 调用）
```

---

## 4. curl API 测试规范（server, port 6901）

### 4.1 脚本格式（必须遵守）

```bash
#!/bin/bash
# tests/curl/test_<feature>.sh
set -euo pipefail

BASE=${TTYD_PROXY_URL:-http://localhost:6901}
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
H_AUTH="Authorization: Bearer $TOKEN"
H_JSON="Content-Type: application/json"
H_ACCEPT="Accept: application/json"

PASS=0; FAIL=0

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1: $2"; ((FAIL++)); }

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  [ "$actual" = "$expected" ] && pass "$desc" || fail "$desc" "expected HTTP $expected got $actual"
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  echo "$haystack" | grep -q "$needle" && pass "$desc" || fail "$desc" "expected '$needle' in: $haystack"
}

echo "=== $(basename $0) ==="

# --- Tests ---
# ... (具体测试)

# --- Summary ---
echo ""
echo "PASS: $PASS  FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

### 4.2 必须覆盖的 server API 测试

#### tests/curl/test_health.sh
```
GET /api/health (无 token)  → 200, {success:true}
GET /api/health (有 token)  → 200, 含 version/timestamp
GET /nonexistent            → 401（未认证 or 404）
```

#### tests/curl/test_ttyd_proxy.sh
```
GET /ttyd/{不存在pane}                      → 404
GET /ttyd/{有效pane} (无 token)             → 401
GET /ttyd/{有效pane}?token={global_token}   → 200 或代理成功
```

---

## 5. E2E 浏览器测试规范（curl-rpc + electron-mcp）

### 5.1 公共库 `tests/e2e/lib.sh`

```bash
#!/bin/bash
# tests/e2e/lib.sh - E2E 测试公共函数

CURL_RPC=${CURL_RPC:-curl-rpc}
ELECTRON_MCP_URL=${ELECTRON_MCP_URL:-http://localhost:8101}
export ELECTRON_MCP_URL

PASS=0; FAIL=0

# 打印通过/失败
pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1: $2"; ((FAIL++)); }

# 获取当前打开的 ttyd-proxy 窗口 ID
# 用法: WIN_ID=$(get_win_id)
get_win_id() {
  local url="${TTYD_PROXY_URL:-http://localhost:16901}"
  $CURL_RPC get_windows 2>/dev/null \
    | python3 -c "
import sys, json
wins = json.load(sys.stdin)
for w in wins:
    if '$url' in w.get('url','') or 'localhost' in w.get('url',''):
        print(w['id']); break
" 2>/dev/null
}

# 执行 JS 并返回结果（去掉 curl-rpc 的 --- 分隔符）
exec_js() {
  local win_id="$1" code="$2"
  $CURL_RPC exec_js win_id="$win_id" code="$code" 2>/dev/null \
    | grep -v '^---' | head -1
}

# 断言 JS 表达式结果包含期望值
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

# 断言 JS 表达式结果等于期望值
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

# 等待直到 JS 条件为 true（最多 N 秒）
wait_for_js() {
  local win_id="$1" condition="$2" timeout="${3:-10}"
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    result=$(exec_js "$win_id" "$condition")
    [ "$result" = "true" ] && return 0
    sleep 1; elapsed=$((elapsed+1))
  done
  return 1
}

# 登录（将 token 存入 localStorage 并刷新）
do_login() {
  local win_id="$1"
  local token
  token=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
  exec_js "$win_id" "localStorage.setItem('token','$token'); location.reload()" > /dev/null
  sleep 2
}

# 登出（清除 token 并刷新）
do_logout() {
  local win_id="$1"
  exec_js "$win_id" "localStorage.removeItem('token'); location.reload()" > /dev/null
  sleep 2
}

# 截图（debug 用）
take_screenshot() {
  local win_id="$1" path="${2:-/tmp/e2e_screenshot_$(date +%s).png}"
  $CURL_RPC webpage_snapshot win_id="$win_id" save_path="$path" 2>/dev/null
  echo "Screenshot: $path"
}

# 汇总并退出
summarize() {
  echo ""
  echo "PASS: $PASS  FAIL: $FAIL"
  [ "$FAIL" -eq 0 ] && exit 0 || exit 1
}
```

### 5.2 E2E 测试脚本格式

```bash
#!/bin/bash
# tests/e2e/test_<feature>.sh
source "$(dirname "$0")/lib.sh"

FRONTEND_URL=${TTYD_PROXY_URL:-http://localhost:16901}

echo "=== E2E: $(basename $0) ==="

# 1. 确保窗口已打开
WIN_ID=$(get_win_id)
if [ -z "$WIN_ID" ]; then
  WIN_ID=$(curl-rpc open_window url="$FRONTEND_URL" 2>/dev/null | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
  sleep 3
fi
echo "  Window ID: $WIN_ID"

# 2. 登录
do_login "$WIN_ID"

# --- Tests go here ---

summarize
```

### 5.3 必须覆盖的 E2E 测试用例

#### tests/e2e/test_login.sh
```bash
# 场景 1：正常登录
do_logout "$WIN_ID"
# 验证登录表单存在
assert_js_contains "login form visible" "$WIN_ID" \
  'document.querySelector("input") ? "has-input" : "no-input"' "has-input"
# 输入 token 并点击登录
# 验证登录后显示主界面（panes 列表）
assert_js_contains "logged in - main UI visible" "$WIN_ID" \
  'document.body.innerText' "worker"

# 场景 2：无效 token 登录失败
# 输入错误 token → 验证仍显示登录表单或错误提示
```

#### tests/e2e/test_pane_list.sh
```bash
# 登录后验证 pane 列表正常加载
assert_js_contains "pane list loaded" "$WIN_ID" \
  'document.querySelectorAll("[data-pane-id]").length > 0 ? "has-panes" : "no-panes"' "has-panes"

# 验证 pane 可点击
# 验证 pane 选中后终端区域出现
```

#### tests/e2e/test_create_pane.sh
```bash
# 点击 Create 按钮 → 对话框出现
exec_js "$WIN_ID" 'document.querySelector("button[title=\"Create\"]")?.click()'
sleep 1
assert_js_contains "create dialog visible" "$WIN_ID" \
  'document.body.innerText' "Create New Window"

# 输入 window name
exec_js "$WIN_ID" 'document.getElementById("create-dialog-input").value = "e2e_test_auto"'

# 验证输入值
assert_js_equals "input value set" "$WIN_ID" \
  'document.getElementById("create-dialog-input").value' "e2e_test_auto"

# 取消（不真正创建）
exec_js "$WIN_ID" \
  'document.querySelectorAll("button").forEach(b => { if(b.textContent?.trim()==="Cancel") b.click() })'
sleep 1
assert_js_contains "dialog closed" "$WIN_ID" \
  'document.body.innerText' "worker"
```

#### tests/e2e/test_terminal.sh
```bash
# 选择已有 pane → 终端 iframe 加载
# 验证 ttyd iframe 出现
wait_for_js "$WIN_ID" \
  'document.querySelector("iframe") !== null ? "true" : "false"' 10
assert_js_contains "ttyd iframe loaded" "$WIN_ID" \
  'document.querySelector("iframe") ? "has-iframe" : "no-iframe"' "has-iframe"
```

---

## 6. pre-commit 检查脚本

### 6.1 创建 `run_tests.sh`

```bash
#!/bin/bash
# ttyd-proxy/run_tests.sh
# 全量测试 - pre-commit 前必须通过
set -euo pipefail

cd "$(dirname "$0")"

FAIL=0

echo "========================================"
echo "  ttyd-proxy TDD 测试套件"
echo "========================================"

# 0. 确认服务运行中
echo ""
echo "--- 服务健康检查 ---"
curl -sf http://localhost:6901/api/health > /dev/null \
  || { echo "ERROR: ttyd-proxy server (port 6901) 未运行"; exit 1; }
curl -sf http://localhost:14444/health > /dev/null \
  || { echo "ERROR: fast-api (port 14444) 未运行"; exit 1; }
echo "  ✓ server 6901 ok"
echo "  ✓ fast-api 14444 ok"

# 1. curl API 测试（server）
echo ""
echo "--- curl API 测试 ---"
for script in tests/curl/test_*.sh; do
  [ -f "$script" ] || continue
  bash "$script" || { echo "FAILED: $script"; FAIL=$((FAIL+1)); }
done

# 2. E2E 浏览器测试（curl-rpc + electron-mcp）
echo ""
echo "--- E2E 浏览器测试 ---"

# 检查 electron-mcp 是否运行
if ! curl -sf http://localhost:8101/health > /dev/null 2>&1; then
  echo "  WARNING: electron-mcp 未运行，跳过 E2E 测试"
  echo "  → 启动方式: bash ~/projects/electron-mcp/main/skills/electron-mcp-service/service.sh start"
  echo "  → 命令速查: cat ~/projects/electron-mcp/main/skills/SKILLS-LIST.md"
  FAIL=$((FAIL+1))
else
  for script in tests/e2e/test_*.sh; do
    [ -f "$script" ] || continue
    bash "$script" || { echo "FAILED: $script"; FAIL=$((FAIL+1)); }
  done
fi

# 3. 汇总
echo ""
echo "========================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL TESTS PASSED ✓"
  echo "========================================"
  exit 0
else
  echo "  FAILED: $FAIL test suite(s)"
  echo "  → 禁止提交代码，请修复测试后重试"
  echo "========================================"
  exit 1
fi
```

### 6.2 安装 git pre-commit hook

```bash
# 在 ttyd-proxy 目录执行（首次初始化时运行一次）
cat > /home/w3c_offical/projects/ttyd-proxy/.git/hooks/pre-commit << 'EOF'
#!/bin/bash
cd "$(git rev-parse --show-toplevel)"
echo "[pre-commit] 运行 TDD 测试..."
bash run_tests.sh
if [ $? -ne 0 ]; then
  echo "[pre-commit] 测试未通过，提交被拒绝。"
  exit 1
fi
EOF
chmod +x /home/w3c_offical/projects/ttyd-proxy/.git/hooks/pre-commit
```

---

## 7. AI Agent 开发流程（逐步检查单）

### 7a. 修改 server（`server/src/index.ts`）时：

```
[ ] Step 1: 阅读本规范和 ARCHITECTURE.md
[ ] Step 2: 在 tests/curl/ 创建或更新 curl 测试脚本
[ ] Step 3: 运行测试 → 确认 RED
            bash tests/curl/test_<feature>.sh  → 期望 FAIL > 0
[ ] Step 4: 修改 server/src/index.ts
[ ] Step 5: 重启服务（tsx watch 自动重载，或 docker restart ttyd-proxy-server-1）
[ ] Step 6: 运行测试 → 确认 GREEN
            bash tests/curl/test_<feature>.sh  → FAIL = 0
[ ] Step 7: 运行全量测试
            bash run_tests.sh
[ ] Step 8: 通过后提交
```

### 7b. 修改 frontend（`frontend/src/`）时：

```
[ ] Step 1: 阅读本规范和 ARCHITECTURE.md
[ ] Step 2: 确认 electron-mcp 运行中：curl-rpc ping
[ ] Step 3: 确认 Electron 窗口已打开前端页面，记录 WIN_ID：
            curl-rpc get_windows
[ ] Step 4: 在 tests/e2e/ 创建或更新 E2E 测试脚本
[ ] Step 5: 运行测试 → 确认 RED
            bash tests/e2e/test_<feature>.sh  → 期望 FAIL > 0
[ ] Step 6: 修改 frontend/src/ 代码（Vite HMR 自动热更新）
[ ] Step 7: 等待 HMR 更新（约 1s），或手动刷新：
            curl-rpc exec_js win_id=$WIN_ID code='location.reload()'
[ ] Step 8: 运行测试 → 确认 GREEN
            bash tests/e2e/test_<feature>.sh  → FAIL = 0
[ ] Step 9: 运行全量测试
            bash run_tests.sh
[ ] Step 10: 通过后提交
```

### 7c. 截图辅助调试

```bash
WIN_ID=$(curl-rpc get_windows | python3 -c "import sys,json; w=json.load(sys.stdin); print(w[0]['id'])")
curl-rpc webpage_snapshot win_id=$WIN_ID save_path=/tmp/debug.png
# 查看截图以确认 UI 状态
```

---

## 8. 禁止行为

```
✗ 跳过测试直接 commit
✗ 仅手动点击验证，不写 E2E 测试脚本
✗ electron-mcp 未运行时提交 frontend 变更
✗ 使用 git commit --no-verify 绕过 hook
✗ 注释掉失败的测试来通过 pre-commit
✗ 不更新 E2E 测试直接修改已有 UI 组件/API 接口
✗ E2E 测试使用硬编码 win_id（必须用 get_win_id() 动态获取）
✗ 测试脚本中包含真实 token 明文（必须从 global.json 读取）
```

---

## 9. 快速参考：常用测试命令

```bash
# === 环境检查 ===
curl-rpc ping                          # electron-mcp 连通性
curl -s http://localhost:6901/api/health   # server 健康
curl-rpc get_windows                   # 获取所有窗口

# === token ===
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")

# === curl API 测试 ===
bash tests/curl/test_health.sh
for f in tests/curl/test_*.sh; do bash "$f"; done

# === E2E 测试 ===
WIN_ID=$(curl-rpc get_windows | python3 -c "import sys,json; w=json.load(sys.stdin); print(w[0]['id'])")

# 执行 JS
curl-rpc exec_js win_id=$WIN_ID code='document.title'

# 截图
curl-rpc webpage_snapshot win_id=$WIN_ID save_path=/tmp/snap.png

# 运行单个 E2E 脚本
bash tests/e2e/test_login.sh

# === 全量 ===
bash run_tests.sh
```

---

## 10. 新功能开发 Checklist

### server 新增路由
```
路由: GET/POST /api/xxx

测试文件:
  tests/curl/test_xxx.sh       ← 必须创建

curl 测试必须包含:
  [ ] 正常调用（有效 token）→ HTTP 200 + 响应字段验证
  [ ] 无 token 调用         → HTTP 401
  [ ] 非法参数              → HTTP 400/4xx
```

### frontend 新增组件/功能
```
功能: <新功能描述>

测试文件:
  tests/e2e/test_<feature>.sh  ← 必须创建

E2E 测试必须包含:
  [ ] 组件正确渲染（assert_js_contains）
  [ ] 用户交互流程（点击/输入/等待）
  [ ] 最终状态验证（预期 UI 变化）
  [ ] 失败截图（take_screenshot on failure）
```

---

## 11. electron-mcp 常用 JS 模式速查

```bash
WIN_ID=<窗口ID>

# 检查元素存在
curl-rpc exec_js win_id=$WIN_ID code='!!document.querySelector(".my-class")'

# 获取文本内容
curl-rpc exec_js win_id=$WIN_ID code='document.querySelector("h1")?.textContent'

# 点击按钮（按文本）
curl-rpc exec_js win_id=$WIN_ID \
  code='[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Create"))?.click()'

# 输入文本到 input
curl-rpc exec_js win_id=$WIN_ID code='document.querySelector("#my-input").value = "test"'

# 触发 React onChange（React 需要 native input event）
curl-rpc exec_js win_id=$WIN_ID code='
  var inp = document.querySelector("#my-input");
  var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  nativeInputValueSetter.call(inp, "test");
  inp.dispatchEvent(new Event("input", { bubbles: true }));
'

# 检查 localStorage
curl-rpc exec_js win_id=$WIN_ID code='localStorage.getItem("token")'

# 等待元素出现（简单轮询）
for i in $(seq 1 10); do
  RESULT=$(curl-rpc exec_js win_id=$WIN_ID code='!!document.querySelector(".pane-list")')
  [ "$RESULT" = "true" ] && break
  sleep 1
done
```
