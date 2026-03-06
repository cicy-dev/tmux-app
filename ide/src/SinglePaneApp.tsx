import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { CommandPanelHandle } from './components/CommandPanel';
import { VoiceFloatingButton } from './components/VoiceFloatingButton';
import { LoginForm } from './components/LoginForm';
import { EditPaneDialog, EditPaneData } from './components/EditPaneDialog';
import { CaptureDialog } from './components/CaptureDialog';
import { AgentsRightView } from './components/AgentsRightView';
import { urls } from './config';
import apiService from './services/api';
import { useApp } from './contexts/AppContext';
import { useDialog } from './contexts/DialogContext';
import { usePane } from './contexts/PaneContext';
import { useVoice } from './contexts/VoiceContext';
import LeftSidePanel from './components/LeftSidePanel';
import RightSidePanel from './components/RightSidePanel';
import MainMiddlePanel from './components/MainMiddlePanel';

const CurrentPaneId = decodeURIComponent(window.location.href.split("/")[4]);

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const App: React.FC = () => {
  const { paneDetail, api, setPaneDetail } = useApp();
  const { openDialog, closeDialog, activeDialog } = useDialog();
  const {
    displayPaneId, displayPaneTitle, token, setToken, isCheckingAuth, hasPermission,
    ttydWidth, setTtydWidth, isDragging, setIsDragging,
    agentTabs, setAgentTabs, activeAgentTab, setActiveAgentTab,
    settings, setSettings, isLoaded,
    toast, setToast,
    handleCapturePane, captureOutput, setCaptureOutput, isCapturing, commandPanelHeight,
  } = usePane();
  const { isListening, voiceMode, startRecording, stopRecording } = useVoice();

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
  const [editingPane, setEditingPane] = useState<EditPaneData | null>(null);
  const [isSavingPane, setIsSavingPane] = useState(false);
  const [tempPaneData, setTempPaneData] = useState<EditPaneData | null>(null);

  const commandPanelRef = useRef<CommandPanelHandle>(null);
  const mainIframeRef = useRef<HTMLIFrameElement>(null);

  const navigateToPath = async (path: string, forceRefresh = false) => {
    if (!path) return;
    const frame = document.querySelector('.code-server-iframe') as HTMLIFrameElement | HTMLElement;
    if (!frame) return;
    if (!forceRefresh) {
      try {
        const currentSrc = (frame as any).src || frame.getAttribute('src');
        if (currentSrc) {
          const currentFolder = new URL(currentSrc).searchParams.get('folder');
          if (currentFolder === path) return;
        }
      } catch (e) { console.error('Error checking current path:', e); }
    }
    try {
      const { data } = await apiService.fileExists(path);
      if (!data.exists) { setToast(`Path not found: ${path}`); setTimeout(() => setToast(null), 3000); return; }
      const newUrl = urls.codeServer(path);
      if ((frame as any).stop) (frame as any).stop();
      if ((frame as any).src !== undefined) (frame as any).src = newUrl;
      else frame.setAttribute('src', newUrl);
      setPaneWorkspace(path);
    } catch (err) {
      console.error('Failed to check path:', err);
      setToast('Failed to check path');
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Esc key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeDialog) closeDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog]);

  // Load pane config
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
    let configToSave = dataToSave.config?.trim() || '';
    if (!configToSave) { configToSave = '{"previewUrls": []}'; }
    else { try { JSON.parse(configToSave); } catch (e) { alert('Invalid JSON in Config field.'); return; } }
    dataToSave.config = configToSave;
    setIsSavingPane(true);
    try {
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
      try { const config = JSON.parse(configToSave); setPreviewUrls(config.previewUrls || []); } catch {}
      document.title = dataToSave.title || CurrentPaneId;
      setTempPaneData(null);
    } catch (e) { console.error('Failed to save pane:', e); }
    finally { setIsSavingPane(false); }
  };

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

        <div id="left-side" className="absolute inset-y-0 left-0 w-[240px] bg-vsc-bg-secondary border-r border-vsc-border z-10">
          <LeftSidePanel />
        </div>

        <RightSidePanel
          ttydWidth={ttydWidth}
          isDragging={isDragging}
          isInteracting={false}
          setBoundAgents={setBoundAgents}
          navigateToPath={navigateToPath}
        />

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

        <MainMiddlePanel
          ttydWidth={ttydWidth}
          boundAgents={boundAgents}
          mainIframeRef={mainIframeRef}
          commandPanelRef={commandPanelRef}
          pinnedPanes={pinnedPanes}
          setPinnedPanes={setPinnedPanes}
        />

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

      <EditPaneDialog open={!!editingPane} pane={editingPane} mode="full" onChange={setEditingPane} onClose={() => setEditingPane(null)} onSave={handleSavePane} />

      <CaptureDialog output={captureOutput} onClose={() => setCaptureOutput(null)} onRefresh={(paneId, lines) => { setCaptureOutput(''); handleCapturePane(paneId, lines); }} isRefreshing={isCapturing} paneId={displayPaneId} />

      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded shadow-xl" style={{zIndex: 999999999}}>
          {toast}
        </div>
      )}

      {activeDialog === 'addAgent' && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{width: '90%', height: '90%', backgroundColor: '#1e1e1e', borderRadius: '8px', overflow: 'hidden'}}>
            <AgentsRightView token={token} existingTabs={agentTabs.map(t => t.paneId)} onAddAgent={(paneId, title, url) => {
              if (!agentTabs.find(t => t.paneId === paneId)) setAgentTabs([...agentTabs, {paneId, title, url, closable: true}]);
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
