import React, { useMemo } from 'react';
import { Paperclip } from 'lucide-react';

function buildLabel(docs = []) {
  const items = Array.isArray(docs) ? docs : [];
  const names = items.map((doc) => String(doc?.filename || '').trim()).filter(Boolean);

  if (!names.length) {
    return '';
  }

  if (names.length <= 2) {
    return names.join(', ');
  }

  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

export default function PDFContextIndicator({ docs = [], onOpenPanel }) {
  const docCount = Array.isArray(docs) ? docs.length : 0;
  const label = useMemo(() => buildLabel(docs), [docs]);

  if (!docCount) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onOpenPanel}
      className="mb-2 inline-flex items-center gap-2 self-start rounded-full border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-(--accent-soft) px-3 py-1 text-xs font-medium text-(--accent) hover:border-[color-mix(in_srgb,var(--accent)_58%,transparent)]"
      aria-label="Open uploaded document panel"
    >
      <Paperclip className="h-3 w-3" />
      <span>Using {docCount} document{docCount === 1 ? '' : 's'} - {label}</span>
    </button>
  );
}
