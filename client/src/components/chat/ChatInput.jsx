import { useEffect, useRef, useState } from 'react';
import { Mic, SendHorizontal } from 'lucide-react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const voiceButtonLabel = !isSpeechSupported
    ? 'Voice input is not supported in this browser'
    : isListening
      ? 'Stop voice input'
      : 'Start voice input';

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSpeechSupported(Boolean(SpeechRecognition));

    const handleInputInjection = (event) => {
      const injectedText = event?.detail || '';
      if (typeof injectedText === 'string') {
        setText(injectedText);
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('set-chat-input', handleInputInjection);
    return () => window.removeEventListener('set-chat-input', handleInputInjection);
  }, []);

  const handleSend = () => {
    if (!text.trim() || disabled) {
      return;
    }

    onSend(text);
    setText('');
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition || disabled) {
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || '';
      setText(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="border-t border-slate-800 p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a research question..."
          rows={2}
          disabled={disabled}
          className="min-h-16 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={startVoice}
            disabled={disabled || !isSpeechSupported}
            title={voiceButtonLabel}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${
              isListening
                ? 'border-red-500 bg-red-500 text-white'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
            aria-label={voiceButtonLabel}
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send message"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
