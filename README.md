# tmux-app

Browser-based IDE for managing AI agents running in tmux sessions via ttyd WebSocket terminals.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (IDE Frontend - React + Vite)                          │
│  ┌──────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │LeftPanel  │  │  MainMiddlePanel │  │   RightSidePanel       │ │
│  │Agent List │  │  ttyd Terminal   │  │ Code│Prompt│Agents│... │ │
│  │Search     │  │  CommandPanel    │  │ Settings (Agent/Global │ │
│  │Pin/Status │  │  CaptureOverlay  │  │           /Tokens)     │ │
│  └──────────┘  └──────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
   FastAPI Backend      ttyd-proxy (Node.js)    code-server
   (port 14444)         (port 6901)             (VS Code)
         │                    │
         ▼                    ▼
      MySQL              tmux sessions
```

### Service Topology

| Service | URL | Purpose |
|---------|-----|---------|
| FastAPI Backend | `https://g-fast-api.cicy.de5.net` | All business APIs (tmux, auth, agents, settings) |
| ttyd Proxy | `https://ttyd-proxy.cicy.de5.net` | WebSocket terminal proxy to tmux panes |
| code-server | `https://code.cicy.de5.net` | VS Code in browser |
| IDE Frontend | `https://ide.cicy.de5.net` | This app |

## Quick Start

### Build

```bash
cd ide
npm install
npx vite build          # Production build → ide/dist/
npx vite dev            # Dev server with HMR
```

### Deploy

Static files in `ide/dist/` served via Nginx. No server-side rendering.

## IDE Layout

### Three-Panel Layout

```
┌─────────┬──────────────────────┬─────────────────────┐
│  Left   │      Middle          │       Right          │
│  240px  │   (resizable)        │    (resizable)       │
│         │                      │                      │
│ Agents  │  Terminal (ttyd)     │  Code / Prompt /     │
│ List    │  + CommandPanel      │  Agents / Preview /  │
│         │  + CaptureOverlay    │  Settings            │
│         │                      │                      │
└─────────┴──────────────────────┴─────────────────────┘
```

- **Left Panel** — Agent list with status dots, search, pin indicators. Collapsible.
- **Middle Panel** — ttyd terminal iframe, topbar (pin, network, split/restart), CommandPanel (prompt input, history, correction, voice).
- **Right Panel** — Tabbed: Code (code-server), Prompt (common prompt editor), Agents (bound agents with live ttyd), Preview (configurable URLs), Settings (Agent/Global/Tokens).
- **Drag Handle** — Between middle and right, 5px wide, delta-based resize.

### Collapsible Panels

Both left and right panels can be collapsed via toggle buttons in the middle topbar. State persisted to `localStorage`.

## Features

### Terminal Management
- Live tmux terminal via ttyd WebSocket
- Send commands with auto-Enter (uses `/api/tmux/send` with `text` field)
- Empty prompt + Enter sends Enter key to tmux
- Shift+Enter for newline in prompt
- Ctrl+Enter for English correction before sending
- Arrow Up/Down for command history navigation
- Mouse mode toggle (tmux `set -g mouse on/off`)
- Capture pane output with search, copy, and line count control

### Agent System
- Left sidebar: all agents with real-time status (idle/thinking/auth/starting/compact)
- Pin agents to top (synced between sidebar and topbar)
- Bind/unbind agents to current pane
- Create new agent (+New) and auto-bind
- Live ttyd WebFrame for each bound agent (resizable height, persisted)
- Open agent in new browser tab

### Command Panel
- Floating panel with prompt textarea
- English correction via Ctrl+Enter (shows EN/CN result)
- Quick actions dropdown (arrow keys, /compact, /model, trust, yes/no)
- Voice input support
- Command history per pane (localStorage)
- Draft auto-save per pane

### Right Side Tabs

| Tab | Description |
|-----|-------------|
| **Code** | code-server iframe with folder navigation, favorites |
| **Prompt** | Common prompt textarea, saved per pane via API |
| **Agents** | Bound agents grid with live ttyd, bind/unbind/create |
| **Preview** | Configurable preview URLs from global settings |
| **Settings** | Sub-tabs: Agent (pane config), Global (JSON), Tokens (API token CRUD) |

## Source Structure

```
ide/src/
├── main.tsx                    # Entry point
├── Router.tsx                  # React Router → MainApp
├── MainApp.tsx                 # Root layout (142 lines)
├── config.ts                   # API URLs, ttyd/code-server URL builders
├── types.ts                    # AppSettings, Position, Size
│
├── contexts/
│   ├── AppContext.tsx           # Auth, panes list, pane detail, API client (272 lines)
│   ├── PaneContext.tsx          # Current pane state, settings, operations (322 lines)
│   ├── DialogContext.tsx        # Modal dialog management (77 lines)
│   └── VoiceContext.tsx         # Voice recording state (103 lines)
│
├── components/
│   ├── LeftSidePanel.tsx        # Agent list, search, pin, create dialog (126 lines)
│   ├── MainMiddlePanel.tsx      # Terminal, topbar, overlays, CommandPanel host (337 lines)
│   ├── RightSidePanel.tsx       # All right tabs + BindedAgentsTab + PromptTab + SettingsTab + TokensTab (618 lines)
│   ├── CommandPanel.tsx         # Prompt input, history, correction, shortcuts (624 lines)
│   ├── WebFrame.tsx             # iframe/webview wrapper (Electron support)
│   ├── FloatingPanel.tsx        # Draggable/resizable panel container
│   ├── TerminalControls.tsx     # Mouse toggle + capture buttons
│   ├── SettingsView.tsx         # Pane settings form
│   ├── AgentsBrowser.tsx        # Full-page agent browser (for addAgent dialog)
│   ├── LoginForm.tsx            # Token-based login
│   ├── VoiceFloatingButton.tsx  # Voice recording button
│   └── ConfirmDialog.tsx        # Confirmation modal
│
└── services/
    ├── api.ts                   # Axios HTTP client, all API endpoints (69 lines)
    ├── mockApi.ts               # sendCommandToTmux wrapper (13 lines)
    ├── tokenManager.ts          # localStorage token management
    └── paneManager.ts           # Current pane cache
```

## Context Architecture

```
AppProvider          → Auth state, panes list, pane detail, API client
  └── PaneProvider   → Current pane, UI state, settings, operations
       └── VoiceProvider → Recording state
            └── DialogProvider → Modal dialogs
                 └── MainApp
```

### AppContext
- `allPanes` — Full pane list from `/api/tmux/panes`
- `currentPaneId` — Initialized from PaneManager cache or URL
- `paneDetail` — Current pane detail from `/api/tmux/panes/:id`
- `api` — Axios-based API service singleton
- `globalVar` — Global settings JSON

### PaneContext
- `displayPaneId` / `displayPaneTitle` — Current pane display info
- `token` / `hasPermission()` — Auth state
- `ttydWidth` / `commandPanelHeight` — Layout dimensions
- `leftCollapsed` / `rightCollapsed` — Panel visibility (localStorage)
- `handleCapturePane()` / `handleRestart()` / `handleToggleMouse()` — Operations
- `captureOutput` / `isCapturing` — Capture overlay state

## API Endpoints (via `services/api.ts`)

### Auth
- `POST /api/auth/verify-token` — Verify current token
- `GET /api/auth/verify` — Verify with Bearer token
- `GET /api/auth/tokens` — List API tokens
- `POST /api/auth/tokens` — Create token (perms, group, note)
- `DELETE /api/auth/tokens/:id` — Delete token

### Panes
- `GET /api/tmux/panes` — List all panes
- `GET /api/tmux/panes/:id` — Get pane detail
- `PATCH /api/tmux/panes/:id` — Update pane settings
- `DELETE /api/tmux/panes/:id` — Delete pane
- `POST /api/tmux/create` — Create new pane
- `POST /api/tmux/panes/:id/restart` — Restart pane

### Tmux Operations
- `POST /api/tmux/send` — Send text to pane (`{win_id, text}` → auto Enter)
- `POST /api/tmux/send-keys` — Send raw keys (`{win_id, keys}` → no Enter)
- `POST /api/tmux/capture_pane` — Capture output (`{pane_id, lines}`)
- `POST /api/tmux/mouse/:action` — Toggle mouse mode (on/off)
- `GET /api/tmux/status/all` — All pane statuses

### Agents
- `GET /api/agents/pane/:id` — Get agents bound to pane
- `POST /api/agents/bind` — Bind agent to pane
- `DELETE /api/agents/unbind/:id` — Unbind agent
- `DELETE /api/agents/:id` — Delete agent

### Settings
- `GET /api/settings/global` — Get global settings
- `POST /api/settings/global` — Update global settings
- `GET /api/groups` — List groups

## Key Design Decisions

1. **All API calls via axios singleton** (`services/api.ts`) — No direct fetch()
2. **ReactContext for shared state** — No Redux/Zustand
3. **localStorage for persistence** — Panel widths, collapsed state, command history, drafts, pin state, agent heights
4. **Incremental agent updates** — Bind/unbind only adds/removes changed agents, existing WebFrames don't reload
5. **Delta-based drag** — Resize handles use `startWidth + (mouseX - startX)` to prevent position jumps
6. **Global drag overlay** — `fixed inset-0 z-[9999]` div during any drag to prevent iframe event stealing
7. **`text` vs `keys` API** — `sendCommand` uses `text` field (backend appends Enter), `sendKeys` for raw keys (no Enter)

## Build Output

```
dist/index.html         ~1 KB
dist/assets/index.css   ~29 KB (gzip: ~5.6 KB)
dist/assets/index.js    ~325 KB (gzip: ~100 KB)
```
