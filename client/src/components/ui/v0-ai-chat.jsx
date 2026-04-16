"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { Textarea } from "./textarea";
import { cn } from "../../lib/utils";
import {
    ImageIcon,
    FileUp,
    Figma,
    MonitorIcon,
    CircleUserRound,
    ArrowUpIcon,
    Paperclip,
    PlusIcon,
} from "lucide-react";

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

            // Temporarily shrink to get the right scrollHeight
            textarea.style.height = `${minHeight}px`;

            // Calculate new height
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        // Set initial height
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    // Adjust height on window resize
    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export function VercelV0Chat({ onSend, loading = false, placeholder = "Ask Curalink a medical question..." }) {
    const [value, setValue] = useState("");
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    const handleSubmit = () => {
        if (value.trim() && !loading) {
            onSend?.(value);
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
        <div className="flex flex-col items-center w-full max-w-3xl mx-auto space-y-8">
            <h1 className="text-3xl md:text-5xl font-semibold text-white tracking-tight">
                Traceable clinical intelligence
            </h1>

            <div className="w-full shadow-2xl">
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
                            placeholder={placeholder}
                            disabled={loading}
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
                                className="group p-2 hover:bg-[#2A2A2A] rounded-lg transition-colors flex items-center gap-1"
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
                                className="px-3 py-1.5 rounded-full text-xs font-medium text-[#888888] transition-colors bg-[#222222] border border-[#333333] hover:border-[#444444] hover:bg-[#2A2A2A] flex items-center justify-between gap-1.5"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                Sources
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!value.trim() || loading}
                                className={cn(
                                    "p-2 rounded-full transition-colors flex items-center justify-center",
                                    value.trim() && !loading
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

                <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                    <ActionButton
                        icon={<MonitorIcon className="w-4 h-4" />}
                        label="Latest oncology trials"
                        onClick={() => { setValue("Summarize the latest oncology trials from ClinicalTrials.gov"); adjustHeight(); }}
                    />
                    <ActionButton
                        icon={<CircleUserRound className="w-4 h-4" />}
                        label="Breast cancer mutations"
                        onClick={() => { setValue("What are the secondary mutations developed during breast cancer treatment?"); adjustHeight(); }}
                    />
                     <ActionButton
                        icon={<FileUp className="w-4 h-4" />}
                        label="COVID long-term effects"
                        onClick={() => { setValue("List longitudinal studies on COVID-19 long-term cognitive effects"); adjustHeight(); }}
                    />
                </div>
            </div>
        </div>
    );
}

function ActionButton({ icon, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2 bg-transparent hover:bg-[#222222] rounded-full border border-[#333333] text-[#AAAAAA] hover:text-white transition-colors"
        >
            {icon}
            <span className="text-sm">{label}</span>
        </button>
    );
}
