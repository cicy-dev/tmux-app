# AGENTS.md — ttyd-proxy 开发规范

> 本文件供 AI Agent 使用，修改代码前请务必阅读。

---

## 1. 项目概述

ttyd-proxy 是一个 TypeScript 全栈项目，包含：
- **Server** (`server/`): HTTP 代理服务器，提供 API 和 WebSocket 代理到 ttyd
- **Frontend** (`frontend/`): React + TypeScript 前端，使用 Vite 构建
- **Tests** (`tests/`): curl API 测试和 E2E 浏览器测试

### 技术栈
- Server: Node.js + http-proxy + TypeScript (ES2022)
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS
- 测试: curl + electron-mcp (E2E 自动化)

---

## 2. 构建/运行/测试命令

### 2.1 开发环境 (Docker)

```bash
# 启动开发环境（热重载）
docker compose -f docker-compose.dev.yml up --build

# 停止
docker compose -f docker-compose.dev.yml down
```

### 2.2 Server 命令

```bash
cd server

# 开发模式 (tsx watch 热重载)
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm run start

# 运行单个 curl 测试
bash tests/curl/test_health.sh

# 运行所有 curl 测试
for f in tests/curl/test_*.sh; do bash "$f"; done
```

### 2.3 Frontend 命令

```bash
cd frontend

# 开发模式 (Vite HMR)
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 2.4 全量测试

```bash
# 运行所有测试 (curl + E2E)
bash run_tests.sh

# 单独运行 E2E 测试
bash tests/e2e/test_login.sh
bash tests/e2e/test_create_pane.sh
```

### 2.5 依赖安装

```bash
cd server && npm install
cd frontend && npm install
```

---

## 3. 代码风格规范

### 3.1 TypeScript 配置

**Server** (`server/tsconfig.json`):
- `target`: ES2022
- `module`: ESNext
- `strict`: true
- `moduleResolution`: node

**Frontend** (`frontend/tsconfig.json`):
- `target`: ES2020
- `strict`: true
- `jsx`: react-jsx
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `moduleResolution`: bundler

### 3.2 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `command-panel.tsx`, `api-url.ts` |
| 组件 | PascalCase | `CommandPanel`, `TtydFrame` |
| 接口/类型 | PascalCase | `AppSettings`, `Position` |
| 函数/变量 | camelCase | `handleLogin`, `isLoaded` |
| 常量 | UPPER_SNAKE | `DEFAULT_SETTINGS`, `PORT` |
| CSS 类 | kebab-case | `text-blue-500`, `flex items-center` |

### 3.3 导入顺序

```typescript
// 1. React 核心
import React, { useState, useEffect, useCallback } from 'react';

// 2. 外部库
import { Terminal, Loader2 } from 'lucide-react';

// 3. 本地组件
import { TtydFrame } from './components/TtydFrame';
import { CommandPanel } from './components/CommandPanel';

// 4. 本地服务/工具
import { sendCommandToTmux } from './services/mockApi';
import { getApiUrl } from './services/apiUrl';

// 5. 类型/常量
import { AppSettings, Position, Size } from './types';
```

### 3.4 组件规范

- 使用函数组件 + Hooks
- 使用 `forwardRef` 处理 ref 转发
- Props 使用接口定义
- 组件文件用 `.tsx` 扩展名
- 类型文件用 `.ts` 扩展名

```typescript
// 组件示例
interface MyComponentProps {
  title: string;
  onSubmit: (value: string) => void;
}

export const MyComponent = forwardRef<MyComponentHandle, MyComponentProps>(({
  title,
  onSubmit
}, ref) => {
  const [value, setValue] = useState('');
  
  useImperativeHandle(ref, () => ({
    resetValue('')
 : () => set }));
  
  return <div>{title}</div>;
});
```

### 3.5 错误处理

- 使用 try/catch 捕获异步错误
- 使用 `console.error` 记录错误
- 避免 bare `catch`（捕获后至少记录错误）

```typescript
// 推荐
try {
  const res = await fetch(url);
  const data = await res.json();
} catch (e) {
  console.error('Failed to fetch:', e);
}

// 避免
try {
  // ...
} catch {}
```

### 3.6 API 响应处理

```typescript
// 检查响应状态
if (!res.ok) {
  console.error('API error:', res.status);
  return;
}

const data = await res.json();
```

### 3.7 CSS / 样式

- 使用 Tailwind CSS
- 保持 className 简洁
- 使用语义化类名组合

```tsx
// 推荐
<div className="flex items-center justify-between p-4">
  <button className="text-blue-500 hover:text-blue-400">Click</button>
</div>

// 避免内联样式
<div style={{ display: 'flex', color: 'blue' }}>...</div>
```

---

## 4. TDD 开发流程 (强制)

详见 `DOCS/TDD.md`，核心流程：

```
RED → GREEN → REFACTOR → TEST PASS → COMMIT
```

### 4.1 Server 变更

```bash
# 1. 创建/修改测试
vim tests/curl/test_<feature>.sh

# 2. 运行测试 (应失败)
bash tests/curl/test_<feature>.sh

# 3. 修改实现
vim server/src/index.ts

# 4. 重启服务 (docker-compose 会自动重载)
docker compose -f docker-compose.dev.yml logs -f server

# 5. 再次运行测试 (应通过)
bash tests/curl/test_<feature>.sh

# 6. 运行全量测试
bash run_tests.sh
```

### 4.2 Frontend 变更

```bash
# 1. 确认 electron-mcp 运行
curl-rpc ping

# 2. 创建/修改 E2E 测试
vim tests/e2e/test_<feature>.sh

# 3. 运行测试 (应失败)
bash tests/e2e/test_<feature>.sh

# 4. 修改前端代码 (Vite HMR 自动更新)
vim frontend/src/...

# 5. 刷新页面
curl-rpc exec_js win_id=$WIN_ID code='location.reload()'

# 6. 再次运行测试 (应通过)
bash tests/e2e/test_<feature>.sh

# 7. 运行全量测试
bash run_tests.sh
```

---

## 5. 测试规范

### 5.1 curl API 测试结构

```bash
#!/bin/bash
# tests/curl/test_<feature>.sh
set -euo pipefail

BASE=${TTYD_PROXY_URL:-http://localhost:6901}
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")
H_AUTH="Authorization: Bearer $TOKEN"
H_ACCEPT="Accept: application/json"

PASS=0; FAIL=0

pass() { echo "  ✓ $1"; ((PASS++)); }
fail() { echo "  ✗ $1: $2"; ((FAIL++)); }

# ... 测试逻辑 ...

echo ""
echo "PASS: $PASS  FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

### 5.2 E2E 测试结构

```bash
#!/bin/bash
# tests/e2e/test_<feature>.sh
source "$(dirname "$0")/lib.sh"

WIN_ID=$(get_win_id)
# ... 测试逻辑 ...
summarize
```

### 5.3 测试命名

- curl 测试: `tests/curl/test_<feature>.sh`
- E2E 测试: `tests/e2e/test_<feature>.sh`

---

## 6. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 6901 | Server 端口 |
| `NODE_ENV` | development | 环境 |
| `CORS_ORIGIN` | * | CORS 允许的源 |
| `VITE_API_URL` | - | 前端 API 地址 |
| `VITE_TTYD_URL` | - | 前端 ttyd 地址 |

---

## 7. 目录结构

```
ttyd-proxy/
├── server/
│   ├── src/
│   │   └── index.ts       # 主服务器代码
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile*
├── frontend/
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── services/      # API 服务
│   │   ├── types.ts       # 类型定义
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile*
├── tests/
│   ├── curl/              # API 测试
│   └── e2e/               # 浏览器 E2E 测试
├── DOCS/
│   ├── TDD.md            # TDD 开发规范
│   ├── ARCHITECTURE.md
│   └── DEVELOPMENT.md
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── run_tests.sh
```

---

## 8. 禁止行为

- 跳过测试直接 commit
- 仅手动点击验证，不写 E2E 测试脚本
- electron-mcp 未运行时提交 frontend 变更
- 使用 `git commit --no-verify` 绕过 hook
- 注释掉失败的测试来通过 pre-commit
- 测试脚本中包含真实 token 明文（必须从 global.json 读取）

---

## 9. 常用命令速查

```bash
# 检查服务健康
curl http://localhost:6901/api/health

# 获取 token
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")

# 运行单个测试
bash tests/curl/test_health.sh
bash tests/e2e/test_login.sh

# 运行全量测试
bash run_tests.sh

# 获取 electron 窗口
curl-rpc get_windows
```

---

## 10. 相关文档

- [DOCS/TDD.md](./DOCS/TDD.md) - TDD 开发规范（强制遵守）
- [DOCS/ARCHITECTURE.md](./DOCS/ARCHITECTURE.md) - 架构说明
- [DOCS/DEVELOPMENT.md](./DOCS/DEVELOPMENT.md) - 开发指南
- [README.md](./README.md) - 项目概述
