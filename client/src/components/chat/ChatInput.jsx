<<<<<<< HEAD
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
=======
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpIcon, Sparkles } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea.jsx';
import { api } from '@/utils/api.js';

function useAutoResizeTextarea({ minHeight, maxHeight }) {
    const textareaRef = useRef(null);

    const adjustHeight = useCallback(
        (reset) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
            );
            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export default function ChatInput({ onSend, disabled }) {
    const { sessionId } = useParams();
    const [value, setValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200
    });

    useEffect(() => {
        const handler = (e) => {
            setValue(e.detail);
            adjustHeight();
        };
        window.addEventListener('set-chat-input', handler);
        return () => window.removeEventListener('set-chat-input', handler);
    }, [adjustHeight]);

    useEffect(() => {
        const query = value.trim();
        if (query.length < 2 || disabled) {
            setSuggestions([]);
            setShowSuggestions(false);
            setLoadingSuggestions(false);
            return () => {};
        }

        let cancelled = false;
        setLoadingSuggestions(true);

        const timeoutId = setTimeout(async () => {
            try {
                const { data } = await api.get('/suggestions', {
                    params: {
                        q: query,
                        limit: 5,
                        sessionId
                    }
                });

                if (cancelled) {
                    return;
                }

                const nextSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
                setSuggestions(nextSuggestions);
                setShowSuggestions(nextSuggestions.length > 0);
            } catch {
                if (!cancelled) {
                    setSuggestions([]);
                    setShowSuggestions(false);
                }
            } finally {
                if (!cancelled) {
                    setLoadingSuggestions(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [disabled, sessionId, value]);

    const handleSubmit = () => {
        if (value.trim() && !disabled) {
            onSend(value);
            setValue('');
            adjustHeight(true);
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="mx-auto w-full max-w-240">
            <div className="relative rounded-2xl border token-border token-surface focus-within:border-(--accent)">
                <div className="overflow-y-auto">
                    <Textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            adjustHeight();
                        }}
                        onFocus={() => setShowSuggestions(suggestions.length > 0)}
                        onBlur={() => {
                            setTimeout(() => setShowSuggestions(false), 120);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Curalink a follow-up question..."
                        disabled={disabled}
                        className={cn(
                            'w-full px-5 py-4',
                            'resize-none',
                            'bg-transparent',
                            'border-none',
                            'text-(--text-primary) text-[16px]',
                            'focus:outline-none',
                            'focus-visible:ring-0 focus-visible:ring-offset-0',
                            'placeholder:text-(--text-subtle) placeholder:text-[16px]',
                            'min-h-15'
                        )}
                        style={{
                            overflow: 'hidden'
                        }}
                    />
                </div>

                {showSuggestions ? (
                    <div className="absolute inset-x-3 top-[calc(100%-6px)] z-10 overflow-hidden rounded-xl border token-border token-surface shadow-(--panel-shadow)">
                        {loadingSuggestions ? (
                            <div className="space-y-2 p-3">
                                <div className="skeleton-block h-3 w-2/3" />
                                <div className="skeleton-block h-3 w-4/5" />
                                <div className="skeleton-block h-3 w-1/2" />
                            </div>
                        ) : (
                            suggestions.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onMouseDown={(event) => {
                                        event.preventDefault();
                                        setValue(item);
                                        adjustHeight();
                                        setShowSuggestions(false);
                                    }}
                                    className="block w-full border-b border-[color-mix(in_srgb,var(--border-subtle)_65%,transparent)] px-3 py-2 text-left text-sm token-text hover:bg-(--bg-surface-2)"
                                >
                                    <span className="inline-flex items-center gap-1">
                                        <Sparkles className="h-3.5 w-3.5 text-(--accent)" />
                                        {item}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                ) : null}

                <div className="flex items-center justify-between p-3">
                    <p className="text-xs token-text-subtle">
                        {disabled ? 'Generating response...' : 'Press Enter to send, Shift+Enter for newline'}
                    </p>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={disabled || !value.trim()}
                        aria-label="Send question"
                        className={cn(
                            'flex items-center justify-center rounded-full p-2',
                            value.trim() && !disabled
                                ? 'bg-(--accent) text-white shadow-[0_0_15px_color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-(--accent-hover)'
                                : 'cursor-not-allowed border token-border bg-(--bg-surface-2) text-(--text-subtle)'
                        )}
                    >
                        <ArrowUpIcon className="h-5 w-5" strokeWidth={2.5} />
                        <span className="sr-only">Send</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
