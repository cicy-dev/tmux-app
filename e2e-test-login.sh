#!/bin/bash
# 此文件已迁移到 tests/e2e/test_login.sh
# 保留此文件仅为兼容旧引用，请使用 run_tests.sh 运行全量测试
echo "[deprecated] 请使用 bash run_tests.sh 或 bash tests/e2e/test_login.sh"
bash "$(dirname "$0")/tests/e2e/test_login.sh"
