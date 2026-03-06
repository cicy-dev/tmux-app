import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { CommandPanelHandle } from './components/CommandPanel';
import { VoiceFloatingButton } from './components/VoiceFloatingButton';
import { LoginForm } from './components/LoginForm';
import { CaptureDialog } from './components/CaptureDialog';
import { AgentsRightView } from './components/AgentsRightView';
import apiService from './services/api';
import { useDialog } from './contexts/DialogContext';
import { usePane, CurrentPaneId } from './contexts/PaneContext';
import { useVoice } from './contexts/VoiceContext';
import LeftSidePanel from './components/LeftSidePanel';
import RightSidePanel from './components/RightSidePanel';
import MainMiddlePanel from './components/MainMiddlePanel';

const App: React.FC = () => {
  const { closeDialog, activeDialog } = useDialog();
  const {
    displayPaneId, token, setToken, isCheckingAuth, hasPermission,
    ttydWidth, setTtydWidth, isDragging, setIsDragging,
    agentTabs, setAgentTabs, setActiveAgentTab,
    settings, setSettings, isLoaded,
    toast,
    handleCapturePane, captureOutput, setCaptureOutput, isCapturing,
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
    apiService.getAgentsByPane(CurrentPaneId)
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

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans">
      <div id="main" className="fixed inset-0">
        <div id="left-side" className="absolute inset-y-0 left-0 w-[240px] bg-vsc-bg-secondary border-r border-vsc-border z-10">
          <LeftSidePanel />
        </div>

        <RightSidePanel ttydWidth={ttydWidth} isDragging={isDragging} setBoundAgents={setBoundAgents} />

        <div id="drag" 
          className="absolute inset-y-0 w-1 bg-vsc-border hover:bg-vsc-accent cursor-col-resize z-10"
          style={{left: `calc(240px + ${ttydWidth}px)`}}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
            let currentWidth = ttydWidth;
            const onMouseMove = (ev: MouseEvent) => { currentWidth = Math.max(200, Math.min(window.innerWidth - 560, ev.clientX - 360)); setTtydWidth(currentWidth); };
            const onMouseUp = () => { setIsDragging(false); localStorage.setItem(`${CurrentPaneId}_ttydWidth`, currentWidth.toString()); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          }}
        ></div>

        <MainMiddlePanel ttydWidth={ttydWidth} boundAgents={boundAgents} mainIframeRef={mainIframeRef} commandPanelRef={commandPanelRef} pinnedPanes={pinnedPanes} setPinnedPanes={setPinnedPanes} />
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

      <CaptureDialog output={captureOutput} onClose={() => setCaptureOutput(null)} onRefresh={(paneId, lines) => { setCaptureOutput(''); handleCapturePane(paneId, lines); }} isRefreshing={isCapturing} paneId={displayPaneId} />

      {toast && (
        <div className="fixed bottom-4 right-4 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded shadow-xl" style={{zIndex: 999999999}}>{toast}</div>
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
