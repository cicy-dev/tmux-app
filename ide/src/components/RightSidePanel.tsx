import React, { useState, useEffect } from 'react';
import { Loader2, Home, Folder } from 'lucide-react';
import { urls } from '../config';
import apiService from '../services/api';
import { WebFrame } from './WebFrame';
import { SettingsView } from './SettingsView';
import { AgentsListView } from './AgentsListView';
import { AgentsRightView } from './AgentsRightView';
import { EditPaneData } from './EditPaneDialog';
import { useApp } from '../contexts/AppContext';
import { usePane, CurrentPaneId } from '../contexts/PaneContext';

interface RightSidePanelProps {
  ttydWidth: number;
  isDragging: boolean;
  setBoundAgents: (agents: string[]) => void;
}

const RightSidePanel: React.FC<RightSidePanelProps> = ({ ttydWidth, isDragging, setBoundAgents }) => {
  const { paneDetail, api, setPaneDetail, updatePane, globalVar, loadGlobalVar, updateGlobalVar } = useApp();
  const { displayPaneId, token, hasPermission, activeTab, setActiveTab, agentsSubTab, setAgentsSubTab, previewTab, setPreviewTab, toast, setToast, isInteracting } = usePane();

  const [paneWorkspace, setPaneWorkspace] = useState<string>('/home/w3c_offical');
  const [showFavorDirs, setShowFavorDirs] = useState(false);
  const [favorDirs, setFavorDirs] = useState<string[]>([]);
  const [tempPaneData, setTempPaneData] = useState<EditPaneData | null>(null);

  const navigateToPath = async (path: string, forceRefresh = false) => {
    if (!path) return;
    const frame = document.querySelector('.code-server-iframe') as HTMLIFrameElement | HTMLElement;
    if (!frame) return;
    if (!forceRefresh) {
      try {
        const currentSrc = (frame as any).src || frame.getAttribute('src');
        if (currentSrc && new URL(currentSrc).searchParams.get('folder') === path) return;
      } catch {}
    }
    try {
      const { data } = await apiService.fileExists(path);
      if (!data.exists) { setToast(`Path not found: ${path}`); setTimeout(() => setToast(null), 3000); return; }
      const newUrl = urls.codeServer(path);
      if ((frame as any).stop) (frame as any).stop();
      if ((frame as any).src !== undefined) (frame as any).src = newUrl;
      else frame.setAttribute('src', newUrl);
      setPaneWorkspace(path);
    } catch {
      setToast('Failed to check path');
      setTimeout(() => setToast(null), 3000);
    }
  };
  const [isSavingPane, setIsSavingPane] = useState(false);

  useEffect(() => {
    if (globalVar?.favor?.dir) setFavorDirs(globalVar.favor.dir);
  }, [globalVar]);

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

  useEffect(() => { setTempPaneData(null); }, [displayPaneId]);

  useEffect(() => {
    if (activeTab === 'Settings' && !paneDetail && api && displayPaneId) {
      api.getPane(displayPaneId).then(({ data }) => setPaneDetail(data)).catch(console.error);
    }
    if (activeTab === 'Global') loadGlobalVar();
  }, [activeTab, displayPaneId, api, loadGlobalVar]);

  // Load workspace from paneDetail
  useEffect(() => {
    if (paneDetail?.workspace) setPaneWorkspace(paneDetail.workspace);
  }, [paneDetail]);

  return (
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
            <div  id="right-side-code-server"  className="w-full flex-1 overflow-hidden flex flex-col">
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
                    if (e.key === 'Enter') navigateToPath(paneWorkspace);
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
                {globalVar.favor.previewUrls.filter((item: any) => item.enable).map((item: any, idx: number) => (
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
              {globalVar.favor.previewUrls.filter((item: any) => item.enable).map((item: any, idx: number) => (
                <div key={idx} className="absolute inset-0" style={{marginTop: '72px', display: previewTab === idx ? 'block' : 'none'}}>
                  <WebFrame src={item.url || item} className="w-full h-full" />
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
                  if (api) {
                    const { data: updated } = await api.getPane(target);
                    setPaneDetail(updated);
                  }
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
  );
};

export default RightSidePanel;
