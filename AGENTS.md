# AGENTS.md — ttyd-proxy 开发规范

> 本文件供 AI Agent 使用，修改代码前请务必阅读。
> 最后更新: 2026-02-22

---

## 1. 项目概述

ttyd-proxy 是一个 TypeScript 全栈项目，提供 Web 终端管理界面：
- **Server** (`server/`): HTTP 代理服务器，提供 API 和 WebSocket 代理到 ttyd
- **Frontend** (`frontend/`): React 19 + TypeScript 前端，使用 Vite 构建
- **Tests** (`tests/`): curl API 测试和 E2E 浏览器测试

### 技术栈
- Server: Node.js + http-proxy + TypeScript (ES2022, ESNext modules)
- Frontend: React 19 + TypeScript + Vite + Tailwind CSS + react-rnd
- 测试: curl + electron-mcp (E2E 自动化)

### 核心功能
- 多终端窗格管理（拖拽、调整大小）
- WebSocket 代理到 ttyd 实例
- 分组管理和布局持久化
- Telegram WebView 模式支持
- 命令面板和全局快捷键

---

## 2. 构建/运行/测试命令

### 2.1 开发环境 (Docker)

```bash
# 启动开发环境（热重载）
docker compose up --build

# 停止
docker compose down

# 查看日志
docker compose logs -f server
docker compose logs -f frontend
```

**访问地址:**
- Frontend: http://localhost:6902
- Server API: http://localhost:6901

### 2.2 Server 命令

```bash
cd server

# 开发模式 (tsx watch 热重载)
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm run start
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

### 2.4 测试命令

```bash
# 运行单个 curl 测试
bash tests/curl/test_health.sh
bash tests/curl/test_ttyd_proxy.sh

# 运行所有 curl 测试
for f in tests/curl/test_*.sh; do bash "$f"; done

# 运行 E2E 测试
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
    resetValue: () => setValue('')
  }));
  
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

## 4. 架构说明

### 4.1 Server 架构

**核心文件:**
- `server/src/index.ts` - 主服务器逻辑
- `server/src/config.ts` - 配置和 API 路径定义

**主要功能:**
1. **认证系统**: 从 `~/personal/global.json` 读取 `api_token`
2. **ttyd 代理**: WebSocket 和 HTTP 代理到 ttyd 实例
3. **Pane 缓存**: 从 FastAPI 获取 pane 配置并缓存
4. **CORS 支持**: 允许跨域请求

**API 端点:**
- `GET /api/health` - 健康检查（无需认证）
- `POST /api/refresh-cache` - 刷新 pane 缓存
- `POST /api/key` - 发送按键到 tmux
- `/ttyd/:name/*` - ttyd 代理（HTTP + WebSocket）

### 4.2 Frontend 架构

**路由系统** (`Router.tsx`):
- Telegram 模式: URL 带 `?token=xxx` → `SinglePaneApp`
- Web 模式: 无 token → `WebTerminalApp`

**主要组件:**
- `WebTerminalApp.tsx` - 多窗格管理主界面
- `SinglePaneApp.tsx` - 单窗格 Telegram 模式
- `GroupCanvas.tsx` - 窗格画布（拖拽、调整大小）
- `GroupSidebar.tsx` - 分组侧边栏
- `CommandPanel.tsx` - 命令面板
- `TtydFrame.tsx` - ttyd iframe 封装

**服务层:**
- `services/apiUrl.ts` - API URL 构建
- `services/mockApi.ts` - API 调用封装

### 4.3 数据流

```
用户操作 → React 组件 → API 调用 → Server → FastAPI/ttyd
                ↓
         状态更新 → 重新渲染
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

### 5.4 测试要求

- 所有 API 变更必须有对应的 curl 测试
- 所有 UI 变更必须有对应的 E2E 测试
- 测试必须可重复运行
- 测试脚本必须有明确的 PASS/FAIL 输出

---

## 6. 环境变量

### Server 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 6901 | Server 端口 |
| `NODE_ENV` | development | 环境 |
| `CORS_ORIGIN` | * | CORS 允许的源 |
| `FASTAPI_URL` | http://127.0.0.1:14444 | FastAPI 后端地址 |
| `HOST_IP` | host.docker.internal | ttyd 主机 IP |

### Frontend 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | development | 环境 |
| `VITE_API_URL` | - | API 地址（可选） |

---

## 7. 目录结构

```
ttyd-proxy/
├── server/
│   ├── src/
│   │   ├── index.ts       # 主服务器代码
│   │   └── config.ts      # 配置和 API 路径
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── Dockerfile.dev
├── frontend/
│   ├── src/
│   │   ├── components/    # React 组件
│   │   │   ├── GroupCanvas.tsx
│   │   │   ├── GroupSidebar.tsx
│   │   │   ├── CommandPanel.tsx
│   │   │   ├── TtydFrame.tsx
│   │   │   ├── EditPaneDialog.tsx
│   │   │   ├── FloatingPanel.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   └── ...
│   │   ├── services/      # API 服务
│   │   │   ├── apiUrl.ts
│   │   │   └── mockApi.ts
│   │   ├── utils/         # 工具函数
│   │   │   └── autoGrid.ts
│   │   ├── types.ts       # 类型定义
│   │   ├── Router.tsx     # 路由
│   │   ├── WebTerminalApp.tsx  # Web 模式主应用
│   │   ├── SinglePaneApp.tsx   # Telegram 模式
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   └── index.html
├── tests/
│   ├── curl/              # API 测试
│   │   ├── test_health.sh
│   │   └── test_ttyd_proxy.sh
│   └── e2e/               # 浏览器 E2E 测试
│       ├── lib.sh
│       ├── test_login.sh
│       └── test_create_pane.sh
├── DOCS/
│   ├── TDD.md            # TDD 开发规范
│   ├── ARCHITECTURE.md
│   └── DEVELOPMENT.md
├── docker-compose.yml
└── README.md
```

---

## 8. 开发工作流

### 8.1 添加新功能

1. **规划**: 确定功能需求和 API 设计
2. **Server 变更**:
   - 编写 curl 测试 (`tests/curl/test_<feature>.sh`)
   - 实现 API 端点 (`server/src/index.ts`)
   - 运行测试验证
3. **Frontend 变更**:
   - 编写 E2E 测试 (`tests/e2e/test_<feature>.sh`)
   - 实现 UI 组件
   - 运行测试验证
4. **集成测试**: 运行所有测试确保无回归

### 8.2 修复 Bug

1. **重现**: 编写失败的测试用例
2. **修复**: 修改代码使测试通过
3. **验证**: 运行全量测试

### 8.3 热重载开发

**Server 热重载:**
- 修改 `server/src/*.ts` → tsx watch 自动重启
- 查看日志: `docker compose logs -f server`

**Frontend 热重载:**
- 修改 `frontend/src/**/*` → Vite HMR 自动更新
- 浏览器自动刷新（或手动刷新）

---

## 9. 禁止行为

- 跳过测试直接 commit
- 仅手动点击验证，不写 E2E 测试脚本
- 使用 `git commit --no-verify` 绕过 hook
- 注释掉失败的测试来通过 CI
- 测试脚本中包含真实 token 明文（必须从 global.json 读取）
- 修改代码不更新相关文档

---

## 10. 常用命令速查

```bash
# 检查服务健康
curl http://localhost:6901/api/health

# 获取 token
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")

# 运行单个测试
bash tests/curl/test_health.sh
bash tests/e2e/test_login.sh

# 查看容器日志
docker compose logs -f server
docker compose logs -f frontend

# 重启服务
docker compose restart server
docker compose restart frontend

# 重新构建
docker compose up --build -d
```

---

## 11. 相关文档

- [DOCS/TDD.md](./DOCS/TDD.md) - TDD 开发规范
- [DOCS/ARCHITECTURE.md](./DOCS/ARCHITECTURE.md) - 架构说明
- [DOCS/DEVELOPMENT.md](./DOCS/DEVELOPMENT.md) - 开发指南
- [README.md](./README.md) - 项目概述

---

## 12. 常见问题

### Q: 如何添加新的 API 端点？

1. 在 `server/src/config.ts` 的 `API_PATHS` 中定义路径
2. 在 `server/src/index.ts` 中实现处理逻辑
3. 编写 curl 测试验证

### Q: 如何添加新的 React 组件？

1. 在 `frontend/src/components/` 创建 `.tsx` 文件
2. 使用 PascalCase 命名
3. 导出为命名导出或默认导出
4. 在父组件中导入使用

### Q: 热重载不工作怎么办？

- 检查 Docker 卷挂载是否正确
- 查看容器日志是否有错误
- 确认文件保存成功
- 尝试重启容器

### Q: 测试失败怎么办？

- 检查服务是否正常运行
- 确认 token 配置正确
- 查看详细错误信息
- 检查 API 端点是否变更
