import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import ApiClient from '../services/api';
import { TokenManager } from '../services/tokenManager';
import { PaneManager } from '../services/paneManager';
import apiService from '../services/api';
import config from '../config';

const APP_VERSION = config.version;

interface Agent {
  pane_id: string;
  status?: string;
  title?: string;
  id?: number;
  [key: string]: any;
}

interface AppContextType {
  // Auth
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;

  // Pane Selection
  currentPaneId: string | null;
  currentPane: Agent | undefined;
  paneDetail: any | null;
  setPaneDetail: (detail: any) => void;
  selectPane: (paneId: string) => void;
  clearPane: () => void;

  // API Client
  api: ApiClient | null;

  // Agents
  agents: Agent[];
  loadAgents: () => Promise<void>;
  removeAgent: (paneId: string, agentId?: number) => Promise<void>;
  
  // All Panes
  allPanes: Agent[];
  updatePane: (paneId: string, updates: Partial<Agent>) => void;
  
  // Global Settings
  globalVar: any;
  loadGlobalVar: () => Promise<void>;
  updateGlobalVar: (data: any) => Promise<void>;
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Global Dialog
  showDialog: (content: ReactNode, onConfirm?: () => void, onCancel?: () => void) => void;
  hideDialog: () => void;
  setError: (error: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [currentPaneId, setCurrentPaneId] = useState<string | null>(null);
  const [paneDetail, setPaneDetail] = useState<any | null>(null);
  const [api, setApi] = useState<ApiClient | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allPanes, setAllPanes] = useState<Agent[]>([]);
  const [globalVar, setGlobalVar] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogContent, setDialogContent] = useState<ReactNode>(null);
  const [dialogOnConfirm, setDialogOnConfirm] = useState<(() => void) | undefined>();
  const [dialogOnCancel, setDialogOnCancel] = useState<(() => void) | undefined>();

  // Initialize token, pane, and API client
  useEffect(() => {
    const cachedToken = TokenManager.init();
    const cachedPane = PaneManager.getCurrentPane();
    
    if (cachedToken) {
      setToken(cachedToken);
      const apiClient = new ApiClient(cachedToken);
      setApi(apiClient);
    }
    
    if (cachedPane) {
      setCurrentPaneId(cachedPane);
    }
    
    setLoading(false);
  }, []);

  // Load global settings when api is ready
  useEffect(() => {
    if (api) {
      loadGlobalVar();
    }
  }, [api]);
  useEffect(() => {
    if (!api) return;
    const fetchAllPanes = async () => {
      const startTime = performance.now();
      try {
        const data = await api.getAgents();
        const latency = Math.round(performance.now() - startTime);
        
        // Emit network latency event for UI
        window.dispatchEvent(new CustomEvent('network-latency', { detail: { latency } }));
        
        const panesArray = Object.values(data as Record<string, Agent>) || [];
        setAllPanes(panesArray);
        
        // Set first pane as current if not set
        if (panesArray.length > 0 && !PaneManager.getCurrentPane()) {
          const firstPane = panesArray[0];
          PaneManager.setCurrentPane(firstPane.pane_id);
          setCurrentPaneId(firstPane.pane_id);
        }
      } catch (err) {
        console.error('Failed to fetch panes:', err);
        window.dispatchEvent(new CustomEvent('network-latency', { detail: { latency: null } }));
      }
    };
    fetchAllPanes();
    const id = setInterval(fetchAllPanes, 5000);
    return () => clearInterval(id);
  }, [api]);

  const login = (newToken: string) => {
    TokenManager.saveToken(newToken);
    setToken(newToken);
    setApi(new ApiClient(newToken));
  };

  const logout = () => {
    TokenManager.clearToken();
    PaneManager.clearCurrentPane();
    setToken(null);
    setCurrentPaneId(null);
    setApi(null);
    setAgents([]);
  };

  const selectPane = async (paneId: string) => {
    PaneManager.setCurrentPane(paneId);
    setCurrentPaneId(paneId);
    
    // Fetch detailed pane config
    if (api) {
      try {
        const detail = await api.getPane(paneId);
        setPaneDetail(detail);
      } catch (err) {
        console.error('Failed to fetch pane detail:', err);
        setPaneDetail(null);
      }
    }
  };

  const clearPane = () => {
    PaneManager.clearCurrentPane();
    setCurrentPaneId(null);
  };

  const updatePane = (paneId: string, updates: Partial<Agent>) => {
    setAllPanes(prev => prev.map(p => 
      p.pane_id === paneId ? { ...p, ...updates } : p
    ));
  };

  const loadAgents = async () => {
    if (!api) return;
    try {
      setLoading(true);
      const data = await api.getAgents();
      setAgents(Object.values(data as Record<string, Agent>));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeAgent = async (paneId: string, agentId?: number) => {
    if (!api) return;
    try {
      // Unbind if has agent ID
      if (agentId) {
        await api.unbindAgent(agentId);
      }
      // Delete pane
      await api.deleteAgent(paneId);
      // Update local state
      setAgents(agents.filter(a => a.pane_id !== paneId));
      setError(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const loadGlobalVar = useCallback(async () => {
    if (!api) return;
    try {
      const { data } = await apiService.getGlobalSettings();
      setGlobalVar(data);
    } catch (err: any) {
      console.error('Failed to load global settings:', err);
    }
  }, [api]);

  const updateGlobalVar = useCallback(async (data: any) => {
    if (!api) return;
    try {
      await apiService.updateGlobalSettings(data);
      setGlobalVar(data);
    } catch (err: any) {
      console.error('Failed to update global settings:', err);
      throw err;
    }
  }, [api]);

  const showDialog = useCallback((content: ReactNode, onConfirm?: () => void, onCancel?: () => void) => {
    setDialogContent(content);
    setDialogOnConfirm(() => onConfirm);
    setDialogOnCancel(() => onCancel);
    setDialogVisible(true);
  }, []);

  const hideDialog = useCallback(() => {
    setDialogVisible(false);
    setDialogContent(null);
    setDialogOnConfirm(undefined);
    setDialogOnCancel(undefined);
  }, []);

  const value: AppContextType = {
    token,
    isAuthenticated: !!token,
    login,
    logout,
    currentPaneId,
    currentPane: allPanes.find(p => p.pane_id === currentPaneId),
    paneDetail,
    setPaneDetail,
    selectPane,
    clearPane,
    api,
    agents,
    loadAgents,
    removeAgent,
    allPanes,
    updatePane,
    globalVar,
    loadGlobalVar,
    updateGlobalVar,
    loading,
    error,
    showDialog,
    hideDialog,
    setError,
  };

  // Debug: Log context changes
  React.useEffect(() => {
    console.debug('[AppContext] State updated:', {
      currentPaneId,
      currentPane: allPanes.find(p => p.pane_id === currentPaneId),
      allPanesCount: allPanes.length,
      allPanes: allPanes.map(p => ({ pane_id: p.pane_id, title: p.title }))
    });
  }, [currentPaneId, allPanes]);

  return (
    <AppContext.Provider value={value}>
      {children}
      {/* Global Dialog */}
      {dialogVisible && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '24px', minWidth: '400px', maxWidth: '600px'}}>
            <div style={{marginBottom: '20px'}}>{dialogContent}</div>
            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
              {dialogOnCancel && (
                <button onClick={() => { dialogOnCancel(); hideDialog(); }} style={{padding: '8px 16px', backgroundColor: '#2a2d2e', color: '#cccccc', border: '1px solid #474747', borderRadius: '4px', cursor: 'pointer'}}>
                  Cancel
                </button>
              )}
              {dialogOnConfirm && (
                <button onClick={() => { dialogOnConfirm(); hideDialog(); }} style={{padding: '8px 16px', backgroundColor: '#0e639c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  
  // Expose to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).__APP_CONTEXT__ = { ...context, version: APP_VERSION };
  }
  
  return context;
};
