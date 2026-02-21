import React, { useState } from 'react';
import { Plus, Layers, Trash2, Edit2, X, Check } from 'lucide-react';
import { TtydGroup } from '../types';
import { getApiUrl } from '../services/apiUrl';

interface Props {
  token: string | null;
  groups: TtydGroup[];
  onGroupsChange: (groups: TtydGroup[]) => void;
  onSelectGroup: (groupId: number) => void;
  selectedGroupId: number | null;
}

export const GroupSidebar: React.FC<Props> = ({
  token,
  groups,
  onGroupsChange,
  onSelectGroup,
  selectedGroupId,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  const loadGroups = async () => {
    if (!token) return;
    try {
      const res = await fetch(getApiUrl('/api/groups'), { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        onGroupsChange(data.groups || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleCreate = async () => {
    if (!createName.trim() || !token) return;
    setIsCreating(true);
    try {
      const res = await fetch(getApiUrl('/api/groups'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: createName.trim(), description: createDesc.trim() }),
      });
      if (res.ok) {
        await loadGroups();
        setShowCreate(false);
        setCreateName('');
        setCreateDesc('');
      }
    } catch (e) { console.error(e); }
    finally { setIsCreating(false); }
  };

  const handleDelete = async (groupId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this group?')) return;
    try {
      await fetch(getApiUrl(`/api/groups/${groupId}`), {
        method: 'DELETE',
        headers: authHeaders(),
      });
      onGroupsChange(groups.filter(g => g.id !== groupId));
    } catch (e) { console.error(e); }
  };

  const handleRename = async (groupId: number) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(getApiUrl(`/api/groups/${groupId}`), {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        onGroupsChange(groups.map(g => g.id === groupId ? { ...g, name: editName.trim() } : g));
      }
    } catch (e) { console.error(e); }
    finally { setEditingId(null); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Layers size={16} className="text-purple-400" />
          Groups
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          title="Create group"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="px-3 py-3 border-b border-gray-800 flex-shrink-0">
          <input
            type="text"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Group name"
            className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded px-2.5 py-1.5 mb-2 focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <input
            type="text"
            value={createDesc}
            onChange={e => setCreateDesc(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Description (optional)"
            className="w-full bg-gray-800 border border-gray-600 text-white text-xs rounded px-2.5 py-1.5 mb-2 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowCreate(false); setCreateName(''); setCreateDesc(''); }}
              className="flex-1 py-1.5 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !createName.trim()}
              className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Group list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {groups.length === 0 ? (
          <div className="text-gray-600 text-xs text-center py-6">No groups yet</div>
        ) : (
          <div className="space-y-0.5">
            {groups.map((group, idx) => {
              const isSelected = selectedGroupId === group.id;
              const isEditing = editingId === group.id;
              const tgColors = ['#E17076','#7BC862','#65AADD','#A695E7','#EE7AAE','#6EC9CB','#FAA774','#5FBEEF'];
              const l = group.name.toLowerCase();
              const knownAvatar: { bg: string; icon: React.ReactNode } | null = (() => {
                if (l.includes('chatgpt') || (l.includes('gpt') && !l.includes('gemini')))
                  return { bg: '#10a37f', icon: <svg viewBox="0 0 24 24" width="15" height="15" fill="white"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg> };
                if (l.includes('gemini'))
                  return { bg: '#1a73e8', icon: <svg viewBox="0 0 24 24" width="15" height="15" fill="white"><path d="M12 2C12 7.5 7.5 12 2 12c5.5 0 10 4.5 10 10 0-5.5 4.5-10 10-10-5.5 0-10-4.5-10-10z"/></svg> };
                if (l.includes('claude'))
                  return { bg: '#d97757', icon: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M4 17.5C7 17.5 12 16 15 10.5S17.5 3 17.5 3"/><path d="M20 17.5C17 17.5 12 16 9 10.5S6.5 3 6.5 3"/></svg> };
                if (l.includes('grok'))
                  return { bg: '#111111', icon: <svg viewBox="0 0 24 24" width="15" height="15" stroke="white" strokeWidth="2.8" strokeLinecap="round" fill="none"><line x1="4" y1="4" x2="20" y2="20"/><line x1="20" y1="4" x2="4" y2="20"/></svg> };
                if (l.includes('kiro'))
                  return { bg: '#FF9900', icon: <svg viewBox="0 0 24 24" width="15" height="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"><line x1="6" y1="4" x2="6" y2="20"/><polyline points="6,12 18,4"/><polyline points="6,12 18,20"/></svg> };
                if (l.includes('opencode') || l.includes('open code'))
                  return { bg: '#6366f1', icon: <svg viewBox="0 0 24 24" width="15" height="15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"><polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/></svg> };
                return null;
              })();
              const fallbackBg = tgColors[idx % tgColors.length];
              const fallbackEmoji = (() => {
                const pool = ['🌟','🎯','🚀','💡','🔥','🎮','🌈','🦋','🎨','💫','🧩','🎲'];
                let h = 0;
                for (let i = 0; i < group.name.length; i++) h = (h * 31 + group.name.charCodeAt(i)) & 0xffff;
                return pool[h % pool.length];
              })();
              const avatarBg = knownAvatar ? knownAvatar.bg : fallbackBg;
              const avatarContent = knownAvatar ? knownAvatar.icon : <span className="text-sm">{fallbackEmoji}</span>;
              return (
                <div
                  key={group.id}
                  onClick={() => !isEditing && onSelectGroup(group.id)}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer group transition-colors ${
                    isSelected ? 'bg-purple-600/30 border border-purple-500/40' : 'hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: avatarBg }}>
                    {avatarContent}
                  </div>

                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(group.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 bg-gray-700 text-white text-sm rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-500 border border-gray-600"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>{group.name}</div>
                      <div className="text-xs text-gray-600">{group.pane_count} pane{group.pane_count !== 1 ? 's' : ''}</div>
                    </div>
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleRename(group.id)} className="p-1 rounded text-green-400 hover:bg-gray-700"><Check size={12} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 rounded text-gray-400 hover:bg-gray-700"><X size={12} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingId(group.id); setEditName(group.name); }}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700" title="Rename"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={e => handleDelete(group.id, e)}
                        className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-gray-700" title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
