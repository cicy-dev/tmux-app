# API Client Specification

## Overview
Unified API client class for handling all HTTP requests to the tmux-app backend.

## Class: ApiClient

### Constructor
```typescript
constructor(token: string)
```
- **Parameters**: 
  - `token`: Bearer token for authentication
- **Usage**: `const api = new ApiClient(token)`

### Methods

#### Token Management
```typescript
setToken(token: string): void
```
Update the authentication token.

---

#### Agents API

##### getAgents()
```typescript
async getAgents(): Promise<Record<string, Agent>>
```
- **Endpoint**: `GET /api/tmux/status/all`
- **Returns**: Object with pane_id as key, agent status as value
- **Example**:
```typescript
const agents = await api.getAgents();
// { "w-20001": { pane_id: "w-20001", status: "idle", title: "Agent 1" } }
```

##### createAgent()
```typescript
async createAgent(data: {
  win_name: string;
  workspace: string;
  init_script: string;
}): Promise<{ pane_id: string }>
```
- **Endpoint**: `POST /api/tmux/create`
- **Returns**: Created pane info
- **Example**:
```typescript
const result = await api.createAgent({
  win_name: 'Agent-123',
  workspace: '/home/user/project',
  init_script: 'pwd'
});
// { pane_id: "w-20001" }
```

##### deleteAgent()
```typescript
async deleteAgent(paneId: string): Promise<void>
```
- **Endpoint**: `DELETE /api/tmux/panes/{paneId}`
- **Example**: `await api.deleteAgent('w-20001')`

##### unbindAgent()
```typescript
async unbindAgent(agentId: number): Promise<void>
```
- **Endpoint**: `DELETE /api/agents/unbind/{agentId}`
- **Example**: `await api.unbindAgent(123)`

##### bindAgent()
```typescript
async bindAgent(paneId: string, agentName: string): Promise<{ id: number; status: string }>
```
- **Endpoint**: `POST /api/agents/bind`
- **Returns**: Bound agent info
- **Example**:
```typescript
const result = await api.bindAgent('w-20001', 'w-20002');
// { id: 123, status: "active" }
```

##### restartAgent()
```typescript
async restartAgent(paneId: string): Promise<void>
```
- **Endpoint**: `POST /api/tmux/panes/{paneId}/restart`
- **Example**: `await api.restartAgent('w-20001')`

##### toggleMouse()
```typescript
async toggleMouse(paneId: string): Promise<void>
```
- **Endpoint**: `POST /api/tmux/mouse/toggle?pane_id={paneId}`
- **Example**: `await api.toggleMouse('w-20001')`

---

#### Panes API

##### getPanes()
```typescript
async getPanes(): Promise<Array<{ pane_id: string; title?: string }>>
```
- **Endpoint**: `GET /api/tmux/panes`
- **Returns**: List of all panes

##### getPaneConfig()
```typescript
async getPaneConfig(paneId: string): Promise<PaneConfig>
```
- **Endpoint**: `GET /api/ttyd/config/{paneId}`
- **Returns**: Pane configuration

##### updatePaneConfig()
```typescript
async updatePaneConfig(paneId: string, config: any): Promise<void>
```
- **Endpoint**: `PUT /api/ttyd/config/{paneId}`
- **Example**:
```typescript
await api.updatePaneConfig('w-20001', {
  title: 'New Title',
  workspace: '/new/path'
});
```

##### capturePane()
```typescript
async capturePane(paneId: string): Promise<{ content: string }>
```
- **Endpoint**: `GET /api/tmux/capture?pane_id={paneId}`
- **Returns**: Captured pane content

---

#### Commands API

##### sendCommand()
```typescript
async sendCommand(target: string, command: string): Promise<void>
```
- **Endpoint**: `POST /api/tmux/send`
- **Example**:
```typescript
await api.sendCommand('w-20001', 'ls -la');
```

##### correctEnglish()
```typescript
async correctEnglish(text: string): Promise<{ result: string }>
```
- **Endpoint**: `POST /api/correctEnglish`
- **Returns**: Corrected text
- **Example**:
```typescript
const result = await api.correctEnglish('how r u');
// { result: "How are you?" }
```

---

## Error Handling

All methods throw errors with descriptive messages:

```typescript
try {
  await api.deleteAgent('w-20001');
} catch (error) {
  console.error(error.message); // "数据库中未找到该 Pane 配置"
}
```

## Usage Example

```typescript
import ApiClient from './services/api';

// Initialize
const api = new ApiClient(token);

// Use in component
const MyComponent = () => {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    api.getAgents()
      .then(data => setAgents(Object.values(data)))
      .catch(err => console.error(err));
  }, []);

  const handleDelete = async (paneId: string) => {
    try {
      await api.deleteAgent(paneId);
      setAgents(agents.filter(a => a.pane_id !== paneId));
    } catch (error) {
      alert(error.message);
    }
  };

  return <div>...</div>;
};
```

## Migration Guide

### Before
```typescript
const res = await fetch(getApiUrl('/api/tmux/panes/w-20001'), {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});
if (!res.ok) throw new Error('Failed');
```

### After
```typescript
await api.deleteAgent('w-20001');
```

## Benefits
- ✅ Unified error handling
- ✅ Automatic authentication
- ✅ Type safety
- ✅ Centralized API endpoints
- ✅ Easier testing and mocking
- ✅ Reduced boilerplate code
