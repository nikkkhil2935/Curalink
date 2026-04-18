import { AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils.js';

function normalizeConflicts(conflicts = []) {
  return (Array.isArray(conflicts) ? conflicts : []).filter((entry) => entry && typeof entry === 'object');
}

function highestSeverity(conflicts = []) {
  const priority = { low: 1, medium: 2, high: 3 };
  let highest = 'low';

  normalizeConflicts(conflicts).forEach((entry) => {
    const severity = String(entry?.severity || 'low').toLowerCase();
    if ((priority[severity] || 1) > (priority[highest] || 1)) {
      highest = severity;
    }
  });

  return highest;
}

function severityTone(severity) {
  if (severity === 'high') {
    return {
      container: 'border-[color-mix(in_srgb,var(--danger)_44%,transparent)] bg-[color-mix(in_srgb,var(--danger)_11%,var(--bg-surface))]',
      badge: 'bg-[color-mix(in_srgb,var(--danger)_20%,var(--bg-surface))] text-(--danger)'
    };
  }

  if (severity === 'medium') {
    return {
      container: 'border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,var(--bg-surface))]',
      badge: 'bg-[color-mix(in_srgb,var(--warning)_20%,var(--bg-surface))] text-(--warning)'
    };
  }

  return {
    container: 'border-[color-mix(in_srgb,var(--accent)_38%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--bg-surface))]',
    badge: 'bg-[color-mix(in_srgb,var(--accent)_20%,var(--bg-surface))] text-(--accent)'
  };
}

export default function ConflictAlert({
  conflicts = [],
  totalConflicts = null,
  compact = false,
  onOpenExplorer
}) {
  const normalized = normalizeConflicts(conflicts);
  const count = Number(totalConflicts ?? normalized.length);

  if (count <= 0) {
    return null;
  }

  const severity = highestSeverity(normalized);
  const tone = severityTone(severity);
  const phrases = [...new Set(normalized.map((entry) => String(entry?.outcomePhrase || '').trim()).filter(Boolean))].slice(0, 3);

  return (
    <section
      className={cn(
        'rounded-2xl border px-4 py-3.5',
        compact ? 'space-y-2' : 'space-y-2.5',
        tone.container
      )}
      aria-live="polite"
      aria-label="Evidence conflict alert"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--bg-surface)_74%,transparent)]">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] token-text-subtle">Evidence Conflict Detected</p>
            <p className="mt-1.5 text-sm leading-5 token-text">
              {count} contradictory evidence pair{count === 1 ? '' : 's'} found across current sources.
            </p>
          </div>
        </div>

        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]', tone.badge)}>
          {severity}
        </span>
      </div>

      {phrases.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {phrases.map((phrase) => (
            <span
              key={phrase}
              className="rounded-full border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_90%,transparent)] px-2.5 py-1 text-xs token-text-muted"
            >
              {phrase}
            </span>
          ))}
        </div>
      ) : null}

      {typeof onOpenExplorer === 'function' ? (
        <button
          type="button"
          onClick={onOpenExplorer}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--border-subtle)_80%,transparent)] bg-[color-mix(in_srgb,var(--bg-surface)_92%,transparent)] px-3 py-1.5 text-xs font-semibold token-text hover:border-(--accent) hover:text-(--accent)"
        >
          Explore conflicts
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </section>
  );
}
