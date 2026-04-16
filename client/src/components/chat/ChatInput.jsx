import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const handler = (e) => setText(e.detail);
    window.addEventListener('set-chat-input', handler);
    return () => window.removeEventListener('set-chat-input', handler);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(text);
      setText('');
    }
  };

  const handleMic = () => {
    if (!window.webkitSpeechRecognition) return alert('Speech recognition not supported in this browser.');
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (e) => {
      setText((t) => t + (t ? ' ' : '') + e.results[0][0].transcript);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div className="flex items-end space-x-2 bg-gray-900 border border-gray-800 rounded-xl p-2">
      <textarea
        className="flex-1 bg-transparent text-white resize-none text-sm p-2 outline-none"
        rows={2}
        placeholder="Type your clinical question..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button 
        onClick={handleMic} 
        disabled={disabled}
        className={`p-2 rounded-full transition-colors ${listening ? 'bg-red-900/50 text-red-500 animate-pulse' : 'text-gray-400 hover:bg-gray-800'}`}
      >
        Mic
      </button>
      <button 
        onClick={() => { onSend(text); setText(''); }}
        disabled={disabled || !text.trim()}
        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </div>
  );
}