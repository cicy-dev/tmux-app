import React, { useState } from 'react';
import { X, Check, Search } from 'lucide-react';

interface TmuxPane {
  target: string;
  botName: string;
}

interface TtydConfig {
  title?: string;
}

interface Props {
  panes: TmuxPane[];
  ttydConfigs: Record<string, TtydConfig>;
  currentPaneIds: string[];
  onConfirm: (paneIds: string[]) => void;
  onClose: () => void;
}

export const PanePicker: React.FC<Props> = ({
  panes,
  ttydConfigs,
  currentPaneIds,
  onConfirm,
  onClose,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentPaneIds));
  const [search, setSearch] = useState('');

  const filtered = panes.filter(p => {
    const title = ttydConfigs[p.target]?.title || p.botName || p.target;
    return title.toLowerCase().includes(search.toLowerCase()) || p.target.toLowerCase().includes(search.toLowerCase());
  });

  const toggle = (target: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">Select Panes</h2>
            <p className="text-gray-500 text-xs mt-0.5">{selected.size} selected</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search panes..."
              className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-600"
              autoFocus
            />
          </div>
        </div>

        {/* Pane list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 py-8 text-sm">No panes found</div>
          ) : (
            <div className="space-y-1">
              {filtered.map(p => {
                const title = ttydConfigs[p.target]?.title || p.botName || p.target;
                const isSelected = selected.has(p.target);
                return (
                  <button
                    key={p.target}
                    onClick={() => toggle(p.target)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                        : 'hover:bg-gray-800 border border-transparent text-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-blue-600' : 'bg-gray-700 border border-gray-600'
                    }`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{title}</div>
                      <div className="text-xs text-gray-500 font-mono truncate">{p.target}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear all
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Apply ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
