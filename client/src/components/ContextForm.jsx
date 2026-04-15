import { useEffect, useMemo, useRef, useState } from 'react';
import { extractApiError } from '@/utils/api.js';

const diseaseSuggestions = [
  "Parkinson's Disease",
  'Lung Cancer',
  'Type 2 Diabetes',
  "Alzheimer's Disease",
  'Heart Disease',
  'Breast Cancer',
  'Multiple Sclerosis',
  'Rheumatoid Arthritis'
];

const sexOptions = ['Male', 'Female', 'Other'];

export default function ContextForm({ onSubmit, onClose }) {
  const modalRef = useRef(null);
  const diseaseInputRef = useRef(null);
  const [form, setForm] = useState({
    disease: '',
    intent: '',
    city: '',
    country: '',
    age: '',
    sex: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const canSubmit = useMemo(() => form.disease.trim().length > 0, [form.disease]);

  useEffect(() => {
    diseaseInputRef.current?.focus();
    const modalNode = modalRef.current;
    if (!modalNode) {
      return undefined;
    }

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(modalNode.querySelectorAll(focusableSelector));
      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    modalNode.addEventListener('keydown', onKeyDown);
    return () => modalNode.removeEventListener('keydown', onKeyDown);
  }, [isSubmitting, onClose]);

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await onSubmit({
        disease: form.disease.trim(),
        intent: form.intent.trim(),
        location: {
          city: form.city.trim(),
          country: form.country.trim()
        },
        demographics: {
          age: form.age ? Number(form.age) : null,
          sex: form.sex || null
        }
      });
    } catch (error) {
      setSubmitError(extractApiError(error, 'Failed to create session. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-context-title"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="session-context-title" className="text-xl font-bold text-slate-100">Start a Research Session</h2>
            <p className="mt-1 text-sm text-slate-400">Provide context so retrieval and trial matching are personalized.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          {submitError ? <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">{submitError}</p> : null}

          <div>
            <label htmlFor="context-disease" className="mb-1 block text-sm text-slate-300">Disease / Condition *</label>
            <input
              id="context-disease"
              ref={diseaseInputRef}
              value={form.disease}
              onChange={(event) => update('disease', event.target.value)}
              placeholder="e.g. Parkinson's Disease"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              required
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {diseaseSuggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => update('disease', suggestion)}
                  disabled={isSubmitting}
                  className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="context-intent" className="mb-1 block text-sm text-slate-300">What do you want to know?</label>
            <input
              id="context-intent"
              value={form.intent}
              onChange={(event) => update('intent', event.target.value)}
              placeholder="e.g. Deep brain stimulation outcomes"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="context-city" className="mb-1 block text-sm text-slate-300">City</label>
              <input
                id="context-city"
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder="Toronto"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="context-country" className="mb-1 block text-sm text-slate-300">Country</label>
              <input
                id="context-country"
                value={form.country}
                onChange={(event) => update('country', event.target.value)}
                placeholder="Canada"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="context-age" className="mb-1 block text-sm text-slate-300">Age (optional)</label>
              <input
                id="context-age"
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={(event) => update('age', event.target.value)}
                placeholder="45"
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="context-sex" className="mb-1 block text-sm text-slate-300">Sex (optional)</label>
              <select
                id="context-sex"
                value={form.sex}
                onChange={(event) => update('sex', event.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              >
                <option value="">Prefer not to say</option>
                {sexOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Starting...' : 'Begin Research'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
