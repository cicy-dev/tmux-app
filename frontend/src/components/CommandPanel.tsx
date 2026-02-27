import React, { useEffect ,useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Loader2, CheckCircle, Sparkles, History, X, Check, Clipboard, Keyboard, Mouse, SplitSquareHorizontal, SplitSquareVertical, XSquare } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { Position, Size } from '../types';
import { sendCommandToTmux } from '../services/mockApi';
import { getApiUrl } from '../services/apiUrl';

interface CommandPanelProps {
  paneTarget: string;
  title: string;
  token: string | null;
  panelPosition: Position;
  panelSize: Size;
  readOnly: boolean;
  onReadOnlyToggle: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onChange: (pos: Position, size: Size) => void;
  onCapturePane?: () => void;
  isCapturing?: boolean;
  canSend?: boolean;
  agentStatus?: string;
  contextUsage?: number | null;
}

export interface CommandPanelHandle {
  focusTextarea: () => void;
  setPrompt: (text: string) => void;
}

export const CommandPanel = forwardRef<CommandPanelHandle, CommandPanelProps>(({
  paneTarget,
  title,
  token,
  panelPosition,
  panelSize,
  readOnly,
  onReadOnlyToggle,
  onInteractionStart,
  onInteractionEnd,
  onChange,
  onCapturePane,
  isCapturing,
  canSend = true,
  agentStatus = 'idle',
  contextUsage,
}, ref) => {
  const [promptText, setPromptText] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempDraft, setTempDraft] = useState('');

  const tempPaneId = paneTarget.replace(/[^a-zA-Z0-9]/g, '_');

  const CMD_HISTORY_KEY = `cmd_history_${tempPaneId}`;

  useEffect(() => {
    const saved = localStorage.getItem(CMD_HISTORY_KEY);
    if (saved) {
      try { setCommandHistory(JSON.parse(saved)); } catch {}
    }
  }, [paneTarget]);

  const saveCommandHistory = (history: string[]) => {
    localStorage.setItem(CMD_HISTORY_KEY, JSON.stringify(history));
  };

  const DRAFT_KEY = `cmd_draft_${tempPaneId}`;
  const saveDraft = (text: string) => {
    localStorage.setItem(DRAFT_KEY, text);
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      setPromptText(savedDraft);
    }
  }, [paneTarget]);

  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [correctedText, setCorrectedText] = useState('');
  const [isCorrectingEnglish, setIsCorrectingEnglish] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showArrows, setShowArrows] = useState(false);
  const [mouseMode, setMouseMode] = useState<'on' | 'off'>('off');
  const [isTogglingMouse, setIsTogglingMouse] = useState(false);
  const sendQueueRef = useRef<string[]>([]);
  const [queueLen, setQueueLen] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentPos, setCurrentPos] = useState(panelPosition);
  const [currentSize, setCurrentSize] = useState(panelSize);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setCurrentPos(panelPosition);
    setCurrentSize(panelSize);
  }, [panelPosition, panelSize]);

  useEffect(() => {
    if (!token) return;
    fetch(getApiUrl('/api/tmux/mouse/status'), { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json()).then(d => setMouseMode(d.mouse_mode || 'off')).catch(() => {});
  }, [token]);

  const handleToggleMouse = async () => {
    if (isTogglingMouse) return;
    setIsTogglingMouse(true);
    const newMode = mouseMode === 'on' ? 'off' : 'on';
    try {
      const res = await fetch(getApiUrl(`/api/tmux/mouse/${newMode}`), { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setMouseMode(newMode);
    } catch {}
    setIsTogglingMouse(false);
  };

  useImperativeHandle(ref, () => ({
    focusTextarea: () => { setTimeout(() => textareaRef.current?.focus(), 50); },
    setPrompt: (text: string) => { setPromptText(text); setTimeout(() => textareaRef.current?.focus(), 50); },
  }));

  const handleSendPrompt = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cmd = promptText.trim();
    if (!cmd || !paneTarget) return;
    const newHistory = [cmd, ...commandHistory.filter(c => c !== cmd)].slice(0, 50);
    setCommandHistory(newHistory);
    saveCommandHistory(newHistory);
    setHistoryIndex(-1);
    setTempDraft('');
    setPromptText('');
    saveDraft('');
    if (!canSend) {
      // 队列模式：agent 忙时排队
      sendQueueRef.current.push(cmd);
      setQueueLen(sendQueueRef.current.length);
      return;
    }
    setIsSending(true);
    setSendSuccess(false);
    try {
      await sendCommandToTmux(cmd, paneTarget);
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2000);
    } catch (e) { console.error(e); }
    finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [promptText, paneTarget, canSend]);

  // 队列自动发送：agent idle 时发送排队的命令
  useEffect(() => {
    if (!canSend || sendQueueRef.current.length === 0) return;
    const queued = sendQueueRef.current.join('\n');
    sendQueueRef.current = [];
    setQueueLen(0);
    setIsSending(true);
    sendCommandToTmux(queued, paneTarget)
      .then(() => { setSendSuccess(true); setTimeout(() => setSendSuccess(false), 2000); })
      .catch(console.error)
      .finally(() => { setIsSending(false); });
  }, [canSend, paneTarget]);

  const handleCorrectEnglish = async () => {
    if (!promptText.trim() || isCorrectingEnglish || !token) return;
    setIsCorrectingEnglish(true);
    setCorrectedText('');
    try {
      const res = await fetch(getApiUrl('/api/correctEnglish'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: promptText })
      });
      const data = await res.json();
      if (data.success && data.correctedText) setCorrectedText(data.correctedText);
    } catch (e) { console.error(e); }
    finally { setIsCorrectingEnglish(false); }
  };

  const handleAcceptCorrection = () => {
    setPromptText(correctedText);
    setCorrectedText('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSelectHistory = (cmd: string) => {
    setPromptText(cmd);
    setShowHistory(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <>
      <FloatingPanel
        title={title}
        initialPosition={panelPosition}
        initialSize={panelSize}
      minSize={{ width: 340, height: 140 }}
      onInteractionStart={onInteractionStart}
      onInteractionEnd={onInteractionEnd}
      onChange={(pos, size) => {
        setCurrentPos(pos);
        setCurrentSize(size);
        onChange(pos, size);
      }}
      headerActions={
        <>
          <button
            type="button"
            onClick={handleToggleMouse}
            disabled={isTogglingMouse}
            className={`p-1.5 rounded transition-colors ${mouseMode === 'on' ? 'text-green-400 bg-green-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title={mouseMode === 'on' ? "鼠标: 开 (可滚动)" : "鼠标: 关 (可复制)"}
          >
            {isTogglingMouse ? <Loader2 size={14} className="animate-spin" /> : <Mouse size={14} />}
          </button>
          {onCapturePane && (
            <button
              onClick={onCapturePane}
              disabled={isCapturing}
              className="p-1.5 rounded text-yellow-400 hover:bg-gray-700 disabled:opacity-40"
              title="Capture pane output"
            >
              {isCapturing ? <Loader2 size={14} className="animate-spin" /> : <Clipboard size={14} />}
            </button>
          )}
          <button
            onClick={handleCorrectEnglish}
            disabled={!promptText.trim() || isCorrectingEnglish}
            className="p-1.5 rounded text-purple-400 hover:bg-gray-700 disabled:opacity-40 transition-colors"
            title="Correct English with AI"
          >
            {isCorrectingEnglish ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className={`p-1.5 rounded transition-colors ${showHistory ? 'text-orange-400 bg-orange-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title="Command history"
          >
            <History size={14} />
          </button>
          <button
            onClick={onReadOnlyToggle}
            className={`p-1.5 rounded transition-colors ${readOnly ? 'text-red-400 bg-red-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
            title={readOnly ? 'Read-only ON (click to disable)' : 'Enable read-only'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </button>
        </>
      }
    >
      <form onSubmit={handleSendPrompt} className="relative h-full flex flex-col p-2">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="relative flex-1 flex flex-col min-h-0">
            <textarea
              ref={textareaRef}
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                saveDraft(e.target.value);
                if (historyIndex === -1) setTempDraft(e.target.value);
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSendPrompt();
                } else if (e.key === 'ArrowUp') {
                  const textarea = e.currentTarget;
                  const isOnFirstLine = !textarea.value.substring(0, textarea.selectionStart).includes('\n');
                  if (isOnFirstLine && commandHistory.length > 0) {
                    e.preventDefault();
                    if (historyIndex === -1) {
                      setTempDraft(promptText);
                      setHistoryIndex(0);
                      setPromptText(commandHistory[0]);
                    } else if (historyIndex < commandHistory.length - 1) {
                      const ni = historyIndex + 1;
                      setHistoryIndex(ni);
                      setPromptText(commandHistory[ni]);
                    }
                  }
                } else if (e.key === 'ArrowDown') {
                  const textarea = e.currentTarget;
                  const isOnLastLine = !textarea.value.substring(textarea.selectionStart).includes('\n');
                  if (isOnLastLine) {
                    e.preventDefault();
                    if (historyIndex > 0) {
                      const ni = historyIndex - 1;
                      setHistoryIndex(ni);
                      setPromptText(commandHistory[ni]);
                    } else if (historyIndex === 0) {
                      setHistoryIndex(-1);
                      setPromptText(tempDraft);
                    }
                  }
                }
              }}
              placeholder="Type command..."
              className="w-full h-full bg-black/50 text-white rounded-lg border border-gray-700 p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-sm shadow-inner placeholder:text-gray-600 placeholder:opacity-50"
              disabled={isSending}
            />
          </div>
          {showArrows && !isFocused && (
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              {[
                { label: '←', key: 'Left' },
                { label: '↓', key: 'Down' },
                { label: '↑', key: 'Up' },
                { label: '→', key: 'Right' },
                { label: 'Esc', key: 'escape' },
              ].map(b => (
                <button key={b.key} type="button" onClick={async () => {
                  const keyMap: Record<string, string> = { 'Left': 'Left', 'Down': 'Down', 'Up': 'Up', 'Right': 'Right', 'Enter': 'Enter', 'escape': 'Escape', 'ctrl+c': 'C-c' };
                  const k = keyMap[b.key] || b.key;
                  await fetch(getApiUrl('/api/tmux/send'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ win_id: paneTarget, keys: k }) });
                }}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-md transition-colors shadow flex items-center justify-center"
                >{b.label}</button>
              ))}
              <button type="button" onClick={async () => {
                await fetch(getApiUrl(`/api/tmux/panes/${encodeURIComponent(paneTarget)}/choose-session`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });
              }} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-md transition-colors shadow" title="会话选择">^bs</button>
              <button type="button" onClick={async () => {
                await fetch(getApiUrl(`/api/tmux/panes/${encodeURIComponent(paneTarget)}/split?direction=v`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });
              }} className="p-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-md transition-colors shadow" title="水平分屏(上下)"><SplitSquareHorizontal size={14} /></button>
              <button type="button" onClick={async () => {
                await fetch(getApiUrl(`/api/tmux/panes/${encodeURIComponent(paneTarget)}/split?direction=h`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });
              }} className="p-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-md transition-colors shadow" title="垂直分屏(左右)"><SplitSquareVertical size={14} /></button>
              <button type="button" onClick={async () => {
                await fetch(getApiUrl(`/api/tmux/panes/${encodeURIComponent(paneTarget)}/unsplit`), { method: 'POST', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } });
              }} className="p-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors shadow" title="关闭分屏"><XSquare size={14} /></button>
            </div>
          )}
          <div className="flex items-center justify-between mt-1.5 px-0.5">
            <div className="text-xs flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${agentStatus === 'idle' ? 'bg-green-400' : agentStatus === 'wait_auth' ? 'bg-yellow-400 animate-pulse' : agentStatus === 'compacting' ? 'bg-blue-400 animate-pulse' : agentStatus === 'wait_startup' ? 'bg-gray-400' : 'bg-cyan-400 animate-pulse'}`} />
              <span className="text-gray-500 capitalize">{agentStatus}</span>
              {contextUsage != null && <span className={contextUsage >= 80 ? 'text-red-400' : contextUsage >= 50 ? 'text-yellow-400' : 'text-gray-600'}>· {contextUsage}%</span>}
              {queueLen > 0 && <span className="text-orange-400 animate-pulse">· Q:{queueLen}</span>}
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={async () => {
                  await fetch(getApiUrl('/api/tmux/send'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ win_id: paneTarget, keys: 'Enter' }) });
                }}
                className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                title="Send Enter"
              >
                Enter
              </button>
              <button
                type="button"
                onClick={async () => {
                  await fetch(getApiUrl('/api/tmux/send'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify({ win_id: paneTarget, keys: 'C-c' }) });
                }}
                className="px-1.5 py-0.5 text-[10px] rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                title="Send Ctrl+C"
              >
                ^C
              </button>
              <button type="button" onClick={() => setShowArrows(v => !v)}
                className={`p-1.5 rounded-md transition-colors shadow-lg ${showArrows ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                title="Arrow keys"
              >
                <Keyboard size={14} />
              </button>
              <select
                className="bg-gray-800 text-gray-300 text-xs rounded-md border border-gray-700 px-1.5 py-1.5 outline-none cursor-pointer hover:bg-gray-700"
                value=""
                onChange={async (e) => {
                  const v = e.target.value;
                  if (!v) return;
                  e.target.value = '';
                  await sendCommandToTmux(v, paneTarget);
                }}
              >
                <option value="">⚡</option>
                <option value="/compact">/compact</option>
                <option value="/model">/model</option>
                <option value="/tools trust-all">Trust All</option>
                <option value="t">Trust (t)</option>
                <option value="y">Yes (y)</option>
                <option value="n">No (n)</option>
              </select>
              <button
                type="submit"
                disabled={!promptText.trim() || isSending}
                className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isSending ? <Loader2 size={14} className="animate-spin" /> : sendSuccess ? <CheckCircle size={14} className="text-green-400" /> : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                )}
              </button>
            </div>
          </div>

          {correctedText && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setCorrectedText('')}>
              <div className="bg-gray-900 border border-purple-700 rounded-lg p-4 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-purple-400" />
                    <span className="text-sm text-purple-300 font-medium">Corrected Text</span>
                  </div>
                  <button onClick={() => setCorrectedText('')} className="text-gray-400 hover:text-white"><X size={16} /></button>
                </div>
                <p className="text-sm text-white mb-4 whitespace-pre-wrap bg-black/30 p-3 rounded-md">{correctedText}</p>
                <div className="flex gap-2">
                  <button onClick={() => setCorrectedText('')} className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-md transition-colors">Cancel</button>
                  <button onClick={handleAcceptCorrection} className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors flex items-center justify-center gap-2">
                    <Check size={14} /> Use This
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </FloatingPanel>

    {/* 历史记录面板 */}
    {showHistory && commandHistory.length > 0 && (
      <div 
        className="fixed bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl backdrop-blur-sm z-[999999] flex flex-col max-h-80"
        style={{ 
          left: currentPos.x,
          bottom: window.innerHeight - currentPos.y + 8,
          width: currentSize.width
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900/50 flex-shrink-0">
          <span className="text-xs text-gray-400">History</span>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const text = commandHistory.join('\n');
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${paneTarget}_history_${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Export
            </button>
            <button onClick={() => setCommandHistory([])} className="text-xs text-red-400 hover:text-red-300">Clear</button>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white"><X size={14} /></button>
          </div>
        </div>
        <div className="divide-y divide-gray-800 overflow-y-auto">
          {commandHistory.map((cmd, idx) => (
            <div key={idx} onClick={() => { handleSelectHistory(cmd); setShowHistory(false); }}
              className="px-3 py-2 hover:bg-gray-800 cursor-pointer text-gray-300 hover:text-white group">
              <div className="flex items-center gap-2">
                <History size={12} className="text-gray-500 flex-shrink-0" />
                <span className="truncate text-sm flex-1">{cmd}</span>
                <button onClick={(e) => { e.stopPropagation(); setCommandHistory(prev => prev.filter((_, i) => i !== idx)); }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* 队列显示面板 */}
    {queueLen > 0 && (
      <div 
        className="fixed bg-gray-900/95 border border-orange-500/50 rounded-lg p-2 shadow-xl backdrop-blur-sm z-[999999]"
        style={{ 
          left: currentPos.x,
          top: currentPos.y + currentSize.height + 8,
          width: currentSize.width
        }}
      >
        <div className="text-xs text-gray-300 mb-2 max-h-24 overflow-y-auto whitespace-pre-wrap bg-black/30 p-2 rounded">
          {sendQueueRef.current.join('\n\n')}
        </div>
        <button
          onClick={() => {
            const merged = sendQueueRef.current.join('\n\n');
            setPromptText(merged);
            sendQueueRef.current = [];
            setQueueLen(0);
            setTimeout(() => textareaRef.current?.focus(), 50);
          }}
          className="w-full text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          Edit
        </button>
      </div>
    )}
  </>
  );
});
