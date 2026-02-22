# ttyd-proxy 开发 / 测试 / 部署规范

> 最后更新: 2026-02-22

## 1. 前置条件

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Docker + Docker Compose | ≥ 24.x | 所有服务均容器化 |
| FastAPI | 运行中 (port 14444) | 必须先启动，前端依赖其 API |
| tmux | 运行中 | FastAPI 管理的 tmux 服务器 |
| Node.js | ≥ 18.x | 本地开发（可选） |

## 2. 开发环境启动

```bash
cd /home/w3c_offical/projects/ai-workers/ttyd-proxy

# 启动全部服务（server + frontend，含热重载）
docker compose up

# 仅重建并启动（修改了 Dockerfile 或 package.json 后）
docker compose up --build

# 后台运行
docker compose up -d
```

**服务访问地址：**

| 服务 | 本地地址 | 说明 |
|------|---------|------|
| Frontend (Vite HMR) | http://localhost:6902 | React 开发服务器 |
| Server (代理) | http://localhost:6901 | ttyd 代理服务器 |

### 2.1 环境变量

**Server 环境变量（docker-compose.yml）：**
```yaml
environment:
  - NODE_ENV=development
  - PORT=6901
  - CHOKIDAR_USEPOLLING=true
  - FASTAPI_URL=http://127.0.0.1:14444
  - HOST_IP=host.docker.internal
  - CORS_ORIGIN=*
```

**Frontend 环境变量（frontend/.env）：**
```env
# 可选，默认使用相对路径
VITE_API_URL=http://localhost:6901
```

### 2.2 热重载机制

- **Frontend**：Vite HMR，修改任意 `frontend/src/**` 文件后浏览器自动更新，无需重启
- **Server**：`tsx watch`，修改 `server/src/**/*.ts` 后进程自动重启（约 1s）
- 两者均通过 Docker volume bind mount 实现，无需进入容器操作

**Volume 挂载：**
```yaml
server:
  volumes:
    - ./server/src:/app/src:ro
    - ./server/package.json:/app/package.json:ro

frontend:
  volumes:
    - ./frontend/src:/app/src:ro
    - ./frontend/index.html:/app/index.html:ro
    - ./frontend/vite.config.ts:/app/vite.config.ts:ro
    - ./frontend/tailwind.config.js:/app/tailwind.config.js:ro
    - ./frontend/postcss.config.js:/app/postcss.config.js:ro
    - ./frontend/.env:/app/.env:ro
```

### 2.3 查看日志

```bash
# 全部日志（实时）
docker compose logs -f

# 仅 server 日志
docker compose logs -f server

# 仅 frontend 日志
docker compose logs -f frontend
```

## 3. 代码规范

### 3.1 Frontend（React/TypeScript）

**文件组织：**
- 页面级组件：`src/WebTerminalApp.tsx`、`src/SinglePaneApp.tsx`
- 通用组件：`src/components/`
- API/工具：`src/services/`
- 类型定义：`src/types.ts`
- 工具函数：`src/utils/`

**API 调用规范：**
```typescript
// 使用 getApiUrl() 构建完整 URL
import { getApiUrl } from './services/apiUrl';

const res = await fetch(getApiUrl('/api/groups'), {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
  },
});
```

**ttyd iframe URL：**
```typescript
// 通过 Server 代理访问 ttyd
const ttydUrl = `${getApiUrl('')}/ttyd/${pane.name}/?token=${token}`;
<TtydFrame url={ttydUrl} />
```

**组件规范：**
- 使用函数组件 + Hooks
- Props 使用 TypeScript 接口定义
- 使用 `forwardRef` 处理 ref 转发
- 使用 `React.memo` 优化性能

**状态管理：**
- 使用 `useState` 管理本地状态
- 使用 `useEffect` 处理副作用
- 使用 `useCallback` 缓存回调函数
- 使用 `useMemo` 缓存计算结果

### 3.2 Server（TypeScript/Node.js）

Server 只保留 ttyd 代理逻辑，**不要在 server 中添加业务 API**，所有业务逻辑统一放 FastAPI。

**修改 server 后验证：**
```bash
# TypeScript 类型检查
cd server && npx tsc --noEmit

# 检查 server 重启日志
docker compose logs server | tail -20
```

**代码规范：**
- 使用 ES modules（`import/export`）
- 使用 `async/await` 处理异步操作
- 使用 `try/catch` 捕获错误
- 使用 `console.log` 记录关键信息
- 使用 `console.error` 记录错误

### 3.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `group-canvas.tsx`, `api-url.ts` |
| 组件 | PascalCase | `GroupCanvas`, `TtydFrame` |
| 接口/类型 | PascalCase | `PaneConfig`, `Position` |
| 函数/变量 | camelCase | `handleClick`, `isLoading` |
| 常量 | UPPER_SNAKE | `API_PATHS`, `PORT` |

## 4. 测试

### 4.1 curl API 测试

```bash
# 健康检查（无需认证）
bash tests/curl/test_health.sh

# ttyd 代理测试（需认证）
bash tests/curl/test_ttyd_proxy.sh

# 运行所有 curl 测试
for f in tests/curl/test_*.sh; do bash "$f"; done
```

### 4.2 E2E 测试

```bash
# 登录流程测试
bash tests/e2e/test_login.sh

# 创建窗格测试
bash tests/e2e/test_create_pane.sh

# 运行所有 E2E 测试
for f in tests/e2e/test_*.sh; do bash "$f"; done
```

### 4.3 手动 API 测试

```bash
# 获取 token
TOKEN=$(python3 -c "import json; print(json.load(open('/home/w3c_offical/global.json'))['api_token'])")

# 健康检查
curl http://localhost:6901/api/health

# 刷新缓存
curl -X POST http://localhost:6901/api/refresh-cache \
  -H "Authorization: Bearer $TOKEN"

# 测试 ttyd 代理（需要有活跃的 pane）
curl -o /dev/null -w "%{http_code}" \
  "http://localhost:6901/ttyd/{pane_name}/?token=$TOKEN"
```

### 4.4 功能验证清单

**每次修改 WebTerminalApp 后验证：**
- [ ] 登录功能正常
- [ ] 分组列表加载正常
- [ ] 创建新分组成功
- [ ] 切换分组正常
- [ ] 添加窗格成功，iframe 正确加载终端
- [ ] 拖拽窗格位置正常
- [ ] 调整窗格大小正常
- [ ] 编辑窗格信息成功
- [ ] 删除窗格成功
- [ ] 命令面板（Ctrl+K）正常
- [ ] 刷新页面后状态保持

**每次修改 Server 后验证：**
- [ ] 健康检查返回 200
- [ ] ttyd 代理返回 200（不是 401）
- [ ] WebSocket 连接正常
- [ ] 缓存刷新功能正常

### 4.5 常见问题排查

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| iframe 显示 401 | token 验证失败 | 检查 localStorage token，确认 master token 正确 |
| iframe 无法连接 | ttyd 未启动 | 检查 FastAPI 日志，确认 ttyd 进程运行 |
| Server 代理失败 | pane 缓存过期 | 调用 `/api/refresh-cache` 刷新缓存 |
| 热重载不工作 | Volume 挂载问题 | 检查 docker-compose.yml volume 配置 |
| 端口冲突 | 端口被占用 | 使用 `lsof -i :6901` 查找占用进程 |

## 5. 生产部署

### 5.1 构建生产镜像

```bash
# 构建 server 生产镜像
cd server
docker build -t ttyd-proxy-server:latest .

# 构建 frontend 生产镜像
cd frontend
docker build -t ttyd-proxy-frontend:latest .
```

### 5.2 生产环境配置

**生产 vs 开发区别：**

| | 开发 | 生产 |
|-|------|------|
| Frontend | Vite dev server (HMR) | Nginx 静态文件服务 |
| Server | tsx watch（自动重启） | tsc 编译后 node dist/ |
| 端口映射 | 6902（frontend）, 6901（server） | 80（Nginx）, 6901（server） |
| Volume | bind mount（实时同步） | 无 bind mount |
| 环境变量 | development | production |

### 5.3 服务状态检查

```bash
# 检查容器状态
docker ps | grep ttyd-proxy

# 检查 server 健康
curl http://localhost:6901/api/health

# 检查 frontend 可访问
curl -o /dev/null -w "%{http_code}" http://localhost:6902/
```

## 6. 常用开发命令

```bash
# 进入 server 容器 shell
docker compose exec server sh

# 进入 frontend 容器 shell
docker compose exec frontend sh

# 安装新的 server 依赖（修改 package.json 后需重建）
cd server && npm install
docker compose up --build server

# 安装新的 frontend 依赖
cd frontend && npm install
docker compose up --build frontend

# 停止所有服务
docker compose down

# 停止并删除 volumes
docker compose down -v

# 查看容器资源使用
docker stats
```

## 7. Git 工作流

```bash
# 查看状态
git status

# 提交代码
git add .
git commit -m "feat: 描述新功能"
git commit -m "fix: 描述修复的问题"
git commit -m "docs: 更新文档"

# 推送到远程
git push origin main
```

**Commit 消息规范：**
- `feat:` - 新功能
- `fix:` - 修复 bug
- `docs:` - 文档更新
- `style:` - 代码格式调整
- `refactor:` - 重构代码
- `test:` - 测试相关
- `chore:` - 构建/工具相关

**.gitignore 应包含：**
```
node_modules/
dist/
.env.local
*.log
.DS_Store
```

## 8. 性能优化

### 8.1 Frontend 优化

- 使用 `React.memo` 避免不必要的重渲染
- 使用 `useCallback` 缓存回调函数
- 使用 `useMemo` 缓存计算结果
- 使用虚拟滚动处理大量窗格
- 使用防抖（debounce）减少 API 调用

### 8.2 Server 优化

- 使用内存缓存减少 FastAPI 调用
- 使用连接池管理 HTTP 连接
- 使用 gzip 压缩响应
- 使用 CDN 加速静态资源

### 8.3 网络优化

- 使用 WebSocket 保持长连接
- 使用 HTTP/2 多路复用
- 使用浏览器缓存
- 使用预加载（preload）关键资源

## 9. 安全最佳实践

### 9.1 认证与授权

- 使用 HTTPS 传输敏感数据
- Token 存储在 localStorage，不要存储在 cookie
- 定期刷新 token
- 实现 token 过期机制

### 9.2 输入验证

- 验证所有用户输入
- 使用 TypeScript 类型检查
- 使用正则表达式验证格式
- 防止 XSS 攻击

### 9.3 CORS 配置

- 生产环境限制 CORS 来源
- 不要使用 `Access-Control-Allow-Origin: *`
- 使用白名单机制

### 9.4 日志与监控

- 记录关键操作日志
- 不要记录敏感信息（token、密码）
- 使用日志聚合工具
- 设置告警机制

## 10. 故障排查

### 10.1 日志查看

```bash
# Server 日志
docker compose logs -f server

# Frontend 日志
docker compose logs -f frontend

# 最近 100 行日志
docker compose logs --tail=100 server

# 浏览器控制台
打开开发者工具 → Console 标签
```

### 10.2 调试技巧

**Frontend 调试：**
- 使用 React DevTools 查看组件状态
- 使用 Chrome DevTools Network 查看网络请求
- 使用 Console 输出调试信息
- 使用断点调试

**Server 调试：**
- 使用 `console.log` 输出调试信息
- 使用 `console.error` 输出错误信息
- 查看 Docker 日志
- 使用 curl 测试 API

### 10.3 性能分析

```bash
# 查看容器资源使用
docker stats

# 查看进程列表
docker compose exec server ps aux

# 查看端口监听
docker compose exec server netstat -tlnp
```

## 11. 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 架构说明
- [TDD.md](./TDD.md) - TDD 开发规范
- [AGENTS.md](../AGENTS.md) - AI Agent 开发规范
- [README.md](../README.md) - 项目概述
