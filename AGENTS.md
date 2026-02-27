# AGENTS.md — tmux-app 开发规范

> 本文件供 AI Agent 使用，修改代码前请务必阅读。

---

## 1. 项目概述

tmux-app 是一个 TypeScript 全栈 Web 终端管理界面：
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + react-rnd
- **Server**: Node.js 代理服务器 (通过 Docker 部署)
- **Tests**: curl API 测试 + E2E 浏览器测试

---

## 2. 构建/运行/测试命令

### 2.1 开发环境 (Docker)

```bash
# 启动开发环境（热重载）
docker compose up --build

# 停止
docker compose down

# 查看日志
docker compose logs -f frontend
```

**访问地址:**
- Frontend: http://localhost:6902

### 2.2 Frontend 命令

```bash
cd frontend

# 开发模式 (Vite HMR)
npm run dev

# 类型检查 (lint)
npm run build        # = tsc && vite build (先执行 tsc 类型检查)

# 预览生产构建
npm run preview
```

### 2.3 测试命令

```bash
# 运行单个 curl 测试
bash tests/curl/test_health.sh

# 运行所有 curl 测试
for f in tests/curl/test_*.sh; do bash "$f"; done

# 运行 E2E 测试
bash tests/e2e/test_login.sh
bash tests/e2e/test_create_pane.sh
```

---

## 3. 代码风格规范

### 3.1 TypeScript 配置

- `target`: ES2020
- `strict`: true
- `jsx`: react-jsx
- `noUnusedLocals`: true
- `noUnusedParameters`: true

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

// 4. 本地服务/工具
import { getApiUrl } from './services/apiUrl';

// 5. 类型/常量
import { AppSettings, Position, Size } from './types';
```

### 3.4 组件规范

- 使用函数组件 + Hooks
- 使用 `forwardRef` 处理 ref 转发
- Props 使用接口定义
- 组件文件用 `.tsx`，类型文件用 `.ts`

```typescript
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
    resetValue: () => setValue('')
  }));

  return <div>{title}</div>;
});
```

### 3.5 错误处理

```typescript
// 推荐
try {
  const res = await fetch(url);
  if (!res.ok) {
    console.error('API error:', res.status);
    return;
  }
  const data = await res.json();
} catch (e) {
  console.error('Failed to fetch:', e);
}

// 避免 bare catch
try { /* ... */ } catch {}
```

### 3.6 CSS / 样式

- 使用 Tailwind CSS
- 避免内联样式

```tsx
// 推荐
<div className="flex items-center justify-between p-4">
  <button className="text-blue-500 hover:text-blue-400">Click</button>
</div>

// 避免
<div style={{ display: 'flex' }}>...</div>
```

---

## 4. 测试规范

### 4.1 curl 测试结构

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

# 测试逻辑...

echo ""
echo "PASS: $PASS  FAIL: $FAIL"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

### 4.2 测试要求

- 所有 API 变更必须有对应的 curl 测试
- 所有 UI 变更必须有对应的 E2E 测试
- 测试脚本必须有明确的 PASS/FAIL 输出

---

## 5. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | development | 环境 |
| `VITE_API_URL` | - | API 地址（可选） |

---

## 6. 目录结构

```
tmux-app/
├── frontend/
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── services/    # API 服务
│   │   ├── utils/       # 工具函数
│   │   ├── types.ts     # 类型定义
│   │   ├── Router.tsx   # 路由
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── curl/            # API 测试
│   └── e2e/             # 浏览器 E2E 测试
├── docker-compose.yml
└── AGENTS.md
```

---

## 7. 禁止行为

- 跳过测试直接 commit
- 仅手动点击验证，不写 E2E 测试脚本
- 测试脚本中包含真实 token 明文（必须从 global.json 读取）

---

## 8. 常用命令速查

```bash
# 类型检查
cd frontend && npm run build  # 先执行 tsc 检查

# 运行单个测试
bash tests/curl/test_health.sh
bash tests/e2e/test_login.sh

# 重新构建
docker compose up --build -d

# 查看日志
docker compose logs -f frontend
```
