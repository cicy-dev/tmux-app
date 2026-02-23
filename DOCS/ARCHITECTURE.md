# ttyd-proxy 架构文档

> 最后更新: 2026-02-22

## 1. 项目定位

ttyd-proxy 是一个基于浏览器的多终端管理界面，提供：
- 在浏览器中通过 WebSocket 连接 tmux pane（由 ttyd 驱动）
- 统一的 Token 认证代理层
- React 前端：分组管理、窗格拖拽调整、布局持久化
- 支持 Telegram WebView 单窗格模式和 Web 多窗格模式

## 2. 服务组成

```
┌─────────────────────────────────────────────────────────┐
│                   外部访问                               │
│                                                         │
│  Frontend  →  localhost:6902                           │
│  Server    →  localhost:6901                           │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌──────────────────────┐
│   Frontend      │      │   Server (Proxy)     │
│  React 19 + Vite│      │  Node.js / TypeScript│
│  port: 6902     │      │  port: 6901          │
│  HMR dev server │      │  tsx watch           │
└─────────────────┘      └──────────────────────┘
         │                          │
         │   API calls              │  ttyd WebSocket proxy
         ▼                          ▼
┌──────────────────────────────────────────────┐
│              FastAPI Backend                 │
│          Python / FastAPI                    │
│          port: 14444                         │
└──────────────────────────────────────────────┘
                   │
                   │  tmux socket
                   ▼
┌──────────────────────────────────────────────┐
│          Host: tmux + ttyd 进程              │
│  ttyd -W -p {port} -c user:{token}           │
│  tmux attach -t session:window.pane          │
└──────────────────────────────────────────────┘
```

## 3. 子服务详解

### 3.1 Frontend（port 6902）

- **技术栈**：React 19 + TypeScript + Vite + Tailwind CSS + react-rnd
- **入口**：`frontend/src/main.tsx` → `Router.tsx`
- **主要页面**：
  - Telegram 模式（URL 带 `?token=xxx`）→ `SinglePaneApp.tsx`：单窗格终端视图
  - Web 模式（无 token 参数）→ `WebTerminalApp.tsx`：多窗格管理主界面

**WebTerminalApp 核心功能：**
- 分组管理（GroupSidebar）：创建/切换/删除分组
- 窗格画布（GroupCanvas）：拖拽、调整大小、自动布局
- 命令面板（CommandPanel）：快捷键 Ctrl+K 唤起
- 窗格操作：创建、编辑、删除、重启
- 布局持久化：保存到 FastAPI 后端

**主要组件：**
- `GroupCanvas.tsx` - 窗格画布，使用 react-rnd 实现拖拽和调整大小
- `GroupSidebar.tsx` - 分组侧边栏
- `CommandPanel.tsx` - 命令面板（搜索、快捷操作）
- `TtydFrame.tsx` - ttyd iframe 封装
- `EditPaneDialog.tsx` - 窗格编辑对话框
- `FloatingPanel.tsx` - 浮动面板容器
- `LoginForm.tsx` - 登录表单

**服务层：**
- `services/apiUrl.ts` - API URL 构建工具
- `services/mockApi.ts` - API 调用封装

**认证**：所有 API 请求携带 `Authorization: Bearer {token}`，token 存储于 localStorage。

### 3.2 Server（port 6901）

- **技术栈**：Node.js + TypeScript（ESM）+ http-proxy
- **入口**：`server/src/index.ts`
- **配置**：`server/src/config.ts` - API 路径和环境变量
- **核心职责**：ttyd WebSocket/HTTP 代理

**请求处理流程（`/ttyd/{name}/`）：**
```
1. 解析 name（URL path segment）
2. 提取 queryToken（?token=...）
3. 从缓存获取 pane 配置（port + token）
4. 验证 token：queryToken 必须等于 master token
5. 重写 Authorization 为 Basic user:{ttyd_token}
6. HTTP proxy.web → http://{HOST_IP}:{port}
   WebSocket proxy.ws → ws://{HOST_IP}:{port}
```

**API 端点：**
- `GET /api/health` — 健康检查（返回版本号，无需认证）
- `POST /api/refresh-cache` — 刷新 pane 缓存（需认证）
- `POST /api/key` — 发送按键到 tmux（需认证）
- `/ttyd/:name/*` — ttyd HTTP + WebSocket 代理（核心功能）

**Token 验证规则：**
- master token（来自 `~/personal/global.json`）= 任意 pane 均可访问
- 查询参数 token 必须匹配 master token

**Pane 缓存机制：**
- 启动时从 FastAPI `/api/ttyd/list` 加载所有 pane 配置
- 缓存结构：`{ [name: string]: { port: number, token: string } }`
- 可通过 `/api/refresh-cache` 手动刷新

### 3.3 配置文件（server/src/config.ts）

**环境变量：**
```typescript
export const config = {
  fastApiBaseUrl: process.env.FASTAPI_URL || 'http://127.0.0.1:14444',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 6901,
  hostIp: process.env.HOST_IP || 'host.docker.internal',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
```

**API 路径定义：**
- TMUX 相关：`/api/tmux`, `/api/tmux/create`, `/api/tmux/send`, `/api/tmux/capture_pane`
- TTYD 相关：`/api/ttyd/list`, `/api/ttyd/start/{paneId}`, `/api/ttyd/config/{paneId}`
- 分组相关：`/api/groups`, `/api/groups/{groupId}`, `/api/groups/{groupId}/layout`
- 认证：`/api/auth/verify`

## 4. 数据流

### 4.1 Web 模式启动流程

```
1. 用户访问 http://localhost:6902
2. Router.tsx 检测无 token 参数 → 渲染 WebTerminalApp
3. WebTerminalApp 从 localStorage 读取 token
4. 如无 token → 显示 LoginForm
5. 登录成功 → 保存 token → 加载分组列表
6. 从 FastAPI 获取分组和窗格配置
7. 渲染 GroupSidebar + GroupCanvas
```

### 4.2 Telegram 模式启动流程

```
1. 用户访问 http://localhost:6902?token=xxx
2. Router.tsx 检测到 token 参数 → 渲染 SinglePaneApp
3. SinglePaneApp 直接显示单个终端窗格
4. 通过 Server 代理连接到 ttyd
```

### 4.3 创建窗格流程

```
Frontend: 用户点击"添加窗格"
    → 打开 EditPaneDialog
    → 填写 name, title, workspace 等
    → POST /api/groups/{groupId}/panes
FastAPI: 创建 tmux pane
    → 分配端口
    → 生成 ttyd_token
    → 启动 ttyd 进程
    → 保存配置到数据库
    → 返回 pane 配置
Frontend: 更新状态
    → 在 GroupCanvas 中渲染新窗格
    → iframe src = /ttyd/{name}/?token={master_token}
Server: 代理请求
    → 验证 token
    → 从缓存获取 port 和 ttyd_token
    → 代理到 ttyd:{port}
```

### 4.4 拖拽调整布局流程

```
用户拖拽窗格 → react-rnd onDragStop
    → 更新本地状态（position）
    → 防抖后调用 PATCH /api/groups/{groupId}/panes/{paneId}/layout
    → FastAPI 保存布局到数据库
    → 返回成功

用户调整窗格大小 → react-rnd onResizeStop
    → 更新本地状态（size）
    → 防抖后调用 PATCH /api/groups/{groupId}/panes/{paneId}/layout
    → FastAPI 保存布局到数据库
    → 返回成功
```

## 5. 目录结构

```
ttyd-proxy/
├── docker-compose.yml    # 开发环境配置

├── frontend/
│   ├── src/
│   │   ├── main.tsx      # 入口
│   │   ├── Router.tsx    # 路由配置
│   │   ├── WebTerminalApp.tsx  # Web 模式主界面
│   │   ├── SinglePaneApp.tsx   # Telegram 模式
│   │   ├── types.ts      # 类型定义
│   │   ├── components/   # UI 组件
│   │   │   ├── GroupCanvas.tsx
│   │   │   ├── GroupSidebar.tsx
│   │   │   ├── CommandPanel.tsx
│   │   │   ├── TtydFrame.tsx
│   │   │   ├── EditPaneDialog.tsx
│   │   │   ├── FloatingPanel.tsx
│   │   │   ├── LoginForm.tsx
│   │   │   ├── IframeTopbar.tsx
│   │   │   ├── PanePicker.tsx
│   │   │   ├── GlobalPromptBar.tsx
│   │   │   └── ...
│   │   ├── services/     # API 服务
│   │   │   ├── apiUrl.ts
│   │   │   └── mockApi.ts
│   │   └── utils/        # 工具函数
│   │       └── autoGrid.ts
│   ├── vite.config.ts    # Vite 配置
│   ├── tailwind.config.js
│   ├── package.json
│   ├── Dockerfile        # 生产镜像
│   └── index.html
├── tests/
│   ├── curl/             # API 测试
│   │   ├── test_health.sh
│   │   └── test_ttyd_proxy.sh
│   └── e2e/              # 浏览器 E2E 测试
│       ├── lib.sh
│       ├── test_login.sh
│       └── test_create_pane.sh
└── DOCS/
    ├── ARCHITECTURE.md   # 本文档
    ├── DEVELOPMENT.md    # 开发规范
    └── TDD.md            # TDD 开发规范
```

## 6. 外部依赖

| 依赖 | 用途 | 端口 |
|-----|------|------|
| FastAPI | 所有业务 API（tmux、ttyd、分组管理） | 14444 |
| ttyd | 终端 Web 服务，由 FastAPI 在 host 上启动 | 动态分配 |
| tmux | 会话管理 | - |
| MySQL | 配置持久化（由 FastAPI 维护） | 3306 |

## 7. 认证与安全

### 7.1 Token 体系

| Token 类型 | 来源 | 用途 |
|-----------|------|------|
| Master Auth Token | `~/personal/global.json` 的 `api_token` | API 认证（Bearer）+ ttyd 代理访问 |
| pane ttyd_token | FastAPI 生成，存入数据库 | ttyd 进程 `-c user:{token}` 认证 |

### 7.2 认证流程

**Frontend → FastAPI:**
```
Authorization: Bearer {master_token}
```

**Frontend → Server → ttyd:**
```
1. Frontend: iframe src = /ttyd/{name}/?token={master_token}
2. Server: 验证 queryToken === master_token
3. Server: 从缓存获取 pane 的 ttyd_token
4. Server: 重写 Authorization = Basic user:{ttyd_token}
5. Server: 代理到 ttyd:{port}
```

### 7.3 CORS 配置

Server 允许所有来源（`Access-Control-Allow-Origin: *`），生产环境建议限制为特定域名。

## 8. 性能优化

### 8.1 Pane 缓存

- Server 启动时加载所有 pane 配置到内存
- 避免每次代理请求都调用 FastAPI
- 可通过 `/api/refresh-cache` 手动刷新

### 8.2 布局保存防抖

- 拖拽和调整大小时使用防抖（debounce）
- 避免频繁调用 API 保存布局
- 默认延迟 500ms

### 8.3 React 优化

- 使用 `React.memo` 避免不必要的重渲染
- 使用 `useCallback` 和 `useMemo` 缓存函数和计算结果
- 窗格列表使用 key 优化渲染

## 9. 故障排查

### 9.1 常见问题

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| iframe 显示 401 | token 验证失败 | 检查 localStorage token 是否正确 |
| iframe 无法连接 | ttyd 未启动或端口错误 | 检查 FastAPI 日志，确认 ttyd 进程运行 |
| 窗格拖拽不流畅 | 浏览器性能问题 | 减少同时显示的窗格数量 |
| 布局保存失败 | FastAPI 连接失败 | 检查网络连接和 FastAPI 状态 |
| Server 代理失败 | pane 缓存过期 | 调用 `/api/refresh-cache` 刷新缓存 |

### 9.2 日志查看

```bash
# Server 日志
docker compose logs -f server

# Frontend 日志
docker compose logs -f frontend

# 浏览器控制台
打开开发者工具 → Console 标签
```

### 9.3 健康检查

```bash
# Server 健康检查
curl http://localhost:6901/api/health

# 预期输出
{"success":true,"version":"1.0.3","timestamp":"2026-02-22T09:00:00.000Z"}
```
