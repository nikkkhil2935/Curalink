import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, ArrowUpIcon, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea.jsx';

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
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
      minHeight: 60,
      maxHeight: 200,
  });

  useEffect(() => {
    const handler = (e) => {
      setValue(e.detail);
      adjustHeight();
    };
    window.addEventListener('set-chat-input', handler);
    return () => window.removeEventListener('set-chat-input', handler);
  }, [adjustHeight]);

  const handleSubmit = () => {
    if (value.trim() && !disabled) {
        onSend(value);
        setValue("");
        adjustHeight(true);
    }
  };

  const handleKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto shadow-2xl">
        <div className="relative bg-[#1A1A1A] rounded-2xl border border-[#333333] transition-colors focus-within:border-[#555555]">
            <div className="overflow-y-auto">
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        adjustHeight();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Curalink a follow-up question..."
                    disabled={disabled}
                    className={cn(
                        "w-full px-5 py-4",
                        "resize-none",
                        "bg-transparent",
                        "border-none",
                        "text-white text-[16px]",
                        "focus:outline-none",
                        "focus-visible:ring-0 focus-visible:ring-offset-0",
                        "placeholder:text-[#888888] placeholder:text-[16px]",
                        "min-h-[60px]"
                    )}
                    style={{
                        overflow: "hidden",
                    }}
                />
            </div>

            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={disabled}
                        className="group p-2 hover:bg-[#2A2A2A] rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                        <Paperclip className="w-4 h-4 text-[#888888] group-hover:text-white" />
                        <span className="text-xs text-[#888888] hidden group-hover:inline transition-opacity">
                            Attach Context
                        </span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={disabled}
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-[#888888] transition-colors bg-[#222222] border border-[#333333] hover:border-[#444444] hover:bg-[#2A2A2A] flex items-center justify-between gap-1.5 disabled:opacity-50"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Project
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={disabled || !value.trim()}
                        className={cn(
                            "p-2 rounded-full transition-colors flex items-center justify-center",
                            value.trim() && !disabled
                                ? "bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                : "bg-[#2A2A2A] text-[#555555] cursor-not-allowed border border-[#333333]"
                        )}
                    >
                        <ArrowUpIcon
                            className="w-5 h-5"
                            strokeWidth={2.5}
                        />
                        <span className="sr-only">Send</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}