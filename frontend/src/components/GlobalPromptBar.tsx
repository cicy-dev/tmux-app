import React, { useState, useRef } from 'react';
import { Loader2, CheckCircle, Mic } from 'lucide-react';
import { sendCommandToTmux } from '../services/mockApi';

interface Props {
  paneIds: string[];
  paneTitles: Record<string, string>;
}

export const GlobalPromptBar: React.FC<Props> = ({ paneIds, paneTitles }) => {
  const [selectedPaneId, setSelectedPaneId] = useState<string>(paneIds[0] || '');
  const [command, setCommand] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Keep selectedPaneId in sync when paneIds changes
  React.useEffect(() => {
    if (paneIds.length > 0 && !paneIds.includes(selectedPaneId)) {
      setSelectedPaneId(paneIds[0]);
    }
  }, [paneIds]);

  const handleSend = async () => {
    const cmd = command.trim();
    if (!cmd || !selectedPaneId) return;
    setIsSending(true);
    setSendSuccess(false);
    try {
      await sendCommandToTmux(cmd, selectedPaneId);
      setCommand('');
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      if (transcript) setCommand(prev => (prev ? prev + ' ' + transcript : transcript));
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="flex items-center gap-2 px-3 h-14 bg-gray-900 border-t border-gray-700 flex-shrink-0">
      {/* Pane selector */}
      <select
        value={selectedPaneId}
        onChange={e => setSelectedPaneId(e.target.value)}
        className="bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded px-2 py-1.5 h-8 focus:outline-none focus:border-blue-500 max-w-[140px]"
      >
        {paneIds.map(id => (
          <option key={id} value={id}>
            {paneTitles[id] || id}
          </option>
        ))}
      </select>

      {/* Command input */}
      <input
        ref={inputRef}
        type="text"
        value={command}
        onChange={e => setCommand(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type command and press Enter..."
        disabled={isSending}
        className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5 h-8 focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
      />

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!command.trim() || isSending || !selectedPaneId}
        className="px-3 h-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm flex items-center gap-1 transition-colors"
      >
        {isSending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : sendSuccess ? (
          <CheckCircle size={14} className="text-green-300" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        )}
        Send
      </button>

      {/* Voice button */}
      <button
        onClick={toggleVoice}
        className={`h-8 w-8 rounded flex items-center justify-center transition-colors ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
        title={isListening ? 'Stop recording' : 'Voice input'}
      >
        <Mic size={14} />
      </button>
    </div>
  );
};
