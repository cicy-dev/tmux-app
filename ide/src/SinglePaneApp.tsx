import React, { useState, useEffect, useRef } from 'react';
import { Loader2, SplitSquareHorizontal, SplitSquareVertical, XSquare, Home, RefreshCw, MoreVertical, Folder, Pin, Unlink, ExternalLink, RotateCw, Trash2 } from 'lucide-react';
import { CommandPanel, CommandPanelHandle } from './components/CommandPanel';
import { VoiceFloatingButton } from './components/VoiceFloatingButton';
import { LoginForm } from './components/LoginForm';
import { EditPaneDialog, EditPaneData } from './components/EditPaneDialog';
import { SettingsView } from './components/SettingsView';
import { AgentsListView } from './components/AgentsListView';
import { AgentsRightView } from './components/AgentsRightView';
import { CaptureDialog } from './components/CaptureDialog';
import config, { urls } from './config';
import apiService from './services/api';
import { AppSettings, Position, Size } from './types';
import { WebFrame } from './components/WebFrame';
import { useApp } from './contexts/AppContext';
import { useDialog } from './contexts/DialogContext';
import { usePane } from './contexts/PaneContext';
import { useVoice } from './contexts/VoiceContext';
import MiddlePanel from './components/MiddlePanel';
import LeftSidePanel from './components/LeftSidePanel';

const CurrentPaneId = decodeURIComponent(window.location.href.split("/")[4]);
const TMUX_TARGET = `${CurrentPaneId}`;

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const { currentPaneId, allPanes, currentPane, paneDetail, api, setPaneDetail, updatePane, selectPane, globalVar, loadGlobalVar, updateGlobalVar } = useApp();
  const { openDialog, closeDialog, confirm: confirmDialog, activeDialog } = useDialog();
  const {
    displayPaneId, displayPaneTitle, token, setToken, userPerms, isCheckingAuth, hasPermission,
    ttydWidth, setTtydWidth, isDragging, setIsDragging, isInteracting, setIsInteracting, commandPanelHeight,
    activeTab, setActiveTab, agentsSubTab, setAgentsSubTab, previewTab, setPreviewTab,
    agentStatus, contextUsage, mouseMode, readOnly, setReadOnly, isRestarting,
    agentTabs, setAgentTabs, activeAgentTab, setActiveAgentTab,
    visitedPanes, settings, setSettings, isLoaded,
    networkLatency, networkStatus, toast, setToast,
    handleRestart, handleCapturePane, handleToggleMouse, handlePanelChange,
    captureOutput, setCaptureOutput, isCapturing,
  } = usePane();
  

  // Local-only state (not shared with other components)
  const [paneTitle, setPaneTitle] = useState<string>('');
  const [paneWorkspace, setPaneWorkspace] = useState<string>('/home/w3c_offical');
  const [paneAgentDuty, setPaneAgentDuty] = useState<string>('');
  const [paneAgentType, setPaneAgentType] = useState<string>('');
  const [paneInitScript, setPaneInitScript] = useState<string>('');
  const [paneConfig, setPaneConfig] = useState<string>('');
  const [paneTgToken, setPaneTgToken] = useState<string>('');
  const [paneTtydPreview, setPaneTtydPreview] = useState<string>('');
  const [paneTgChatId, setPaneTgChatId] = useState<string>('');
  const [paneTgEnable, setPaneTgEnable] = useState<boolean>(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [boundAgents, setBoundAgents] = useState<string[]>([]);
  const [pinnedPanes, setPinnedPanes] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedPanes');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistoryOverlay, setShowHistoryOverlay] = useState(false);
  const [historyData, setHistoryData] = useState<{history: string[], onSelect: (cmd: string) => void} | null>(null);
  const [showCommonPromptOverlay, setShowCommonPromptOverlay] = useState(false);
  const [commonPromptText, setCommonPromptText] = useState('');
  const [showCorrectionResult, setShowCorrectionResult] = useState(false);
  const [correctionData, setCorrectionData] = useState<[string, string] | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editingPane, setEditingPane] = useState<EditPaneData | null>(null);
  const [isSavingPane, setIsSavingPane] = useState(false);
  const [showFavorDirs, setShowFavorDirs] = useState(false);
  const [favorDirs, setFavorDirs] = useState<string[]>([]);
  const { isListening, voiceMode, startRecording, stopRecording } = useVoice();
  const commandPanelRef = useRef<CommandPanelHandle>(null);
  const mainIframeRef = useRef<HTMLIFrameElement>(null);

  const navigateToPath = async (path: string, forceRefresh = false) => {
    console.log('navigateToPath called:', path, 'forceRefresh:', forceRefresh);
    if (!path) return;
    
    const frame = document.querySelector('.code-server-iframe') as HTMLIFrameElement | HTMLElement;
    if (!frame) {
      console.log('Frame not found');
      return;
    }
    
    // Check if already on this path
    if (!forceRefresh) {
      try {
        const currentSrc = (frame as any).src || frame.getAttribute('src');
        console.log('Current src:', currentSrc);
        if (currentSrc) {
          const currentUrl = new URL(currentSrc);
          const currentFolder = currentUrl.searchParams.get('folder');
          console.log('Current folder:', currentFolder, 'Target path:', path);
          if (currentFolder === path) {
            console.log('Already on this path, returning');
            return;
          }
        }
      } catch (e) {
        console.error('Error checking current path:', e);
      }
    }
    
    // Path is different, check if exists
    try {
      const { data } = await apiService.fileExists(path);
      console.log('Path exists check:', data);
      if (!data.exists) {
        setToast(`Path not found: ${path}`);
        setTimeout(() => setToast(null), 3000);
        return;
      }
      // Reload webframe (iframe or webview)
      const newUrl = urls.codeServer(path);
      console.log('Setting new URL:', newUrl);
      
      // Stop current loading for webview
      if ((frame as any).stop) {
        (frame as any).stop();
      }
      
      if ((frame as any).src !== undefined) {
        (frame as any).src = newUrl;
      } else {
        frame.setAttribute('src', newUrl);
      }
      setPaneWorkspace(path);
    } catch (err) {
      console.error('Failed to check path:', err);
      setToast('Failed to check path');
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Disable iframe pointer-events when any overlay dialog is open (iframes ignore z-index)
  // Close correction panel and history with Esc key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDialog) {
          closeDialog();
        } else if (showCorrectionResult) {
          setShowCorrectionResult(false);
        } else if (showHistoryOverlay) {
          setShowHistoryOverlay(false);
        } else if (showCommonPromptOverlay) {
          setShowCommonPromptOverlay(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog, showCorrectionResult, showHistoryOverlay, showCommonPromptOverlay]);

  // Listen for common prompt event
  useEffect(() => {
    const handleShowCommonPrompt = () => {
      setShowCommonPromptOverlay(!showCommonPromptOverlay);
      if (!showCommonPromptOverlay) {
        setCommonPromptText(paneDetail?.common_prompt || '');
      }
    };
    window.addEventListener('show-common-prompt', handleShowCommonPrompt as EventListener);
    return () => window.removeEventListener('show-common-prompt', handleShowCommonPrompt as EventListener);
  }, [showCommonPromptOverlay, paneDetail]);

  // --- Initialization: load pane config ---
  useEffect(() => {
    if (!token) return;
    const loadPaneConfig = async () => {
      try {
        const paneIdToLoad = CurrentPaneId.includes(':') ? CurrentPaneId : `${CurrentPaneId}:main.0`;
        const { data } = await apiService.getTtydConfig(paneIdToLoad);
        if (data) {
          const title = data.title || CurrentPaneId;
          setPaneTitle(title);
          setPaneWorkspace(data.workspace || '/home/w3c_offical');
          setPaneAgentDuty(data.agent_duty || '');
          setPaneAgentType(data.agent_type || '');
          setPaneInitScript(data.init_script || '');
          setPaneTgToken(data.tg_token || '');
          setPaneTgChatId(data.tg_chat_id || '');
          setPaneTtydPreview(data.ttyd_preview || '');
          setPaneTgEnable(data.tg_enable || false);
          let cfg: any = {};
          try { cfg = data.config ? JSON.parse(data.config) : {}; } catch {}
          setPaneConfig(data.config || '{}');
          setPreviewUrls(cfg.previewUrls || []);
          document.title = title;
          try {
            const { data: agents } = await apiService.getAgentsByPane(CurrentPaneId);
            setBoundAgents(agents.map((a: any) => a.name));
          } catch {}
        } else {
          setPaneTitle(CurrentPaneId);
          document.title = CurrentPaneId;
        }
      } catch {
        setPaneTitle(CurrentPaneId);
        document.title = CurrentPaneId;
      }
    };
    loadPaneConfig();
  }, [token]);

  // Get favor dirs from globalVar
  useEffect(() => {
    if (globalVar?.favor?.dir) {
      setFavorDirs(globalVar.favor.dir);
    }
  }, [globalVar]);

  // Reload config when switching to Preview tab
  useEffect(() => {
    if (activeTab === 'Preview' && token) {
      apiService.getPane(CurrentPaneId)
        .then(({ data }) => {
          if (data?.config) {
            try {
              const cfg = JSON.parse(data.config);
              setPreviewUrls(cfg.previewUrls || []);
            } catch (e) {
              console.error('Failed to parse config:', e);
            }
          }
        })
        .catch(err => console.error('Failed to reload config:', err));
    }
  }, [activeTab, token]);

  // Initialize tempPaneData when paneDetail changes (but not during save)
  useEffect(() => {
    if (paneDetail && !isSavingPane) {
      setTempPaneData({
        target: paneDetail.pane_id || displayPaneId,
        title: paneDetail.title || '',
        workspace: paneDetail.workspace || '/home/w3c_offical',
        agent_duty: paneDetail.agent_duty || '',
        agent_type: paneDetail.agent_type || '',
        init_script: paneDetail.init_script || '',
        config: paneDetail.config || '{}',
        tg_token: paneDetail.tg_token || '',
        tg_chat_id: paneDetail.tg_chat_id || '',
        tg_enable: paneDetail.tg_enable || false,
        active: paneDetail.active !== 0,
        ttyd_preview: paneDetail.ttyd_preview || ''
      });
    }
  }, [paneDetail, displayPaneId, isSavingPane]);

  // Clear tempPaneData when switching panes
  useEffect(() => {
    setTempPaneData(null);
  }, [currentPaneId]);

  // Load paneDetail when Settings tab is opened
  useEffect(() => {
    if (activeTab === 'Settings' && !paneDetail && api && displayPaneId) {
      api.getPane(displayPaneId).then(({ data }) => setPaneDetail(data)).catch(console.error);
    }
    if (activeTab === 'Global') {
      loadGlobalVar();
    }
  }, [activeTab, displayPaneId, api, loadGlobalVar]);

  // Listen to pin changes
  useEffect(() => {
    const handlePinChange = () => {
      const saved = localStorage.getItem('pinnedPanes');
      setPinnedPanes(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener('pinnedPanesChanged', handlePinChange);
    return () => window.removeEventListener('pinnedPanesChanged', handlePinChange);
  }, []);

  const handleLogin = (newToken: string) => setToken(newToken);

  const [tempPaneData, setTempPaneData] = useState<EditPaneData | null>(null);

  const handleSavePane = async () => {
    const dataToSave = {
      target: displayPaneId, 
      title: tempPaneData?.title ?? paneTitle, 
      workspace: tempPaneData?.workspace ?? paneWorkspace, 
      agent_duty: tempPaneData?.agent_duty ?? paneAgentDuty, 
      agent_type: tempPaneData?.agent_type ?? paneAgentType, 
      init_script: tempPaneData?.init_script ?? paneInitScript,
      config: tempPaneData?.config ?? paneConfig,
      tg_token: tempPaneData?.tg_token ?? paneTgToken,
      tg_chat_id: tempPaneData?.tg_chat_id ?? paneTgChatId,
      tg_enable: tempPaneData?.tg_enable ?? paneTgEnable,
      ttyd_preview: tempPaneData?.ttyd_preview ?? paneTtydPreview
    };
    
    // Validate and set default config
    let configToSave = dataToSave.config?.trim() || '';
    if (!configToSave) {
      configToSave = '{"previewUrls": []}';
    } else {
      try {
        JSON.parse(configToSave);
      } catch (e) {
        alert('Invalid JSON in Config field. Please fix the syntax.');
        return;
      }
    }
    dataToSave.config = configToSave;
    
    setIsSavingPane(true);
    try {
      // Add :main.0 suffix if not present
      const paneIdToSave = CurrentPaneId.includes(':') ? CurrentPaneId : `${CurrentPaneId}:main.0`;
      await apiService.updateTtydConfig(paneIdToSave, dataToSave);
      setPaneTitle(dataToSave.title || CurrentPaneId);
        setPaneWorkspace(dataToSave.workspace || '/home/w3c_offical');
        setPaneAgentDuty(dataToSave.agent_duty || '');
        setPaneAgentType(dataToSave.agent_type || '');
        setPaneInitScript(dataToSave.init_script || '');
        setPaneConfig(configToSave);
        setPaneTgToken(dataToSave.tg_token || '');
        setPaneTgChatId(dataToSave.tg_chat_id || '');
        setPaneTgEnable(dataToSave.tg_enable || false);
        setPaneTtydPreview(dataToSave.ttyd_preview || '');
        
        // Update previewUrls from saved config
        try {
          const config = JSON.parse(configToSave);
          setPreviewUrls(config.previewUrls || []);
        } catch (e) {
          console.error('Failed to parse config:', e);
        }
        
        document.title = dataToSave.title || CurrentPaneId;
        setTempPaneData(null);
    } catch (e) { console.error('Failed to save pane:', e); }
    finally { setIsSavingPane(false); }
  };

  // --- Render ---
  if (isCheckingAuth) return (
    <div className="bg-vsc-bg w-screen h-screen flex items-center justify-center">
      <Loader2 size={48} className="text-vsc-accent animate-spin" />
    </div>
  );

  if (!token) return <LoginForm onLogin={handleLogin} />;

  if (!isLoaded) return <div className="bg-vsc-bg w-screen h-screen" />;


  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans" >
      {
        <div id="main" className="fixed inset-0"> 

        {/* Column 1: Left - Agents List */}
        <div id="left-side" className="absolute inset-y-0 left-0 w-[240px] bg-vsc-bg-secondary border-r border-vsc-border z-10">
          <LeftSidePanel />
        </div>

        {/* Column 3: Right - Code/Agents/Preview/Settings */}
        <div id="right-side" className="absolute inset-0 bg-vsc-bg" style={{left: `calc(240px + ${ttydWidth}px)`, width: `calc(100vw - 240px - ${ttydWidth}px - 4px)`}}>
          <div id="right-side-top" className="absolute top-0 left-0 right-0 h-10 bg-vsc-bg-titlebar border-b border-vsc-border flex items-center gap-1 px-2 z-10">
            {([ 'Code', 'Agents', 'Preview', 'Settings', 'Global'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  localStorage.setItem(`${CurrentPaneId}_activeTab`, tab);
                }}
                className={`px-4 py-1 rounded text-sm ${activeTab === tab ? 'bg-vsc-bg text-vsc-text' : 'text-vsc-text-secondary hover:text-vsc-text hover:bg-vsc-bg-hover'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          {isInteracting && <div className="absolute inset-0 z-20"></div>}
            {paneWorkspace && (
              <div id="right-side-inner" className="absolute inset-0 flex flex-col" style={{marginTop: '40px', display: activeTab === 'Code' ? 'flex' : 'none'}}>
                {/* 区域 A: Code Server - 蓝色背景 */}
                <div  id="right-side-code-server"  className="w-full flex-1 overflow-hidden flex flex-col">
                  {/* Home + Path Input */}
                  <div className=".bg-vsc-bg h-8 border-b border-vsc-border flex items-center px-2 gap-2 flex-shrink-0">
                    <button 
                      onClick={() => navigateToPath(paneDetail?.workspace || paneWorkspace, true)}
                      className="p-1 text-vsc-text-secondary hover:text-vsc-text hover:bg-vsc-bg-hover rounded"
                      title="Home"
                    >
                      <Home size={16} />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setShowFavorDirs(!showFavorDirs)}
                        className="p-1 text-vsc-text-secondary hover:text-vsc-text hover:bg-vsc-bg-hover rounded"
                        title="Favorite Directories"
                      >
                        <Folder size={16} />
                      </button>
                      {showFavorDirs && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowFavorDirs(false)}></div>
                          <div className="absolute top-full left-0 mt-1 bg-vsc-bg-secondary border border-vsc-border rounded shadow-lg z-20 min-w-[400px] max-w-[600px]">
                            {favorDirs.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-vsc-text-secondary">No favorite directories</div>
                            ) : (
                              favorDirs.map((dir, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    navigateToPath(dir);
                                    setShowFavorDirs(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-vsc-text hover:bg-vsc-bg-hover"
                                >
                                  {dir}
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <input 
                      className="flex-1 bg-vsc-bg text-vsc-text px-2 py-1 text-sm border border-vsc-border rounded" 
                      value={paneWorkspace} 
                      onChange={(e) => setPaneWorkspace(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          navigateToPath(paneWorkspace);
                        }
                      }}
                    />
                  </div>
                  <WebFrame codeServer loading="lazy" src={urls.codeServer(paneWorkspace)} className="code-server-iframe w-full flex-1" />
                </div>
                {isDragging && <div className="absolute inset-0 z-20"></div>}
              </div>
            )}
          {activeTab === 'Preview' && (
            <>
              {!globalVar?.favor?.previewUrls || globalVar.favor.previewUrls.filter((item: any) => item.enable).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full bg-vsc-bg" style={{marginTop: '40px'}}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-vsc-text-muted mb-4">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  <p className="text-vsc-text-muted text-sm">No preview URLs found</p>
                </div>
              ) : (
                <>
                  <div style={{position: 'absolute', top: '40px', left: 0, right: 0, height: '32px', background: '#2a2d2e', borderBottom: '1px solid #474747', display: 'flex', gap: '4px', padding: '4px'}}>
                    {globalVar.favor.previewUrls.filter((item: any) => item.enable).map((item: any, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPreviewTab(idx);
                          localStorage.setItem(`${CurrentPaneId}_previewTab`, idx.toString());
                        }}
                        style={{
                          padding: '4px 12px',
                          fontSize: '13px',
                          background: previewTab === idx ? '#474747' : 'transparent',
                          color: previewTab === idx ? '#fff' : '#858585',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {item.name || `URL ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                  {globalVar.favor.previewUrls.filter((item: any) => item.enable).map((item: any, idx) => (
                    <div key={idx} className="absolute inset-0" style={{marginTop: '72px', display: previewTab === idx ? 'block' : 'none'}}>
                      <WebFrame
                        src={item.url || item}
                        className="w-full h-full"
                      />
                      {isDragging && <div className="absolute inset-0 z-20"></div>}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          {activeTab === 'Agents' && (
            <div style={{marginTop: '40px', height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column'}}>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-vsc-border">
                {(['All', 'Binded'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAgentsSubTab(tab)}
                    className={`px-3 py-1 rounded text-sm ${agentsSubTab === tab ? 'bg-vsc-button text-vsc-button-text' : 'text-vsc-text-secondary hover:text-vsc-text hover:bg-vsc-bg-hover'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto">
                {agentsSubTab === 'All' && (
                  <AgentsRightView 
                    token={token} 
                    existingTabs={[]} 
                    onAddAgent={(paneId, url) => {
                      console.log('Bind agent:', paneId, url);
                    }}
                    onNewAgent={async () => {
                      if (!confirm('Create a new agent?')) return;
                      try {
                        const { data } = await apiService.createPane({
                            win_name: `Agent-${Date.now()}`,
                            workspace: '',
                            init_script: 'pwd'
                          });
                        if (data.pane_id) {
                          alert(`Created: ${data.pane_id}`);
                        } else {
                          alert(`Failed: ${data.detail || 'Unknown error'}`);
                        }
                      } catch (err) {
                        alert(`Error: ${err}`);
                      }
                    }}
                  />
                )}
                {agentsSubTab === 'Binded' && (
                  <AgentsListView 
                    paneId={CurrentPaneId} 
                    token={token} 
                    isDragging={isDragging} 
                    onAgentsChange={(agents) => setBoundAgents(agents)} 
                    onCaptureOpen={() => {}}
                  />
                )}
              </div>
            </div>
          )}
          {activeTab === 'Settings' && (
            <div style={{marginTop: '40px', height: 'calc(100% - 40px)', position: 'relative'}}>
              {!tempPaneData ? (
                <div className="absolute inset-0 flex items-center justify-center bg-vsc-bg bg-opacity-80 z-50">
                  <Loader2 className="w-8 h-8 text-vsc-text-secondary animate-spin" />
                </div>
              ) : (
                <SettingsView 
                  pane={tempPaneData}
                  onChange={(pane) => setTempPaneData(pane)}
                onSave={async () => {
                  if (!tempPaneData || !tempPaneData.target) return;
                  setIsSavingPane(true);
                  try {
                    const { target, ...dataToSave } = tempPaneData;
                    await apiService.updatePane(target, dataToSave);
                    
                    // Update paneDetail immediately
                    if (api) {
                      const { data: updated } = await api.getPane(target);
                      setPaneDetail(updated);
                    }
                    
                    // Update allPanes with new data
                    updatePane(target, {
                      title: tempPaneData.title,
                      workspace: tempPaneData.workspace,
                      agent_type: tempPaneData.agent_type,
                      agent_duty: tempPaneData.agent_duty
                    });
                  } catch (err) {
                    console.error('Failed to save pane:', err);
                  } finally {
                    setIsSavingPane(false);
                  }
                }}
                isSaving={isSavingPane}
                />
              )}
            </div>
          )}
          {activeTab === 'Global' && (
            <div style={{marginTop: '40px', height: 'calc(100% - 40px)', padding: '16px'}}>
              <div className="flex flex-col h-full">
                <label className="block text-xs text-vsc-text-secondary mb-2">Global Settings (JSON)</label>
                <textarea 
                  id="global-settings-textarea"
                  defaultValue={JSON.stringify(globalVar, null, 2)}
                  className="flex-1 w-full bg-vsc-bg-secondary border border-vsc-border text-vsc-text text-sm font-mono rounded px-3 py-2 focus:outline-none focus:border-vsc-accent resize-none"
                />
                <button 
                  onClick={async () => {
                    try {
                      const textarea = document.getElementById('global-settings-textarea') as HTMLTextAreaElement;
                      const data = JSON.parse(textarea.value);
                      await updateGlobalVar(data);
                      setToast('Global settings saved');
                      setTimeout(() => setToast(null), 3000);
                    } catch (err) {
                      setToast('Invalid JSON or save failed');
                      setTimeout(() => setToast(null), 3000);
                    }
                  }} 
                  className="mt-3 w-full bg-vsc-button hover:bg-vsc-button-hover text-white text-sm font-medium py-2 rounded"
                >
                  Save Global Settings
                </button>
              </div>
            </div>
          )}
          {isDragging && activeTab !== 'Settings' && activeTab !== 'Agents' && activeTab !== 'Global' && <div className="absolute inset-0 z-20"></div>}
        </div>
        <div id="drag" 
          className="absolute inset-y-0 w-1 bg-vsc-border hover:bg-vsc-accent cursor-col-resize z-10"
          style={{left: `calc(240px + ${ttydWidth}px)`}}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
            const startX = e.clientX;
            const startWidth = ttydWidth;
            let currentWidth = startWidth;
            const onMouseMove = (e: MouseEvent) => {
              const newWidth = Math.max(200, Math.min(window.innerWidth - 560, e.clientX - 360));
              currentWidth = newWidth;
              setTtydWidth(newWidth);
            };
            const onMouseUp = () => {
              setIsDragging(false);
              localStorage.setItem(`${CurrentPaneId}_ttydWidth`, currentWidth.toString());
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          }}
        ></div>
        {/* Column 2: Middle - Terminal */}
        <div 
          id="main-middle" 
          className="absolute inset-0" 
          style={{width: `${ttydWidth}px`, left: '240px'}}
          onMouseLeave={(e) => {
            const target = e.currentTarget.querySelector('.ttyd-mask') as HTMLElement;
            if (target) target.style.display = 'block';
          }}
        >
          <div className="h-10 bg-vsc-bg-titlebar border-b border-vsc-border flex items-center justify-between px-2">
            <div id="main-middle-topbar" className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative group flex items-center gap-1">
                <button
                  className="px-3 py-1 rounded text-sm bg-vsc-button text-vsc-button-text"
                >
                  {displayPaneTitle}
                </button>
                {displayPaneId && (
                  <button
                    onClick={() => {
                      const isPinned = pinnedPanes.includes(displayPaneId);
                      const updated = isPinned 
                        ? pinnedPanes.filter((id: string) => id !== displayPaneId)
                        : [...pinnedPanes, displayPaneId];
                      setPinnedPanes(updated);
                      localStorage.setItem('pinnedPanes', JSON.stringify(updated));
                      window.dispatchEvent(new CustomEvent('pinnedPanesChanged'));
                    }}
                    className="p-1 hover:bg-vsc-bg-hover rounded"
                    title={pinnedPanes.includes(displayPaneId) ? 'Unpin' : 'Pin'}
                  >
                    <Pin className={`w-4 h-4 ${pinnedPanes.includes(displayPaneId) ? 'text-yellow-500 fill-yellow-500' : 'text-vsc-text-secondary'}`} />
                  </button>
                )}
                <span className="text-xs text-vsc-text-secondary px-2">v0.0.3</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-vsc-text-secondary">
                <div className={`w-2 h-2 rounded-full ${networkStatus === 'excellent' ? 'bg-green-500' : networkStatus === 'good' ? 'bg-yellow-500' : networkStatus === 'poor' ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                <span>{networkLatency}ms</span>
              </div>
              <div className="relative">
                <button 
                  type="button" 
                  onClick={() => setShowMoreMenu(!showMoreMenu)} 
                  className="p-1 rounded text-vsc-text-secondary hover:text-vsc-text hover:bg-vsc-bg-active transition-colors" 
                  title="More"
                >
                  <MoreVertical size={16} />
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)}></div>
                    <div id="middle-top-dropdown" className="absolute right-0 top-full mt-1 bg-vsc-bg border border-vsc-border rounded shadow-lg z-50 min-w-[180px]">
                      <button 
                        type="button" 
                        onClick={async () => {
                          const paneId = displayPaneId.replace(':main.0', '');
                          await apiService.chooseSession(paneId);
                          setShowMoreMenu(false);
                        }} 
                        className="w-full px-3 py-2 text-left text-xs text-vsc-text hover:bg-vsc-bg-hover"
                      >
                        ^bs Choose Session
                      </button>
                      <button 
                        type="button" 
                        onClick={async () => {
                          const paneId = displayPaneId.replace(':main.0', '');
                          await apiService.splitPane(paneId, 'v');
                          setShowMoreMenu(false);
                        }} 
                        className="w-full px-3 py-2 text-left text-xs text-vsc-text hover:bg-vsc-bg-hover flex items-center gap-2"
                      >
                        <SplitSquareVertical size={12} /> Split Horizontal
                      </button>
                      <button 
                        type="button" 
                        onClick={async () => {
                          const paneId = displayPaneId.replace(':main.0', '');
                          await apiService.splitPane(paneId, 'h');
                          setShowMoreMenu(false);
                        }} 
                        className="w-full px-3 py-2 text-left text-xs text-vsc-text hover:bg-vsc-bg-hover flex items-center gap-2"
                      >
                        <SplitSquareHorizontal size={12} /> Split Vertical
                      </button>
                      <button 
                        type="button" 
                        onClick={async () => {
                          const paneId = displayPaneId.replace(':main.0', '');
                          await apiService.unsplitPane(paneId);
                          setShowMoreMenu(false);
                        }} 
                        className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-vsc-bg-hover flex items-center gap-2"
                      >
                        <XSquare size={12} /> Close Split
                      </button>
                      <div className="border-t border-vsc-border my-1"></div>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (confirm('Reload this page?')) {
                            if (mainIframeRef.current) {
                              mainIframeRef.current.src = mainIframeRef.current.src;
                            }
                          }
                          setShowMoreMenu(false);
                        }} 
                        className="w-full px-3 py-2 text-left text-xs text-vsc-text hover:bg-vsc-bg-hover flex items-center gap-2"
                      >
                        <RefreshCw size={12} /> Reload
                      </button>
                      {hasPermission('prompt') && (
                        <button 
                          type="button" 
                          onClick={() => {
                            handleRestart();
                            setShowMoreMenu(false);
                          }} 
                          className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-vsc-bg-hover flex items-center gap-2"
                        >
                          <RefreshCw size={12} className={isRestarting ? 'animate-spin' : ''} /> Restart
                        </button>
                      )}
                      <div className="border-t border-vsc-border my-1"></div>
                      <button 
                        type="button" 
                        onClick={() => {
                          window.open(urls.ttydOpen(displayPaneId, token), '_blank');
                          setShowMoreMenu(false);
                        }} 
                        className="w-full px-3 py-2 text-left text-xs text-vsc-text hover:bg-vsc-bg-hover flex items-center gap-2"
                      >
                        <ExternalLink size={12} /> Open in New Tab
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          confirmDialog(
                            `Remove agent ${displayPaneId}? This will delete the pane.`,
                            async () => {
                              await apiService.deleteAgent(displayPaneId);
                              const otherPane = allPanes.find(p => p.pane_id !== displayPaneId);
                              if (otherPane) selectPane(otherPane.pane_id);
                            }
                          );
                          setShowMoreMenu(false);
                        }} 
                        className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-vsc-bg-hover flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Remove Agent
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div id="main-middle-content" className="relative w-full" style={{height: hasPermission('prompt') ? `calc(100% - 40px - ${commandPanelHeight}px)` : 'calc(100% - 40px)'}}>
            
            {showHistoryOverlay && historyData && (
              <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', flexDirection: 'column'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #474747', backgroundColor: '#1e1e1e'}}>
                  <span style={{fontSize: '14px', color: '#cccccc', fontWeight: 500}}>Command History</span>
                  <button onClick={() => setShowHistoryOverlay(false)} style={{color: '#858585', background: 'none', border: 'none', cursor: 'pointer'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div style={{flex: 1, overflowY: 'auto'}}>
                  {historyData.history.map((cmd, idx) => (
                    <div 
                      key={idx}
                      style={{padding: '12px 16px', borderBottom: '1px solid #2a2d2e', cursor: 'pointer', color: '#cccccc', backgroundColor: '#1e1e1e', display: 'flex', alignItems: 'center', gap: '8px'}}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#2a2d2e';
                        const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                        if (btn) btn.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1e1e1e';
                        const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                        if (btn) btn.style.opacity = '0';
                      }}
                    >
                      <span 
                        style={{fontSize: '14px', fontFamily: 'monospace', flex: 1}}
                        onClick={() => {
                          historyData.onSelect(cmd);
                          setShowHistoryOverlay(false);
                        }}
                      >{cmd}</span>
                      <button 
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newHistory = historyData.history.filter((_, i) => i !== idx);
                          setHistoryData({...historyData, history: newHistory});
                        }}
                        style={{opacity: 0, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', transition: 'opacity 0.2s'}}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showCommonPromptOverlay && (
              <div style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', flexDirection: 'column'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #474747', backgroundColor: '#1e1e1e'}}>
                  <span style={{fontSize: '14px', color: '#cccccc', fontWeight: 500}}>Common Prompt</span>
                  <button onClick={() => setShowCommonPromptOverlay(false)} style={{color: '#858585', background: 'none', border: 'none', cursor: 'pointer'}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <textarea 
                  value={commonPromptText}
                  onChange={(e) => setCommonPromptText(e.target.value)}
                  style={{flex: 1, padding: '12px 16px', margin: '8px', backgroundColor: '#1e1e1e', color: '#cccccc', border: '1px solid #474747', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px', resize: 'none'}}
                />
                <div style={{padding: '12px 16px', borderTop: '1px solid #474747', backgroundColor: '#1e1e1e', display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
                  <button 
                    onClick={async () => {
                      try {
                        const dataToSave = {common_prompt: commonPromptText};
                        await api.updatePane(displayPaneId, dataToSave);
                        setPaneDetail({...paneDetail, common_prompt: commonPromptText});
                        setToast('Common prompt saved');
                        setTimeout(() => setToast(null), 3000);
                        setShowCommonPromptOverlay(false);
                      } catch (err) {
                        console.error('Save error:', err);
                        setToast('Failed to save');
                        setTimeout(() => setToast(null), 3000);
                      }
                    }}
                    style={{padding: '6px 12px', backgroundColor: '#0e639c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px'}}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
            {/* Terminal iframes - keep all visited panes loaded */}
            {visitedPanes.filter(id => id && id !== '' && id !== 'undefined').map((paneId) => (
              <div 
                key={`terminal-${paneId}`} 
                className="absolute inset-0" 
                style={{
                  backgroundColor:"#474747",
                  zIndex: paneId === displayPaneId ? 1 : 0,
                  visibility: paneId === displayPaneId ? 'visible' : 'hidden'
                }}
              >
                <WebFrame
                  ref={paneId === displayPaneId ? mainIframeRef : undefined}
                  loading="lazy"
                  src={urls.ttyd(paneId, token)}
                  className="w-full h-full"
                  codeServer={true}
                />
              </div>
            ))}
            <div 
              id="main-middle-mask"
              className="ttyd-mask absolute inset-0 bg-transparent z-10"
              style={{display: 'none', pointerEvents: 'auto'}}
              onClick={(e) => {
                window.dispatchEvent(new CustomEvent('selectPane', { detail: { paneId: displayPaneId } }));
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          {isDragging && <div className="absolute inset-0 z-20"></div>}
          {isInteracting && <div className="absolute inset-0 z-20"></div>}
          {hasPermission('prompt') && (
            <div className="absolute bottom-0 left-0 right-0" style={{height: `${commandPanelHeight}px`}}>
              {/* Correction Result */}
              {showCorrectionResult && correctionData ? (
                <div style={{position: 'absolute', bottom: `${commandPanelHeight + 4}px`, left: 0, right: 0, maxHeight: "300px", minHeight: "140px", zIndex: 1000}}>
                  <div style={{width: '100%', height: '100%', backgroundColor: '#1e1e1e', border: '1px solid #474747', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', position: 'relative'}}>
                    {/* Top bar */}
                    <div style={{height: '32px', backgroundColor: '#252526', borderBottom: '1px solid #474747', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0}}>
                      <span style={{fontSize: '12px', color: '#858585', fontWeight: 600, letterSpacing: '0.5px'}}>CORRECTION</span>
                      <button 
                        onClick={() => setShowCorrectionResult(false)}
                        style={{color: '#6a6a6a', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px', transition: 'all 0.2s', display: 'flex', alignItems: 'center'}}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#474747';
                          e.currentTarget.style.color = '#cccccc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = '#6a6a6a';
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: '#474747', overflow: 'hidden'}}>
                      {/* English */}
                      <div 
                        style={{flex: 1, padding: '16px', backgroundColor: '#1e1e1e', position: 'relative', overflowY: 'auto'}}
                        onMouseEnter={(e) => {
                          const btns = e.currentTarget.querySelector('.action-btns') as HTMLElement;
                          if (btns) btns.style.setProperty('opacity', '1', 'important');
                        }}
                        onMouseLeave={(e) => {
                          const btns = e.currentTarget.querySelector('.action-btns') as HTMLElement;
                          if (btns) btns.style.setProperty('opacity', '0', 'important');
                        }}
                      >
                        <div style={{fontSize: '15px', color: '#cccccc', fontFamily: 'monospace', lineHeight: '1.6', fontWeight: 500, paddingRight: '60px'}}>{correctionData?.[0]}</div>
                        <div className="action-btns" style={{opacity: 0, position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', transition: 'opacity 0.2s'}}>
                          <button 
                            onClick={() => navigator.clipboard.writeText(correctionData?.[0] || '')}
                            style={{padding: '6px', backgroundColor: '#252526', color: '#858585', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center'}}
                            onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = '#474747'; e.currentTarget.style.color = '#cccccc';}}
                            onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = '#252526'; e.currentTarget.style.color = '#858585';}}
                            title="Copy"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                          <button 
                            onClick={() => {
                              commandPanelRef.current?.setPrompt(correctionData?.[0] || '');
                              setShowCorrectionResult(false);
                            }}
                            style={{padding: '6px', backgroundColor: '#252526', color: '#858585', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center'}}
                            onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = '#474747'; e.currentTarget.style.color = '#cccccc';}}
                            onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = '#252526'; e.currentTarget.style.color = '#858585';}}
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        </div>
                      </div>
                      {/* Chinese */}
                      <div 
                        style={{flex: 1, padding: '16px', backgroundColor: '#252526', position: 'relative', overflowY: 'auto'}}
                        onMouseEnter={(e) => {
                          const btns = e.currentTarget.querySelector('.action-btns-cn') as HTMLElement;
                          if (btns) btns.style.setProperty('opacity', '1', 'important');
                        }}
                        onMouseLeave={(e) => {
                          const btns = e.currentTarget.querySelector('.action-btns-cn') as HTMLElement;
                          if (btns) btns.style.setProperty('opacity', '0', 'important');
                        }}
                      >
                        <div style={{fontSize: '15px', color: '#858585', fontFamily: 'monospace', lineHeight: '1.6', paddingRight: '60px'}}>{correctionData?.[1]}</div>
                        <div className="action-btns-cn" style={{opacity: 0, position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', transition: 'opacity 0.2s'}}>
                          <button 
                            onClick={() => navigator.clipboard.writeText(correctionData?.[1] || '')}
                            style={{padding: '6px', backgroundColor: '#252526', color: '#858585', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center'}}
                            onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = '#474747'; e.currentTarget.style.color = '#cccccc';}}
                            onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = '#252526'; e.currentTarget.style.color = '#858585';}}
                            title="Copy"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          </button>
                          <button 
                            onClick={() => {
                              commandPanelRef.current?.setPrompt(correctionData?.[1] || '');
                              setShowCorrectionResult(false);
                            }}
                            style={{padding: '6px', backgroundColor: '#252526', color: '#858585', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center'}}
                            onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = '#474747'; e.currentTarget.style.color = '#cccccc';}}
                            onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = '#252526'; e.currentTarget.style.color = '#858585';}}
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              
              <div 
                className="absolute top-0 left-0 right-0 h-1 bg-vsc-border"
                style={{zIndex: 9999999}}
              ></div>
              <CommandPanel
                ref={commandPanelRef}
                paneTarget={displayPaneId}
                title={displayPaneTitle}
                token={token}
                panelPosition={{x: 0, y: 0}}
                panelSize={{width: ttydWidth, height: commandPanelHeight}}
                readOnly={readOnly}
                onReadOnlyToggle={() => setReadOnly(v => !v)}
                onInteractionStart={() => setIsInteracting(true)}
                onInteractionEnd={() => setIsInteracting(false)}
                onChange={(pos, size) => setSettings(prev => ({ ...prev, panelSize: size }))}
                onCapturePane={handleCapturePane}
                isCapturing={isCapturing}
                canSend={agentStatus === 'idle' || agentStatus === 'wait_startup'}
                mode="ttyd"
                onShowHistory={(history, onSelect) => {
                  if (showHistoryOverlay) {
                    setShowHistoryOverlay(false);
                  } else {
                    setHistoryData({history, onSelect});
                    setShowHistoryOverlay(true);
                    setShowCorrectionResult(false);
                  }
                }}
                onShowCorrection={(result) => {
                  if (result === null) {
                    setCorrectionData(null);
                    setShowCorrectionResult(false);
                  } else {
                    setCorrectionData(result);
                    setShowCorrectionResult(true);
                    setShowHistoryOverlay(false);
                  }
                }}
                agentStatus={agentStatus}
                contextUsage={contextUsage}
                mouseMode={mouseMode}
                onDraggingChange={setIsDragging}
                isTogglingMouse={false}
                onToggleMouse={handleToggleMouse}
                onReload={() => {
                  if (mainIframeRef.current) {
                    mainIframeRef.current.src = mainIframeRef.current.src;
                  }
                }}
                boundAgents={boundAgents}
                onRestart={handleRestart}
                isRestarting={isRestarting}
                hasEditPermission={hasPermission('agent_manage')}
                hasRestartPermission={hasPermission('prompt')}
                hasCapturePermission={hasPermission('ttyd_read')}
                networkLatency={networkLatency}
                networkStatus={networkStatus}
                disableDrag={true}
                showVoiceControl={settings.showVoiceControl}
                onToggleVoiceControl={() => {
                  setSettings(prev => ({ ...prev, showVoiceControl: !prev.showVoiceControl}))
                }}
              />
            </div>
          )}
        </div>

      </div>
      }
      



      {settings.showVoiceControl && hasPermission('prompt') && (
        <div style={{position:"fixed",zIndex:1111111,top:0,right:0,left:0,height:32,pointerEvents:"none"}}><div style={{pointerEvents:"auto",display:"inline-block"}}>
        <VoiceFloatingButton
          initialPosition={settings.voiceButtonPosition}
          onPositionChange={pos => setSettings(prev => ({ ...prev, voiceButtonPosition: pos }))}
          onRecordStart={() => startRecording('direct')}
          onRecordEnd={(shouldSend) => stopRecording(shouldSend)}
          isRecordingExternal={isListening && voiceMode === 'direct'}
          disabled={false}
        />
        </div></div>
      )}

      {/* Edit pane dialog - full page */}
      <EditPaneDialog
        open={!!editingPane}
        pane={editingPane}
        mode="full"
        onChange={setEditingPane}
        onClose={() => setEditingPane(null)}
        onSave={handleSavePane}
      />

      {/* Capture output modal - full page */}
      <CaptureDialog 
        output={captureOutput}
        onClose={() => setCaptureOutput(null)}
        onRefresh={(paneId, lines) => {
          setCaptureOutput('');
          handleCapturePane(paneId, lines);
        }}
        isRefreshing={isCapturing}
        paneId={displayPaneId}
      />




      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded shadow-xl" style={{zIndex: 999999999}}>
          {toast}
        </div>
      )}

      {/* Desktop Dialog */}
      {activeDialog === 'desktop' && (
        <div className="fixed inset-0 bg-black/80 z-[9999999] flex items-center justify-center" onClick={closeDialog}>
          <div className="w-full h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="h-10 bg-vsc-bg-titlebar border-b border-vsc-border flex items-center justify-between px-3">
              <span className="text-sm text-vsc-text font-medium">Desktop</span>
              <button onClick={closeDialog} className="p-1 hover:bg-vsc-bg-hover rounded text-vsc-text-secondary hover:text-vsc-text">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <iframe src={urls.desktop(token)} className="flex-1 w-full border-none" />
          </div>
        </div>
      )}
      
      
      {/* Add Agent Dialog - Top Level */}
      {activeDialog === 'addAgent' && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{width: '90%', height: '90%', backgroundColor: '#1e1e1e', borderRadius: '8px', overflow: 'hidden'}}>
            <AgentsRightView token={token} existingTabs={agentTabs.map(t => t.paneId)} onAddAgent={(paneId, title,url) => {
              console.log('Adding agent:', paneId, 'URL:', url);
              if (!agentTabs.find(t => t.paneId === paneId)) {
                setAgentTabs([...agentTabs, {paneId,title, url, closable: true}]);
              }
              setActiveAgentTab(paneId);
              closeDialog();
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
