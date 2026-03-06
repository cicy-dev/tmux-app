import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useApp } from '../contexts/AppContext';
import { useDialog } from '../contexts/DialogContext';

const LeftSidePanel: React.FC = () => {
  const { allPanes, currentPaneId, selectPane, paneDetail } = useApp();
  const { openDialog, closeDialog, activeDialog } = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedPanes, setPinnedPanes] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedPanes');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    const handlePinChange = () => {
      const saved = localStorage.getItem('pinnedPanes');
      setPinnedPanes(saved ? JSON.parse(saved) : []);
    };
    window.addEventListener('pinnedPanesChanged', handlePinChange);
    return () => window.removeEventListener('pinnedPanesChanged', handlePinChange);
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = Math.floor((now - time) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getAvatar = (paneId: string, agentType?: string) => {
    if (agentType === 'kiro-cli') return '🤖';
    if (agentType === 'opencode') return '💻';
    const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];
    const hash = paneId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return emojis[hash % emojis.length];
  };

  const getAvatarColor = (paneId: string) => {
    const colors = [
      'bg-red-600', 'bg-orange-600', 'bg-yellow-600', 'bg-green-600',
      'bg-teal-600', 'bg-blue-600', 'bg-indigo-600', 'bg-purple-600',
      'bg-pink-600', 'bg-rose-600'
    ];
    const hash = paneId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    console.log('Create pane with title:', newTitle);
    closeDialog();
    setNewTitle('');
  };

  const filteredPanes = allPanes.filter((pane: any) =>
    (pane.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     pane.pane_id?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedPanes = [...filteredPanes].sort((a, b) => {
    const aPin = pinnedPanes.includes(a.pane_id);
    const bPin = pinnedPanes.includes(b.pane_id);
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    return 0;
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-vsc-border flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search agents..."
          className="flex-1 bg-vsc-bg-secondary border border-vsc-border text-vsc-text text-sm rounded px-3 py-1.5 focus:outline-none focus:border-vsc-accent"
        />
        <button
          onClick={() => openDialog('createAgent')}
          className="bg-vsc-button hover:bg-vsc-button-hover text-white px-3 py-1.5 rounded text-sm"
          title="创建新 Agent"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {sortedPanes.map((pane: any) => {
          const isPinned = pinnedPanes.includes(pane.pane_id);
          return (
            <div
              key={pane.pane_id}
              onClick={() => selectPane(pane.pane_id)}
              className={`group p-3 border-b border-vsc-border hover:bg-vsc-bg-hover cursor-pointer ${
                currentPaneId === pane.pane_id ? 'bg-blue-600 bg-opacity-30 border-l-4 border-l-blue-500' : isPinned ? 'bg-yellow-900 bg-opacity-20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-2 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(pane.pane_id)} bg-opacity-20 flex items-center justify-center text-xl flex-shrink-0`}>
                    {getAvatar(pane.pane_id, pane.agent_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-medium text-vsc-text truncate">
                        {currentPaneId === pane.pane_id && paneDetail?.title
                          ? paneDetail.title
                          : (pane.title || pane.pane_id)}
                      </div>
                      {pane.agent_type && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600 bg-opacity-30 text-purple-400 flex-shrink-0">
                          {pane.agent_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-vsc-text-secondary">
                      <span className="truncate">{pane.pane_id}</span>
                      {pane.status && (
                        <>
                          <span>•</span>
                          <span className={`flex-shrink-0 ${
                            pane.status === 'idle' ? 'text-green-400' :
                            pane.status === 'thinking' ? 'text-yellow-400' :
                            pane.status === 'wait_auth' ? 'text-red-400' :
                            'text-gray-400'
                          }`}>
                            {pane.status}
                          </span>
                        </>
                      )}
                      {pane.updated_at && (
                        <>
                          <span>•</span>
                          <span className="flex-shrink-0">{formatTimeAgo(pane.updated_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeDialog === 'createAgent' && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999999]" onClick={closeDialog}>
          <div className="bg-vsc-bg border border-vsc-border rounded p-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-vsc-text font-semibold mb-3">创建新 Agent</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="输入 Agent 标题..."
              className="w-full bg-vsc-bg-secondary border border-vsc-border text-vsc-text text-sm rounded px-3 py-2 mb-4 focus:outline-none focus:border-vsc-accent"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { closeDialog(); setNewTitle(''); }}
                className="px-4 py-1.5 text-sm bg-vsc-bg-secondary hover:bg-vsc-bg-active text-vsc-text rounded"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 text-sm bg-vsc-button hover:bg-vsc-button-hover disabled:bg-vsc-bg-active disabled:cursor-not-allowed text-white rounded"
              >
                创建
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LeftSidePanel;
