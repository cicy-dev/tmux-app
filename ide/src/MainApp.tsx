import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { CommandPanelHandle } from './components/CommandPanel';
import { VoiceFloatingButton } from './components/VoiceFloatingButton';
import { LoginForm } from './components/LoginForm';
import { AgentsBrowser } from './components/AgentsBrowser';
import apiService from './services/api';
import { useDialog } from './contexts/DialogContext';
import { usePane } from './contexts/PaneContext';
import { useVoice } from './contexts/VoiceContext';
import { useApp } from './contexts/AppContext';
import LeftSidePanel from './components/LeftSidePanel';
import RightSidePanel from './components/RightSidePanel';
import MainMiddlePanel from './components/MainMiddlePanel';

const App: React.FC = () => {
  const { closeDialog, activeDialog } = useDialog();
  const { currentPaneId, allPanes, loading: appLoading } = useApp();
  const {
    displayPaneId, token, setToken, isCheckingAuth, hasPermission,
    ttydWidth, setTtydWidth, isDragging, setIsDragging,
    leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed,
    agentTabs, setAgentTabs, setActiveAgentTab,
    settings, setSettings, isLoaded,
    toast,
  } = usePane();
  const { isListening, voiceMode, startRecording, stopRecording } = useVoice();

  const [boundAgents, setBoundAgents] = useState<string[]>([]);
  const [pinnedPanes, setPinnedPanes] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedPanes');
    return saved ? JSON.parse(saved) : [];
  });

  const commandPanelRef = useRef<CommandPanelHandle>(null);
  const mainIframeRef = useRef<HTMLIFrameElement>(null);

  // Esc key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeDialog) closeDialog();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog]);

  // Load bound agents
  useEffect(() => {
    if (!token) return;
    apiService.getAgentsByPane(displayPaneId)
      .then(({ data }) => setBoundAgents(data.map((a: any) => a.name)))
      .catch(() => {});
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

  if (isCheckingAuth) return (
    <div className="bg-vsc-bg w-screen h-screen flex items-center justify-center">
      <Loader2 size={48} className="text-vsc-accent animate-spin" />
    </div>
  );
  if (!token) return <LoginForm onLogin={(t) => setToken(t)} />;
  if (!isLoaded) return <div className="bg-vsc-bg w-screen h-screen" />;

  // No pane selected: loading or prompt to create
  if (!currentPaneId) {
    if (appLoading || allPanes.length === 0) {
      return (
        <div className="bg-vsc-bg w-screen h-screen flex flex-col items-center justify-center gap-4">
          {appLoading ? (
            <Loader2 size={48} className="text-vsc-accent animate-spin" />
          ) : (
            <>
              <p className="text-vsc-text-secondary text-sm">No agents found</p>
              <button onClick={() => window.dispatchEvent(new CustomEvent('refresh-panes'))} className="px-4 py-2 bg-vsc-button hover:bg-vsc-button-hover text-white text-sm rounded">Refresh</button>
            </>
          )}
        </div>
      );
    }
  }

  const leftW = leftCollapsed ? 0 : 240;

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans">
      <div id="main" className="fixed inset-0">
        {!leftCollapsed && (
          <div id="left-side" className="absolute inset-y-0 left-0 bg-vsc-bg-secondary border-r border-vsc-border z-10" style={{width: leftW}}>
            <LeftSidePanel />
          </div>
        )}

        {!rightCollapsed && (
          <RightSidePanel ttydWidth={ttydWidth} isDragging={isDragging} setBoundAgents={setBoundAgents} leftWidth={leftW} />
        )}

        {!rightCollapsed && (
          <div id="drag" 
            className="absolute inset-y-0 bg-transparent hover:bg-vsc-accent cursor-col-resize z-10"
            style={{left: `calc(${leftW}px + ${ttydWidth}px - 2px)`, width: '5px'}}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
              const startX = e.clientX;
              const startW = ttydWidth;
              let curW = startW;
              const onMouseMove = (ev: MouseEvent) => { curW = Math.max(200, Math.min(window.innerWidth - leftW - 200, startW + ev.clientX - startX)); setTtydWidth(curW); };
              const onMouseUp = () => { setIsDragging(false); localStorage.setItem(`${displayPaneId}_ttydWidth`, String(curW)); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
              document.addEventListener('mousemove', onMouseMove);
              document.addEventListener('mouseup', onMouseUp);
            }}
          ></div>
        )}

        {/* Global drag overlay to prevent iframes from stealing events */}
        {isDragging && <div className="fixed inset-0 z-[9999] cursor-col-resize" />}

        <MainMiddlePanel ttydWidth={rightCollapsed ? window.innerWidth - leftW : ttydWidth} boundAgents={boundAgents} mainIframeRef={mainIframeRef} commandPanelRef={commandPanelRef} pinnedPanes={pinnedPanes} setPinnedPanes={setPinnedPanes} leftWidth={leftW} leftCollapsed={leftCollapsed} rightCollapsed={rightCollapsed} onToggleLeft={() => setLeftCollapsed(!leftCollapsed)} onToggleRight={() => setRightCollapsed(!rightCollapsed)} />
      </div>

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

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2.5 text-white text-sm font-medium rounded-lg shadow-lg transition-all ${toast?.startsWith('Failed') || toast?.startsWith('Error') ? 'bg-red-500/90' : 'bg-emerald-500/90'}`} style={{zIndex: 999999999}}>{toast}</div>
      )}

      {activeDialog === 'addAgent' && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{width: '90%', height: '90%', backgroundColor: '#1e1e1e', borderRadius: '8px', overflow: 'hidden'}}>
            <AgentsBrowser token={token} existingTabs={agentTabs.map(t => t.paneId)} onAddAgent={(paneId, title, url) => {
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
