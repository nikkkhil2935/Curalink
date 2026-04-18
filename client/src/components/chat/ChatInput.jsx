import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowUpIcon, Sparkles } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea.jsx';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle
} from '@/components/ui/sheet.jsx';
import PDFContextIndicator from '@/components/chat/PDFContextIndicator.jsx';
import PDFUploadPanel from '@/components/features/PDFUploadPanel.jsx';
import { useAppStore } from '@/store/useAppStore.js';
import { api } from '@/utils/api.js';

const MAX_INPUT_LENGTH = 1000;

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
    const sessionUploadedDocs = useAppStore((state) => state.sessionUploadedDocs);
    const [value, setValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [isPdfPanelOpen, setIsPdfPanelOpen] = useState(false);

    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200
    });

    const sendShortcutLabel = useMemo(() => {
        if (typeof navigator === 'undefined') {
            return 'Ctrl+Enter';
        }

        return /mac/i.test(navigator.platform) ? 'Cmd+Enter' : 'Ctrl+Enter';
    }, []);

    useEffect(() => {
        const handler = (e) => {
            setValue(String(e.detail || '').slice(0, MAX_INPUT_LENGTH));
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
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="mx-auto w-full max-w-240">
            <PDFContextIndicator
                docs={sessionUploadedDocs}
                onOpenPanel={() => setIsPdfPanelOpen(true)}
            />

            <div className="relative rounded-2xl border token-border token-surface focus-within:border-(--accent)">
                <div className="overflow-y-auto">
                    <Textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value.slice(0, MAX_INPUT_LENGTH));
                            adjustHeight();
                        }}
                        onFocus={() => setShowSuggestions(suggestions.length > 0)}
                        onBlur={() => {
                            setTimeout(() => setShowSuggestions(false), 120);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Curalink a follow-up question..."
                        disabled={disabled}
                        maxLength={MAX_INPUT_LENGTH}
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
                                        setValue(String(item || '').slice(0, MAX_INPUT_LENGTH));
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

                <div className="flex items-center justify-between gap-3 p-3">
                    <p className="min-w-0 flex-1 text-xs token-text-subtle">
                        {disabled ? 'Generating response...' : `Press ${sendShortcutLabel} to send, Enter for newline`}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                        <span
                            className={cn(
                                'text-xs tabular-nums',
                                value.length > MAX_INPUT_LENGTH * 0.9 ? 'text-(--warning)' : 'token-text-subtle'
                            )}
                            aria-live="polite"
                        >
                            {value.length}/{MAX_INPUT_LENGTH}
                        </span>
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

            <Sheet open={isPdfPanelOpen} onOpenChange={setIsPdfPanelOpen}>
                <SheetContent side="right" className="w-full max-w-md token-surface p-4">
                    <SheetHeader className="mb-3">
                        <SheetTitle className="token-text">Uploaded Documents</SheetTitle>
                        <SheetDescription className="token-text-subtle">
                            Manage PDFs used for this session's contextual answers.
                        </SheetDescription>
                    </SheetHeader>
                    <PDFUploadPanel sessionId={sessionId} />
                </SheetContent>
            </Sheet>
        </div>
    );
}