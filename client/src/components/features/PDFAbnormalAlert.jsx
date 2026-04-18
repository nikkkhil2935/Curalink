import React, { useMemo } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Button from '@/components/ui/Button.jsx';

function normalizeFindings(findings = []) {
  return (Array.isArray(findings) ? findings : [])
    .map((finding) => ({
      name: String(finding?.name || '').trim(),
      value: String(finding?.value || '').trim(),
      unit: String(finding?.unit || '').trim(),
      flag: String(finding?.flag || '').trim().toUpperCase()
    }))
    .filter((finding) => finding.name && finding.flag);
}

export default function PDFAbnormalAlert({ findings = [], onDismiss }) {
  const normalized = useMemo(() => normalizeFindings(findings), [findings]);

  if (!normalized.length) {
    return null;
  }

  const findingLabelList = normalized
    .slice(0, 4)
    .map((finding) => `${finding.name}${finding.value ? ` ${finding.value}${finding.unit ? ` ${finding.unit}` : ''}` : ''} [${finding.flag}]`)
    .join(', ');

  const askMeaningPrompt =
    `My lab report shows abnormal values: ${findingLabelList}. What do these mean and what should I do?`;
  const askTreatmentPrompt =
    `Based on my lab report showing ${findingLabelList}, what are the evidence-based treatment options?`;

  const pushPrompt = (prompt) => {
    window.dispatchEvent(new CustomEvent('set-chat-input', { detail: prompt }));
  };

  return (
    <div className="relative rounded-xl border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_14%,var(--bg-surface))] p-4">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-(--warning) hover:bg-[color-mix(in_srgb,var(--warning)_16%,transparent)]"
        aria-label="Dismiss abnormal findings alert"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-2 text-(--warning)">
        <AlertTriangle className="h-4 w-4" />
        <h3 className="text-sm font-semibold">Abnormal findings detected in your report</h3>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {normalized.slice(0, 6).map((finding) => (
          <span
            key={`${finding.name}-${finding.flag}-${finding.value}`}
            className="rounded-full border border-[color-mix(in_srgb,var(--warning)_48%,transparent)] bg-[color-mix(in_srgb,var(--warning)_22%,var(--bg-surface))] px-2 py-0.5 text-xs font-medium text-(--warning)"
          >
            {finding.name} {finding.flag}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-[color-mix(in_srgb,var(--warning)_55%,transparent)] text-(--warning) hover:bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]"
          onClick={() => pushPrompt(askMeaningPrompt)}
        >
          Ask what these mean
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-[color-mix(in_srgb,var(--warning)_55%,transparent)] text-(--warning) hover:bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]"
          onClick={() => pushPrompt(askTreatmentPrompt)}
        >
          Ask about treatment options
        </Button>
      </div>
    </div>
  );
}
