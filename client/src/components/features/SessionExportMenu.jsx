import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore.js';
import { api, extractApiError } from '@/utils/api.js';
import { patchToast, pushToast } from '@/store/useToastStore.js';

const EXPORT_FORMATS = [
  { id: 'pdf', label: 'PDF', description: 'Formatted session brief' },
  { id: 'json', label: 'JSON', description: 'Full session payload' },
  { id: 'csv', label: 'CSV', description: 'Flattened evidence rows' }
];

function getFileNameFromDisposition(dispositionHeader, fallbackName) {
  const header = String(dispositionHeader || '');
  const fileNameMatch = header.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);

  if (fileNameMatch?.[1]) {
    return decodeURIComponent(fileNameMatch[1]);
  }

  if (fileNameMatch?.[2]) {
    return fileNameMatch[2];
  }

  return fallbackName;
}

function getMimeType(format) {
  if (format === 'pdf') {
    return 'application/pdf';
  }
  if (format === 'csv') {
    return 'text/csv;charset=utf-8';
  }
  return 'application/json;charset=utf-8';
}

export default function SessionExportMenu() {
  const { currentSession } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeFormat, setActiveFormat] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuItemRefs = useRef([]);
  const menuId = useId();

  const sessionId = useMemo(() => String(currentSession?._id || ''), [currentSession]);
  const hasSession = Boolean(sessionId);

  useEffect(() => {
    if (!isOpen) {
      return () => {};
    }

    setActiveIndex(0);
    requestAnimationFrame(() => {
      menuItemRefs.current[0]?.focus();
    });

    const onWindowClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', onWindowClick);
    return () => window.removeEventListener('mousedown', onWindowClick);
  }, [isOpen]);

  const isExporting = Boolean(activeFormat);

  const openMenu = () => {
    if (!hasSession || isExporting) {
      return;
    }

    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  const onTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu();
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      closeMenu();
    }
  };

  const onMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (activeIndex + 1) % EXPORT_FORMATS.length;
      setActiveIndex(nextIndex);
      menuItemRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = (activeIndex - 1 + EXPORT_FORMATS.length) % EXPORT_FORMATS.length;
      setActiveIndex(nextIndex);
      menuItemRefs.current[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      menuItemRefs.current[0]?.focus();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = EXPORT_FORMATS.length - 1;
      setActiveIndex(lastIndex);
      menuItemRefs.current[lastIndex]?.focus();
    }
  };

  const handleExport = async (format) => {
    if (!hasSession || isExporting) {
      return;
    }

    setError('');
    setActiveFormat(format);
    setProgress(5);
    setIsOpen(false);

    const toastId = pushToast({
      title: `Exporting ${format.toUpperCase()}`,
      message: 'Preparing download payload...',
      loading: true
    });

    try {
      const response = await api.get(`/sessions/${sessionId}/export`, {
        params: { format },
        responseType: 'blob',
        onDownloadProgress: (event) => {
          if (event?.total && event.total > 0) {
            const next = Math.min(98, Math.round((event.loaded / event.total) * 100));
            setProgress(next);
          } else {
            setProgress((previous) => Math.min(95, previous + 10));
          }
        }
      });

      const diseaseSlug = String(currentSession?.disease || 'research')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'research';
      const fallbackName = `curalink-${diseaseSlug}.${format}`;
      const fileName = getFileNameFromDisposition(response.headers?.['content-disposition'], fallbackName);
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: getMimeType(format) });

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      setProgress(100);
      patchToast(toastId, {
        loading: false,
        variant: 'success',
        title: 'Session Exported',
        message: `${format.toUpperCase()} export downloaded successfully.`
      });
      setTimeout(() => {
        setActiveFormat('');
        setProgress(0);
      }, 300);
    } catch (requestError) {
      const message = extractApiError(requestError, 'Export failed. Please retry.');
      setError(message);
      patchToast(toastId, {
        loading: false,
        variant: 'error',
        title: 'Export Failed',
        message
      });
      setActiveFormat('');
      setProgress(0);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full space-y-2">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open session export menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((previous) => !previous)}
        onKeyDown={onTriggerKeyDown}
        disabled={!hasSession || isExporting}
        className="inline-flex w-full items-center justify-between rounded-lg border token-border token-surface px-3 py-2 text-sm font-medium token-text duration-150 ease-out hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-2">
          <Download className="h-4 w-4" />
          {isExporting ? `Exporting ${activeFormat.toUpperCase()}...` : 'Export Session'}
        </span>
        <ChevronDown className={`h-4 w-4 duration-150 ease-out ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Session export formats"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-20 w-full rounded-lg border token-border bg-[color-mix(in_srgb,var(--bg-surface)_96%,transparent)] p-1 shadow-(--panel-shadow)"
        >
          {EXPORT_FORMATS.map((format, index) => (
            <button
              key={format.id}
              ref={(node) => {
                menuItemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              aria-label={`Export session as ${format.label}`}
              aria-selected={index === activeIndex}
              onClick={() => handleExport(format.id)}
              onFocus={() => setActiveIndex(index)}
              disabled={isExporting}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
                index === activeIndex
                    ? 'bg-(--accent-soft) text-(--text-primary)'
                    : 'token-text hover:bg-(--bg-surface-2)'
              }`}
            >
              <span>{format.label}</span>
              <span className="text-xs token-text-subtle">{format.description}</span>
            </button>
          ))}
        </div>
      )}

      {isExporting && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-(--bg-surface-2)" aria-label="Export progress indicator">
            <div
              className="h-1.5 rounded-full bg-(--accent) transition-all duration-150 ease-out"
              style={{ width: `${Math.max(progress, 8)}%` }}
            />
          </div>
          <p className="text-xs token-text-muted">Preparing download ({Math.max(progress, 8)}%)</p>
        </div>
      )}

      {error ? <p className="text-xs text-(--danger)">{error}</p> : null}
    </div>
  );
}
