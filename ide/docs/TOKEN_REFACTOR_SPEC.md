# Token Management Refactor Specification

## Problem
Current implementation passes token via URL query parameter (`?token=xxx`), which:
- Exposes token in browser history
- Makes URLs longer and harder to share
- Token persists in URL after authentication

## Solution
Extract token from URL → Save to localStorage → Remove from URL

---

## Implementation

### 1. TokenManager Class

**Location**: `src/services/tokenManager.ts`

**Methods**:
```typescript
TokenManager.init()           // Extract from URL or get from cache
TokenManager.saveToken(token) // Save to localStorage
TokenManager.getToken()       // Get from localStorage
TokenManager.clearToken()     // Logout
TokenManager.hasToken()       // Check if authenticated
```

### 2. Usage in App

#### Before
```typescript
// Router.tsx or SinglePaneApp.tsx
const params = new URLSearchParams(window.location.search);
const token = params.get('token') || '';
```

#### After
```typescript
import { TokenManager } from './services/tokenManager';

// On app initialization
const token = TokenManager.init();

if (!token) {
  // Show login form
  return <LoginForm onLogin={(token) => {
    TokenManager.saveToken(token);
    window.location.reload();
  }} />;
}

// Use token
const api = new ApiClient(token);
```

### 3. Flow Diagram

```
User visits: https://ide.cicy.de5.net/?token=abc123
                    ↓
         TokenManager.init() called
                    ↓
         Extract token from URL
                    ↓
         Save to localStorage
                    ↓
         Remove ?token= from URL
                    ↓
         URL becomes: https://ide.cicy.de5.net/
                    ↓
         App uses cached token
```

### 4. Migration Steps

#### Step 1: Update Router.tsx
```typescript
import { TokenManager } from './services/tokenManager';

export const Router = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cachedToken = TokenManager.init();
    setToken(cachedToken);
    setLoading(false);
  }, []);

  if (loading) return <div>Loading...</div>;
  
  if (!token) {
    return <LoginForm onLogin={(newToken) => {
      TokenManager.saveToken(newToken);
      setToken(newToken);
    }} />;
  }

  return <SinglePaneApp token={token} />;
};
```

#### Step 2: Update LoginForm
```typescript
const handleLogin = async (inputToken: string) => {
  try {
    // Verify token
    const res = await fetch(getApiUrl('/api/health'), {
      headers: { 'Authorization': `Bearer ${inputToken}` }
    });
    
    if (res.ok) {
      TokenManager.saveToken(inputToken);
      onLogin(inputToken);
    } else {
      alert('Invalid token');
    }
  } catch (err) {
    alert('Login failed');
  }
};
```

#### Step 3: Add Logout
```typescript
const handleLogout = () => {
  TokenManager.clearToken();
  window.location.reload();
};
```

### 5. Security Considerations

✅ **Pros**:
- Token not visible in URL
- Cleaner browser history
- Easier to share URLs

⚠️ **Cons**:
- localStorage accessible via XSS (same as before)
- Consider httpOnly cookies for production

### 6. Backward Compatibility

The implementation supports both methods:
1. New users: `?token=xxx` → auto-saved → URL cleaned
2. Returning users: token loaded from cache
3. Manual login: token saved via LoginForm

### 7. Testing

```typescript
// Test 1: URL token extraction
// Visit: http://localhost:6902/?token=test123
// Expected: URL becomes http://localhost:6902/
// Expected: localStorage has token

// Test 2: Cached token
// Refresh page
// Expected: No login form, app loads with cached token

// Test 3: Logout
// Click logout
// Expected: localStorage cleared, login form shown
```

---

## Code Changes Summary

**New Files**:
- `src/services/tokenManager.ts`

**Modified Files**:
- `src/Router.tsx` - Use TokenManager.init()
- `src/components/LoginForm.tsx` - Save token on login
- Add logout button in UI

**Removed**:
- Direct URL token parsing in components
- Token passed via URL in internal links

---

## Benefits

1. ✅ Cleaner URLs
2. ✅ Better security (no token in history)
3. ✅ Persistent authentication
4. ✅ Centralized token management
5. ✅ Easier logout implementation
