import { useEffect, useMemo, useRef, useState } from 'react';
import { extractApiError } from '@/utils/api.js';
import { motion, AnimatePresence } from 'framer-motion';

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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSubmitting) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          ref={modalRef}
          className="flex max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-gray-900 shadow-2xl shadow-black/80 ring-1 ring-white/10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-context-title"
        >
          {/* Left panel - Info */}
          <div className="hidden w-[35%] flex-col justify-between bg-blue-600 p-8 text-white sm:flex">
            <div>
              <div className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h2 className="mb-4 text-3xl font-bold leading-tight">Patient Context</h2>
              <p className="text-sm text-blue-100 leading-relaxed">
                Refine your clinical research query by providing specific patient parameters.
              </p>
            </div>
            
            <div className="space-y-3 text-sm text-blue-100 font-medium">
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Semantic Analysis
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Source Validation
              </div>
            </div>
          </div>

          {/* Right panel - Form */}
          <div className="flex w-full flex-col overflow-y-auto p-6 sm:w-[65%] sm:p-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <span className="mb-2 inline-block rounded-full bg-blue-900/50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-400">SESSION INITIALIZATION</span>
                <h2 id="session-context-title" className="text-2xl font-bold text-gray-100">Start Research</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Close form"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              {submitError ? <p className="rounded-lg bg-red-950/40 p-3 text-xs text-red-300 ring-1 ring-red-900/50">{submitError}</p> : null}

              <div>
                <label htmlFor="context-disease" className="mb-1 block text-xs font-semibold tracking-wider text-gray-400 uppercase">Medical Condition <span className="text-gray-500 font-normal">i</span></label>
                <input
                  id="context-disease"
                  ref={diseaseInputRef}
                  value={form.disease}
                  onChange={(event) => update('disease', event.target.value)}
                  placeholder="e.g. Metastatic Breast Cancer"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none transition-all focus:bg-gray-700 focus:ring-2 focus:ring-blue-500/50"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wider text-gray-400 uppercase">Primary Intent</label>
                <div className="flex flex-wrap gap-2">
                  {['Treatment Protocol', 'Side Effects', 'Drug Interactions', 'Clinical Trials'].map(intentOpt => (
                    <button
                      key={intentOpt}
                      type="button"
                      onClick={() => update('intent', intentOpt)}
                      disabled={isSubmitting}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        form.intent === intentOpt 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {intentOpt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="context-detailed-focus" className="mb-1 block text-xs font-semibold tracking-wider text-gray-400 uppercase">Detailed Research Focus</label>
                <textarea
                  id="context-detailed-focus"
                  rows="3"
                  placeholder="Describe the specific clinical nuances or question..."
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none transition-all focus:bg-gray-700 focus:ring-2 focus:ring-blue-500/50 resize-none"
                ></textarea>
              </div>

              <div>
                <label htmlFor="context-city" className="mb-1 block text-xs font-semibold tracking-wider text-gray-400 uppercase">Regional Focus (Optional)</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <input
                    id="context-city"
                    value={form.city}
                    onChange={(event) => update('city', event.target.value)}
                    placeholder="City, Region, or Institution"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 pl-10 pr-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 outline-none transition-all focus:bg-gray-700 focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Patient Demographics
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="context-age" className="mb-1 block text-xs font-semibold tracking-wider text-gray-500 uppercase">Age Range</label>
                    <select
                      id="context-age"
                      value={form.age}
                      onChange={(event) => update('age', event.target.value)}
                      disabled={isSubmitting}
                      className="w-full rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm text-gray-200 outline-none transition-all focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">Select Range</option>
                      <option value="18">0-18</option>
                      <option value="30">19-30</option>
                      <option value="45">31-50</option>
                      <option value="60">51-70</option>
                      <option value="80">71+</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="context-sex" className="mb-1 block text-xs font-semibold tracking-wider text-gray-500 uppercase">Biological Sex</label>
                    <select
                      id="context-sex"
                      value={form.sex}
                      onChange={(event) => update('sex', event.target.value)}
                      disabled={isSubmitting}
                      className="w-full rounded-lg bg-gray-900 border border-gray-800 px-3 py-2 text-sm text-gray-200 outline-none transition-all focus:bg-gray-800 focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">All</option>
                      {sexOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 flex items-center gap-2 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-300"
                >
                  Start Research
                  {isSubmitting ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" />
                    </svg>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="text-sm font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-wide">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Query will be processed via encrypted Curalink nodes [T1]
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
