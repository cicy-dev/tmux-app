# React Context Global State Management

## Overview
Centralized state management using React Context API for authentication, API client, and agents data.

---

## Context Structure

### AppContext

**Location**: `src/contexts/AppContext.tsx`

**Provides**:
```typescript
{
  // Auth
  token: string | null
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void

  // API Client
  api: ApiClient | null

  // Agents
  agents: Agent[]
  loadAgents: () => Promise<void>
  removeAgent: (paneId: string, agentId?: number) => Promise<void>

  // UI State
  loading: boolean
  error: string | null
  setError: (error: string | null) => void
}
```

---

## Usage

### 1. Wrap App with Provider

```typescript
// main.tsx or Router.tsx
import { AppProvider } from './contexts/AppContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <App />
  </AppProvider>
);
```

### 2. Use in Components

```typescript
import { useApp } from '../contexts/AppContext';

const MyComponent = () => {
  const { token, isAuthenticated, agents, loadAgents, removeAgent } = useApp();

  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
    }
  }, [isAuthenticated]);

  const handleDelete = async (paneId: string) => {
    try {
      await removeAgent(paneId);
    } catch (err) {
      alert('Failed to remove agent');
    }
  };

  return <div>...</div>;
};
```

### 3. Login/Logout

```typescript
const LoginForm = () => {
  const { login } = useApp();

  const handleSubmit = (token: string) => {
    login(token); // Auto-saves to localStorage
  };

  return <form>...</form>;
};

const Header = () => {
  const { logout, isAuthenticated } = useApp();

  return (
    <div>
      {isAuthenticated && (
        <button onClick={logout}>Logout</button>
      )}
    </div>
  );
};
```

---

## Migration Example

### Before (Props Drilling)
```typescript
// Router.tsx
<SinglePaneApp token={token} />

// SinglePaneApp.tsx
<AgentsRightView token={token} onAddAgent={...} />

// AgentsRightView.tsx
const AgentsRightView = ({ token }) => {
  const [agents, setAgents] = useState([]);
  
  useEffect(() => {
    fetch(getApiUrl('/api/tmux/status/all'), {
      headers: { 'Authorization': `Bearer ${token}` }
    })...
  }, [token]);
};
```

### After (Context)
```typescript
// Router.tsx
<AppProvider>
  <SinglePaneApp />
</AppProvider>

// SinglePaneApp.tsx
<AgentsRightView onAddAgent={...} />

// AgentsRightView.tsx
const AgentsRightView = () => {
  const { agents, loadAgents } = useApp();
  
  useEffect(() => {
    loadAgents();
  }, []);
};
```

---

## Benefits

1. ✅ **No Props Drilling** - Access state anywhere
2. ✅ **Centralized Logic** - Auth, API, agents in one place
3. ✅ **Type Safety** - Full TypeScript support
4. ✅ **Easy Testing** - Mock context provider
5. ✅ **Automatic Token Management** - Integrated with TokenManager
6. ✅ **Shared State** - Multiple components use same data

---

## Advanced: Multiple Contexts

For larger apps, split into multiple contexts:

```typescript
// contexts/AuthContext.tsx
export const AuthProvider = ({ children }) => {
  // Auth logic only
};

// contexts/AgentsContext.tsx
export const AgentsProvider = ({ children }) => {
  const { api } = useAuth(); // Use auth context
  // Agents logic
};

// main.tsx
<AuthProvider>
  <AgentsProvider>
    <App />
  </AgentsProvider>
</AuthProvider>
```

---

## Error Handling

```typescript
const MyComponent = () => {
  const { error, setError, removeAgent } = useApp();

  const handleDelete = async (paneId: string) => {
    try {
      await removeAgent(paneId);
    } catch (err) {
      // Error already set in context
      console.error(err);
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button onClick={() => setError(null)}>Clear Error</button>
    </div>
  );
};
```

---

## Performance Optimization

### Problem: Re-renders on every state change

### Solution: Split contexts or use useMemo

```typescript
// Option 1: Split contexts
<AuthProvider>
  <AgentsProvider>
    <UIProvider>
      <App />
    </UIProvider>
  </AgentsProvider>
</AuthProvider>

// Option 2: Memoize expensive components
const AgentsList = React.memo(() => {
  const { agents } = useApp();
  return <div>{agents.map(...)}</div>;
});
```

---

## Testing

```typescript
import { render } from '@testing-library/react';
import { AppProvider } from './contexts/AppContext';

const renderWithContext = (component) => {
  return render(
    <AppProvider>
      {component}
    </AppProvider>
  );
};

test('loads agents', async () => {
  const { getByText } = renderWithContext(<MyComponent />);
  // Test logic
});
```

---

## Next Steps

1. ✅ Create `AppContext.tsx`
2. ⬜ Wrap app with `<AppProvider>`
3. ⬜ Update components to use `useApp()`
4. ⬜ Remove token props from components
5. ⬜ Test authentication flow
6. ⬜ Add error boundary for context errors
