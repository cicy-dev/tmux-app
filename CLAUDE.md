# CLAUDE.md

Guidance for AI agents working on this codebase.

## Project

Browser-based IDE for managing AI agents in tmux sessions. React 19 + TypeScript + Vite + Tailwind CSS.

## Build & Test

```bash
cd ide && npx vite build 2>&1 | tail -10   # Build (must pass before commit)
cd ide && npx vite dev                       # Dev server with HMR
```

No test framework — verify via build success + manual browser testing.

## Entry Flow

```
main.tsx → Router.tsx → MainApp.tsx
  AppProvider → PaneProvider → VoiceProvider → DialogProvider
    ├── LeftSidePanel      (agent list, search, pin)
    ├── MainMiddlePanel    (terminal, command panel, capture)
    └── RightSidePanel     (code, prompt, agents, preview, settings)
```

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `MainApp.tsx` | 142 | Root layout, drag handle, auth gates |
| `contexts/AppContext.tsx` | 272 | Auth, panes list, pane detail, API |
| `contexts/PaneContext.tsx` | 322 | Current pane state, UI, operations |
| `components/CommandPanel.tsx` | 624 | Prompt input, history, correction |
| `components/RightSidePanel.tsx` | 618 | All right-side tabs |
| `components/MainMiddlePanel.tsx` | 337 | Terminal area, topbar, overlays |
| `components/LeftSidePanel.tsx` | 126 | Agent list sidebar |
| `services/api.ts` | 69 | All API endpoints (axios) |
| `config.ts` | 23 | URL constants and builders |

## Code Rules

- **All API calls** through `services/api.ts` axios singleton — no direct fetch()
- **State management** via React Context only — no Redux/Zustand
- **Persistence** via localStorage — panel widths, history, drafts, pins, heights
- **Styling** with Tailwind CSS classes — inline styles only for dynamic values
- **Components** as function components + hooks — no class components
- **`text` vs `keys`** — `api.sendCommand()` sends `{text}` (auto Enter), `api.sendKeys()` sends `{keys}` (raw)

## API Base URLs (config.ts)

```
FastAPI:     https://g-fast-api.cicy.de5.net
ttyd Proxy:  https://ttyd-proxy.cicy.de5.net
code-server: https://code.cicy.de5.net
```

## Common Patterns

### Adding a new API endpoint
1. Add to `services/api.ts`
2. Call via `apiService.methodName()` or `api.methodName()` from AppContext

### Adding a right-side tab
1. Add tab name to the array in `RightSidePanel.tsx` top bar
2. Add `{activeTab === 'Name' && <Component />}` in the render

### Adding a Settings sub-tab
1. Add to the `sub` type union in `SettingsTabWithSub`
2. Add button in vertical nav
3. Add `{sub === 'Name' && <Content />}` in content area

### Drag/resize with iframes
Always add a global overlay (`fixed inset-0 z-[9999]`) during drag to prevent iframe event stealing. Use delta-based calculation: `startValue + (currentMouse - startMouse)`.

## Commit Convention

Prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `cleanup:`
