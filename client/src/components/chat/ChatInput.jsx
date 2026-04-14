import { useEffect, useRef, useState } from 'react';
import { Mic, SendHorizontal } from 'lucide-react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
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

    if (!SpeechRecognition) {
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
          className="min-h-17.5 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
        />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={startVoice}
            disabled={disabled}
            className={`rounded-xl border px-3 py-2 transition ${
              isListening
                ? 'border-red-500 bg-red-500 text-white'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
            aria-label="Start voice input"
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="rounded-xl bg-blue-600 px-3 py-2 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send message"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
