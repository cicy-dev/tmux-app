# Pane Selection Refactor Specification

## Problem
Current implementation passes pane_id via URL path (`/w-20001`), which:
- Requires different URLs for different panes
- Makes URL routing complex
- Hard to switch between panes

## Solution
Use single URL (`https://ide.cicy.de5.net/`) + pane selection UI + localStorage cache

---

## URL Structure

### Before
```
https://ide.cicy.de5.net/w-20001/?token=xxx
https://ide.cicy.de5.net/w-20002/?token=xxx
```

### After
```
https://ide.cicy.de5.net/?token=xxx
```

Pane ID stored in localStorage, not URL.

---

## Implementation

### 1. PaneManager Class

**Location**: `src/services/paneManager.ts`

**Methods**:
```typescript
PaneManager.getCurrentPane()      // Get from cache
PaneManager.setCurrentPane(id)    // Save to cache
PaneManager.clearCurrentPane()    // Clear selection
PaneManager.hasSelectedPane()     // Check if selected
```

### 2. AppContext Integration

```typescript
const { currentPaneId, selectPane, clearPane } = useApp();

// Select pane
selectPane('w-20001');

// Get current pane
console.log(currentPaneId); // 'w-20001'

// Clear selection
clearPane();
```

### 3. Pane Selector Component

```typescript
const PaneSelector: React.FC = () => {
  const { agents, currentPaneId, selectPane } = useApp();

  return (
    <select 
      value={currentPaneId || ''} 
      onChange={(e) => selectPane(e.target.value)}
    >
      <option value="">Select Pane</option>
      {agents.map(agent => (
        <option key={agent.pane_id} value={agent.pane_id}>
          {agent.title || agent.pane_id}
        </option>
      ))}
    </select>
  );
};
```

### 4. App Flow

```
User visits: https://ide.cicy.de5.net/?token=xxx
                    ↓
         TokenManager.init() - Extract & save token
                    ↓
         PaneManager.getCurrentPane() - Check cache
                    ↓
         Has cached pane? → Load pane
                    ↓
         No cached pane? → Show pane selector
                    ↓
         User selects pane → Save to cache
                    ↓
         Load selected pane
```

---

## Migration Steps

### Step 1: Update Router

```typescript
import { useApp } from './contexts/AppContext';

export const Router = () => {
  const { isAuthenticated, currentPaneId, agents, loadAgents } = useApp();

  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (!currentPaneId) {
    return <PaneSelector agents={agents} />;
  }

  return <SinglePaneApp paneId={currentPaneId} />;
};
```

### Step 2: Create PaneSelector Component

```typescript
const PaneSelector: React.FC<{ agents: Agent[] }> = ({ agents }) => {
  const { selectPane } = useApp();

  return (
    <div className="flex items-center justify-center h-screen bg-vsc-bg">
      <div className="bg-vsc-bg-secondary border border-vsc-border rounded-lg p-6 w-96">
        <h2 className="text-xl text-vsc-text mb-4">Select Pane</h2>
        <div className="space-y-2">
          {agents.map(agent => (
            <button
              key={agent.pane_id}
              onClick={() => selectPane(agent.pane_id)}
              className="w-full p-3 bg-vsc-bg hover:bg-vsc-bg-hover border border-vsc-border rounded text-left"
            >
              <div className="text-sm font-medium text-vsc-text">
                {agent.title || agent.pane_id}
              </div>
              <div className="text-xs text-vsc-text-muted">{agent.pane_id}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### Step 3: Add Pane Switcher in Header

```typescript
const Header: React.FC = () => {
  const { currentPaneId, agents, selectPane, clearPane } = useApp();

  return (
    <div className="flex items-center gap-2">
      <select 
        value={currentPaneId || ''} 
        onChange={(e) => selectPane(e.target.value)}
        className="bg-vsc-bg border border-vsc-border text-vsc-text px-2 py-1 rounded"
      >
        {agents.map(agent => (
          <option key={agent.pane_id} value={agent.pane_id}>
            {agent.title || agent.pane_id}
          </option>
        ))}
      </select>
      <button onClick={clearPane}>Change Pane</button>
    </div>
  );
};
```

### Step 4: Remove URL-based Pane ID

```typescript
// Before
const paneId = window.location.pathname.split('/')[1]; // w-20001

// After
const { currentPaneId } = useApp(); // from cache
```

---

## Benefits

1. ✅ Single URL for all panes
2. ✅ Easy pane switching without page reload
3. ✅ Persistent pane selection
4. ✅ Cleaner URL structure
5. ✅ Better UX with pane selector UI

---

## Backward Compatibility

Support both methods during transition:

```typescript
// Check URL first (legacy)
const urlPaneId = window.location.pathname.split('/')[1];
if (urlPaneId && urlPaneId.startsWith('w-')) {
  PaneManager.setCurrentPane(urlPaneId);
  // Clean URL
  window.history.replaceState({}, '', '/');
}

// Then use cached pane
const paneId = PaneManager.getCurrentPane();
```

---

## Testing

```typescript
// Test 1: First visit
// Visit: https://ide.cicy.de5.net/?token=xxx
// Expected: Show pane selector

// Test 2: Select pane
// Click pane in selector
// Expected: Load pane, save to cache

// Test 3: Return visit
// Refresh page
// Expected: Load cached pane directly

// Test 4: Switch pane
// Change pane in dropdown
// Expected: Load new pane, update cache
```

---

## Code Changes Summary

**New Files**:
- `src/services/paneManager.ts`
- `src/components/PaneSelector.tsx`

**Modified Files**:
- `src/contexts/AppContext.tsx` - Add pane management
- `src/Router.tsx` - Add pane selection flow
- `src/SinglePaneApp.tsx` - Use currentPaneId from context

**Removed**:
- URL-based pane ID parsing
- Pane ID in URL paths
