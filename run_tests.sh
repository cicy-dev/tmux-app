#!/bin/bash
# ttyd-proxy/run_tests.sh
# 全量测试入口 — pre-commit 前必须通过
# AI Agent 规范: 见 DOCS/TDD.md
set -euo pipefail

cd "$(dirname "$0")"

FAIL=0

echo "========================================"
echo "  ttyd-proxy TDD 测试套件"
echo "========================================"

# 0. 确认服务运行中
echo ""
echo "--- 服务健康检查 ---"
if ! curl -sf http://localhost:6901/api/health > /dev/null 2>&1; then
  echo "ERROR: ttyd-proxy server (port 6901) 未运行"
  echo "  → 启动: docker compose -f docker-compose.yml up -d"
  exit 1
fi
if ! curl -sf http://localhost:14444/health > /dev/null 2>&1; then
  echo "ERROR: fast-api (port 14444) 未运行"
  echo "  → 启动: cd ~/projects/fast-api && docker compose up -d"
  exit 1
fi
echo "  ✓ ttyd-proxy server :6901 ok"
echo "  ✓ fast-api :14444 ok"

# 1. curl API 测试（server）
echo ""
echo "--- curl API 测试 (server :6901) ---"
for script in tests/curl/test_*.sh; do
  [ -f "$script" ] || continue
  echo ""
  if bash "$script"; then
    :
  else
    echo "  SUITE FAILED: $script"
    FAIL=$((FAIL+1))
  fi
done

# 2. E2E 浏览器测试（electron-mcp + curl-rpc）
echo ""
echo "--- E2E 浏览器测试 (electron-mcp :8101) ---"
if ! curl -sf http://localhost:8101/health > /dev/null 2>&1; then
  echo "  ERROR: electron-mcp 未运行"
  echo "  → 启动: ~/tools/electron-mcp-daemon.sh start"
  echo "  → frontend E2E 测试是强制项，electron-mcp 必须运行"
  FAIL=$((FAIL+1))
else
  for script in tests/e2e/test_*.sh; do
    [ -f "$script" ] || continue
    echo ""
    if bash "$script"; then
      :
    else
      echo "  SUITE FAILED: $script"
      FAIL=$((FAIL+1))
    fi
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
  echo "  → 规范: DOCS/TDD.md"
  echo "========================================"
  exit 1
fi
