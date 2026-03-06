# IDE 重构方案

## 现状问题

| 问题 | 详情 |
|---|---|
| SinglePaneApp.tsx 过大 | 1884 行，60 个 useState，承担所有职责 |
| 域名硬编码 | 6 个域名散落在 6 个文件中，无法切换环境 |
| API 调用混乱 | 20+ 处直接 fetch，无统一错误处理 |
| 状态管理分散 | dialog、pane、voice 状态全堆在一个组件 |
| 样式不统一 | tailwind class 和 inline style 混用 |

## 目标架构

```
ide/src/
├── config.ts                       # 集中配置（域名、常量）
├── contexts/
│   ├── AppContext.tsx               # 保留：认证、pane 列表、全局设置
│   ├── DialogContext.tsx            # 新增：所有 dialog 状态统一管理
│   ├── PaneContext.tsx              # 新增：当前 pane 工作状态
│   └── VoiceContext.tsx             # 新增：语音录制相关
├── services/
│   ├── api.ts                      # 重写：axios，所有 API 集中
│   ├── tokenManager.ts             # 保留
│   └── paneManager.ts              # 保留
├── components/
│   ├── LeftSidePanel.tsx            # 拆出：左侧 agent 列表
│   ├── MiddlePanel.tsx              # 拆出：终端 + topbar + CommandPanel
│   ├── RightSidePanel.tsx           # 拆出：Code/Agents/Preview/Settings/Global
│   ├── CorrectionPanel.tsx          # 拆出：纠错结果面板
│   ├── HistoryOverlay.tsx           # 拆出：命令历史
│   ├── CommonPromptOverlay.tsx      # 拆出：Common Prompt 编辑
│   ├── CommandPanel.tsx             # 现有：fetch → axios
│   ├── FloatingPanel.tsx            # 现有：不变
│   ├── EditPaneDialog.tsx           # 现有：不变
│   ├── ... 其他现有组件
│   └── dialogs/
│       ├── CreateAgentDialog.tsx    # 拆出：创建 agent
│       ├── DeleteAgentDialog.tsx    # 拆出：删除确认
│       └── DesktopDialog.tsx        # 拆出：远程桌面
├── SinglePaneApp.tsx                # 瘦身：只做布局组装（< 200 行）
├── types.ts                         # 扩展类型定义
└── main.tsx                         # Provider 嵌套
```

删除文件：
- `services/apiUrl.ts` → 合并到 `config.ts`

---

## Phase 1：集中配置 + 消除硬编码域名

### 1.1 创建 `config.ts`

```typescript
const config = {
  apiBase:        import.meta.env.VITE_API_BASE         || 'https://g-fast-api.cicy.de5.net',
  ttydBase:       import.meta.env.VITE_TTYD_BASE        || 'https://ttyd-proxy.cicy.de5.net',
  ideBase:        import.meta.env.VITE_IDE_BASE          || 'https://ide.cicy.de5.net',
  codeServerBase: import.meta.env.VITE_CODE_SERVER_BASE  || 'https://code.cicy.de5.net',
  desktopBase:    import.meta.env.VITE_DESKTOP_BASE      || 'https://desktop.cicy.de5.net',
  sttBase:        import.meta.env.VITE_STT_BASE          || 'https://g-15003.cicy.de5.net',
  pollInterval:   5000,
  version:        '0.0.3',
} as const;

export const urls = {
  ttyd:       (paneId: string, token: string, mode = 1) => `${config.ttydBase}/ttyd/${paneId}/?token=${token}&mode=${mode}`,
  ttydOpen:   (paneId: string, token: string)            => `${config.ttydBase}/ttyd/${paneId}/?token=${token}`,
  codeServer: (folder: string)                           => `${config.codeServerBase}/?folder=${encodeURIComponent(folder)}`,
  desktop:    (token: string)                            => `${config.desktopBase}/?token=${token}`,
  idePane:    (paneId: string, token: string)            => `${config.ideBase}/ttyd/${paneId}/?token=${token}`,
  stt:        ()                                         => `${config.sttBase}/stt`,
};

export default config;
```

### 1.2 创建 `.env` 文件

```bash
# ide/.env
VITE_API_BASE=https://g-fast-api.cicy.de5.net
VITE_TTYD_BASE=https://ttyd-proxy.cicy.de5.net
VITE_IDE_BASE=https://ide.cicy.de5.net
VITE_CODE_SERVER_BASE=https://code.cicy.de5.net
VITE_DESKTOP_BASE=https://desktop.cicy.de5.net
VITE_STT_BASE=https://g-15003.cicy.de5.net
```

### 1.3 替换所有硬编码域名

| 文件 | 替换 |
|---|---|
| SinglePaneApp.tsx | 6 处硬编码 URL → `urls.xxx()` |
| AppContext.tsx | 2 处 `g-fast-api.cicy.de5.net` → `config.apiBase` |
| AgentsRightView.tsx | 2 处 → `urls.ttyd()` / `urls.idePane()` |
| AgentsListView.tsx | 1 处 → `urls.ttyd()` |
| apiUrl.ts | 删除，引用方改为 import config |

### 1.4 验证

- 所有文件 `grep "cicy.de5.net"` 结果为 0（仅 `.env` 和 `config.ts` 有默认值）

---

## Phase 2：axios 重写 API 层

### 2.1 重写 `services/api.ts`

```typescript
import axios from 'axios';
import config from '../config';

const http = axios.create({ baseURL: config.apiBase });

http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export default {
  // Auth
  verifyToken:      ()                          => http.post('/api/auth/verify-token'),

  // Panes
  getPanes:         ()                          => http.get('/api/tmux'),
  getAllStatus:      ()                          => http.get('/api/tmux/status/all'),
  getPane:          (id: string)                => http.get(`/api/tmux/panes/${id}`),
  updatePane:       (id: string, data: any)     => http.patch(`/api/tmux/panes/${id}`, data),
  deletePane:       (id: string)                => http.delete(`/api/tmux/panes/${id}`),
  createPane:       (data: any)                 => http.post('/api/tmux/create', data),
  restartPane:      (id: string)                => http.post(`/api/tmux/panes/${id}/restart`),
  capturePane:      (id: string)                => http.get('/api/tmux/capture_pane', { params: { pane_id: id } }),

  // Tmux operations
  sendCommand:      (winId: string, keys: string) => http.post('/api/tmux/send', { win_id: winId, keys }),
  sendKeys:         (winId: string, keys: string) => http.post('/api/tmux/send-keys', { win_id: winId, keys }),
  toggleMouse:      (mode: string, paneId: string) => http.post(`/api/tmux/mouse/${mode}`, null, { params: { pane_id: paneId } }),
  chooseSession:    (id: string)                => http.post(`/api/tmux/panes/${id}/choose-session`),
  splitPane:        (id: string, dir: string)   => http.post(`/api/tmux/panes/${id}/split`, null, { params: { direction: dir } }),
  unsplitPane:      (id: string)                => http.post(`/api/tmux/panes/${id}/unsplit`),

  // Agents
  deleteAgent:      (id: string)                => http.delete(`/api/agents/${id}`),
  getAgentsByPane:  (id: string)                => http.get(`/api/agents/pane/${id}`),

  // TTYD
  getTtydConfig:    (id: string)                => http.get(`/api/ttyd/config/${id}`),
  updateTtydConfig: (id: string, data: any)     => http.put(`/api/ttyd/config/${id}`, data),
  getTtydStatus:    (id: string)                => http.get(`/api/ttyd/status/${id}`),

  // Utils
  correctEnglish:   (text: string)              => http.post('/api/correctEnglish', { text }),
  fileExists:       (path: string)              => http.get('/api/utils/file/exists', { params: { path } }),

  // Global settings
  getGlobalSettings:    ()                      => http.get('/api/settings/global'),
  updateGlobalSettings: (data: any)             => http.post('/api/settings/global', data),
};
```

### 2.2 全局替换 fetch 调用

涉及文件：
- `SinglePaneApp.tsx` — 19 处 fetch
- `CommandPanel.tsx` — 7 处 fetch
- `AppContext.tsx` — 2 处 fetch

替换模式：
```
// 之前
const res = await fetch(getApiUrl('/api/tmux/send'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ win_id: paneTarget, keys: v })
});

// 之后
await api.sendCommand(paneTarget, v);
```

### 2.3 删除 `apiUrl.ts`

所有 `getApiUrl()` / `API_BASE` 引用改为 `config.apiBase` 或 `api.xxx()`。

### 2.4 验证

- `grep -r "fetch(" ide/src/` 结果为 0（仅 STT 的 FormData 上传可能保留原生 fetch）
- `grep -r "getApiUrl\|apiUrl" ide/src/` 结果为 0

---

## Phase 3：DialogContext — 统一 dialog 管理

### 3.1 创建 `contexts/DialogContext.tsx`

```typescript
type DialogType = 'createAgent' | 'deleteAgent' | 'desktop' | 'addAgent' | 'removeConfirm' | null;

interface DialogContextType {
  activeDialog: DialogType;
  dialogData: any;
  openDialog: (type: DialogType, data?: any) => void;
  closeDialog: () => void;
}
```

### 3.2 所有 dialog 用 ReactDOM.createPortal 渲染到 body

```typescript
// DialogContext.tsx 的 Provider 内部
return (
  <DialogContext.Provider value={value}>
    {children}
    {activeDialog && ReactDOM.createPortal(
      <div style={{position: 'fixed', inset: 0, zIndex: 9999999, ...}}>
        {activeDialog === 'createAgent' && <CreateAgentDialog />}
        {activeDialog === 'deleteAgent' && <DeleteAgentDialog data={dialogData} />}
        {activeDialog === 'desktop'     && <DesktopDialog />}
        ...
      </div>,
      document.body
    )}
  </DialogContext.Provider>
);
```

### 3.3 迁移 dialog

| 来源 | dialog | 目标 |
|---|---|---|
| LeftSidePanel | createDialog | `dialogs/CreateAgentDialog.tsx` |
| LeftSidePanel | deleteConfirm | `dialogs/DeleteAgentDialog.tsx` |
| SinglePaneApp | showDesktopDialog | `dialogs/DesktopDialog.tsx` |
| SinglePaneApp | showAddPanel | 复用 AgentsRightView |
| SinglePaneApp | showRemoveConfirm | 复用 ConfirmDialog |

### 3.4 清理

从 SinglePaneApp 和 LeftSidePanel 删除所有 dialog 相关的 useState。

---

## Phase 4：PaneContext — 当前 pane 工作状态

### 4.1 创建 `contexts/PaneContext.tsx`

从 SinglePaneApp 提取以下状态：

```typescript
interface PaneContextType {
  // 布局
  ttydWidth: number;
  setTtydWidth: (w: number) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  isInteracting: boolean;
  setIsInteracting: (v: boolean) => void;

  // Tab
  activeTab: 'Code' | 'Agents' | 'Preview' | 'Settings' | 'Global';
  setActiveTab: (tab: string) => void;

  // Agent 状态
  agentStatus: string;
  contextUsage: any;
  mouseMode: string;
  readOnly: boolean;
  setReadOnly: (v: boolean) => void;

  // Agent tabs
  agentTabs: AgentTab[];
  setAgentTabs: (tabs: AgentTab[]) => void;
  activeAgentTab: string;
  setActiveAgentTab: (id: string) => void;

  // 已访问 panes（保持 iframe 加载）
  visitedPanes: string[];

  // Settings
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;

  // 操作
  handleRestart: () => Promise<void>;
  handleCapturePane: (paneId: string, lines?: number) => Promise<void>;
  handleToggleMouse: () => Promise<void>;
}
```

### 4.2 SinglePaneApp 瘦身

删除约 40 个 useState，改为 `const { ... } = usePane()`。

---

## Phase 5：拆分组件文件

### 5.1 从 SinglePaneApp 拆出

| 组件 | 预估行数 | 内容 |
|---|---|---|
| `LeftSidePanel.tsx` | ~180 | agent 列表、搜索、pin |
| `MiddlePanel.tsx` | ~400 | 终端 iframe、topbar、dropdown menu、CommandPanel |
| `RightSidePanel.tsx` | ~250 | Code/Agents/Preview/Settings/Global 五个 tab |
| `CorrectionPanel.tsx` | ~100 | 英文纠错结果展示 |
| `HistoryOverlay.tsx` | ~50 | 命令历史列表 |
| `CommonPromptOverlay.tsx` | ~50 | Common Prompt 编辑器 |

### 5.2 SinglePaneApp 最终形态

```tsx
const App = () => {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) return <LoginForm />;

  return (
    <PaneProvider>
      <VoiceProvider>
        <DialogProvider>
          <MainLayout />
        </DialogProvider>
      </VoiceProvider>
    </PaneProvider>
  );
};

const MainLayout = () => (
  <div className="relative w-screen h-screen overflow-hidden font-sans">
    <div id="main" className="fixed inset-0">
      <LeftSidePanel />
      <DragHandle />
      <MiddlePanel />
      <RightSidePanel />
    </div>
  </div>
);
```

---

## Phase 6：VoiceContext — 语音相关

### 6.1 创建 `contexts/VoiceContext.tsx`

```typescript
interface VoiceContextType {
  isListening: boolean;
  voiceMode: 'append' | 'direct';
  startRecording: (mode: 'append' | 'direct') => void;
  stopRecording: (shouldSend: boolean) => void;
}
```

从 SinglePaneApp 提取语音录制逻辑（约 80 行）。

---

## 执行计划

| Phase | 内容 | 预估工作量 | 依赖 |
|---|---|---|---|
| 1 | config.ts + 消除硬编码域名 | 小 | 无 |
| 2 | axios 重写 API 层 | 中 | Phase 1 |
| 3 | DialogContext | 中 | 无 |
| 4 | PaneContext | 大 | Phase 2 |
| 5 | 拆分组件文件 | 大 | Phase 3 + 4 |
| 6 | VoiceContext | 小 | Phase 4 |

每个 Phase 完成后独立 commit + 测试，确保不破坏功能。

## 验收标准

- [ ] `grep -r "cicy.de5.net" ide/src/` 仅出现在 `config.ts` 默认值
- [ ] `grep -r "fetch(" ide/src/` 结果为 0（除 STT FormData 上传）
- [ ] SinglePaneApp.tsx < 200 行
- [ ] 每个组件文件 < 400 行
- [ ] 所有 dialog 通过 DialogContext + Portal 渲染
- [ ] 切换 `.env` 域名后功能正常
