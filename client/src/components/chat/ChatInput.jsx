import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUp, Mic, MicOff } from 'lucide-react';

function useAutoResize(minH = 56, maxH = 180) {
  const ref = useRef(null);
  const adjust = useCallback((reset = false) => {
    const el = ref.current;
    if (!el) return;
    if (reset) { el.style.height = `${minH}px`; return; }
    el.style.height = `${minH}px`;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }, [minH, maxH]);
  useEffect(() => { if (ref.current) ref.current.style.height = `${minH}px`; }, [minH]);
  return { ref, adjust };
}

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);
  const { ref: textareaRef, adjust } = useAutoResize(56, 180);
  const recognitionRef = useRef(null);

  // Listen for programmatic input (follow-up chips)
  useEffect(() => {
    const handler = (e) => { setValue(e.detail || ''); adjust(); };
    window.addEventListener('set-chat-input', handler);
    return () => window.removeEventListener('set-chat-input', handler);
  }, [adjust]);

  const submit = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    adjust(true);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const toggleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setValue((prev) => `${prev} ${transcript}`.trim());
      adjust();
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const canSend = value.trim() && !disabled;
  const hasVoice = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <div className="w-full">
      <div
        className="rounded-2xl overflow-hidden transition-all"
        style={{
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-panel)',
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1), var(--shadow-panel)';
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border-strong)';
          e.currentTarget.style.boxShadow = 'var(--shadow-panel)';
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); adjust(); }}
          onKeyDown={handleKey}
          placeholder="Ask about treatments, trials, researchers…"
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm outline-none"
          style={{
            color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
            background: disabled ? 'rgba(148,163,184,0.04)' : 'transparent',
            minHeight: 56,
            overflow: 'hidden',
          }}
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          {/* Left: voice */}
          <div className="flex items-center gap-2">
            {hasVoice && (
              <button
                type="button"
                onClick={toggleVoice}
                disabled={disabled}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
                style={{
                  background: listening ? 'rgba(239,68,68,0.1)' : 'var(--color-surface-3)',
                  border: listening ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--color-border)',
                  color: listening ? '#f87171' : 'var(--text-muted)',
                }}
              >
                {listening && (
                  <span
                    className="pointer-events-none absolute -inset-1 rounded-[10px] animate-ping"
                    style={{ border: '1px solid rgba(248,113,113,0.45)' }}
                  />
                )}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? 'Stop' : 'Voice'}
                </span>
              </button>
            )}

            <span
              className="text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              ↵ to send · ⇧↵ new line
            </span>
          </div>

          {/* Right: send */}
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: canSend
                ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
                : 'var(--color-surface-3)',
              color: canSend ? '#fff' : 'var(--text-muted)',
              boxShadow: canSend ? '0 2px 8px rgba(37,99,235,0.35)' : 'none',
            }}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
