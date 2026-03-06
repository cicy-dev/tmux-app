import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useApp } from '../contexts/AppContext';
import { useDialog } from '../contexts/DialogContext';

const statusConfig: Record<string, { color: string; label: string }> = {
  idle: { color: 'bg-green-500', label: 'idle' },
  thinking: { color: 'bg-yellow-500 animate-pulse', label: 'thinking' },
  wait_auth: { color: 'bg-red-500', label: 'auth' },
  wait_startup: { color: 'bg-blue-500 animate-pulse', label: 'starting' },
  compacting: { color: 'bg-purple-500 animate-pulse', label: 'compact' },
};

const LeftSidePanel: React.FC<{onCollapse?: () => void}> = ({onCollapse}) => {
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

  const getStatusInfo = (pane: any) => {
    if (pane.isThinking) return statusConfig.thinking;
    if (pane.isWaitingAuth) return statusConfig.wait_auth;
    if (pane.isWaitStartup) return statusConfig.wait_startup;
    if (pane.isCompacting) return statusConfig.compacting;
    if (pane.status) return statusConfig[pane.status] || { color: 'bg-gray-500', label: pane.status };
    return { color: 'bg-gray-600', label: '' };
  };

  const formatTimeAgo = (ts: number | string | null) => {
    if (!ts) return '';
    const sec = typeof ts === 'number' ? ts : Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    return `${Math.floor(sec / 86400)}d`;
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    closeDialog();
    setNewTitle('');
  };

  const togglePin = (paneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPinned = pinnedPanes.includes(paneId);
    const updated = isPinned ? pinnedPanes.filter(id => id !== paneId) : [...pinnedPanes, paneId];
    setPinnedPanes(updated);
    localStorage.setItem('pinnedPanes', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('pinnedPanesChanged'));
  };

  const filtered = allPanes.filter((p: any) =>
    (p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.pane_id?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    const ap = pinnedPanes.includes(a.pane_id) ? 0 : 1;
    const bp = pinnedPanes.includes(b.pane_id) ? 0 : 1;
    return ap - bp;
  });

  return (
    <div className="h-full flex flex-col bg-vsc-bg-secondary">
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-vsc-border flex-shrink-0">
        <span className="text-xs font-semibold text-vsc-text-secondary uppercase tracking-wider">Agents</span>
        <div className="flex items-center gap-1">
          <button onClick={() => openDialog('createAgent')} className="p-1 rounded text-vsc-text-secondary hover:text-vsc-text hover:bg-vsc-bg-hover" title="New agent">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          {onCollapse && (
            <button onClick={onCollapse} className="p-1 rounded text-vsc-text-secondary hover:text-vsc-text hover:bg-vsc-bg-hover" title="Collapse">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 flex-shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="w-full bg-vsc-bg border border-vsc-border text-vsc-text text-xs rounded px-2 py-1 focus:outline-none focus:border-vsc-accent"
        />
      </div>

      {/* Pane list */}
      <div className="flex-1 overflow-auto">
        {sorted.map((pane: any) => {
          const isActive = currentPaneId === pane.pane_id;
          const isPinned = pinnedPanes.includes(pane.pane_id);
          const si = getStatusInfo(pane);
          const title = (isActive && paneDetail?.title) ? paneDetail.title : (pane.title || pane.pane_id);
          const shortId = pane.pane_id?.replace(':main.0', '');

          return (
            <div
              key={pane.pane_id}
              onClick={() => selectPane(pane.pane_id)}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-l-2 transition-colors ${
                isActive
                  ? 'bg-vsc-bg-active border-l-blue-500'
                  : isPinned
                    ? 'border-l-yellow-600 border-opacity-50 hover:bg-vsc-bg-hover'
                    : 'border-l-transparent hover:bg-vsc-bg-hover'
              }`}
            >
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${si.color}`} title={si.label} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm truncate ${isActive ? 'text-vsc-text font-medium' : 'text-vsc-text-secondary'}`}>
                    {title}
                  </span>
                  {isPinned && <span className="text-yellow-500 text-xs flex-shrink-0">📌</span>}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-vsc-text-secondary">
                  <span>{shortId}</span>
                  {si.label && <span className={`${si.color.replace('animate-pulse', '')} bg-opacity-20 px-1 rounded`}>{si.label}</span>}
                  {pane.contextUsage != null && <span>{pane.contextUsage}%</span>}
                  {pane.timeAgo != null && <span>{formatTimeAgo(pane.timeAgo)}</span>}
                </div>
              </div>

              {/* Pin on hover */}
              <button
                onClick={(e) => togglePin(pane.pane_id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-vsc-text-secondary hover:text-yellow-500 transition-opacity"
                title={isPinned ? 'Unpin' : 'Pin'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Create dialog */}
      {activeDialog === 'createAgent' && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999999]" onClick={closeDialog}>
          <div className="bg-vsc-bg border border-vsc-border rounded-lg p-4 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-vsc-text text-sm font-semibold mb-3">New Agent</h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Agent title..."
              className="w-full bg-vsc-bg-secondary border border-vsc-border text-vsc-text text-sm rounded px-3 py-2 mb-3 focus:outline-none focus:border-vsc-accent"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { closeDialog(); setNewTitle(''); }} className="px-3 py-1.5 text-xs bg-vsc-bg-secondary hover:bg-vsc-bg-active text-vsc-text rounded">Cancel</button>
              <button onClick={handleCreate} disabled={!newTitle.trim()} className="px-3 py-1.5 text-xs bg-vsc-button hover:bg-vsc-button-hover disabled:opacity-40 text-white rounded">Create</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default LeftSidePanel;
