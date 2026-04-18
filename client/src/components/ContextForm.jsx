import { useEffect, useMemo, useRef, useState } from 'react';
import { extractApiError } from '@/utils/api.js';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, X, Loader2, Lock, MapPin, Users } from 'lucide-react';

const INTENTS = ['Treatment Protocol', 'Side Effects', 'Drug Interactions', 'Clinical Trials'];
const SEX_OPTIONS = ['Male', 'Female', 'Other'];
const AGE_OPTIONS = [
  { label: 'Select…', value: '' },
  { label: '0–18', value: '0-18' },
  { label: '19–30', value: '19-30' },
  { label: '31–50', value: '31-50' },
  { label: '51–70', value: '51-70' },
  { label: '71+', value: '71+' },
];

function Label({ children, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[10px] font-bold uppercase tracking-widest mb-1"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </label>
  );
}

function Field({ children }) {
  return <div className="space-y-1">{children}</div>;
}

export default function ContextForm({ initialData = {}, onSubmit, onClose }) {
  const modalRef = useRef(null);
  const diseaseInputRef = useRef(null);
  const [form, setForm] = useState({
    disease: initialData.disease || '',
    intent: '',
    focus: '',
    city: '',
    country: '',
    ageRange: '',
    sex: '',
    conditions: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const canSubmit = useMemo(() => form.disease.trim().length > 0, [form.disease]);

  useEffect(() => {
    diseaseInputRef.current?.focus();
    const node = modalRef.current;
    if (!node) return;

    const focusable = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = Array.from(node.querySelectorAll(focusable));
      if (!els.length) return;
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [isSubmitting, onClose]);

  const update = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        disease: form.disease.trim(),
        intent: form.intent.trim(),
        location: { city: form.city.trim(), country: form.country.trim() },
        demographics: {
          ageRange: form.ageRange.trim(),
          sex: form.sex || null,
          conditions: form.conditions
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        },
      });
    } catch (error) {
      setSubmitError(extractApiError(error, 'Failed to create session. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.65)' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}
      >
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="flex max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl"
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ctx-title"
        >
          {/* Left accent panel */}
          <div
            className="hidden sm:flex w-56 shrink-0 flex-col justify-between p-7"
            style={{ background: 'linear-gradient(160deg,#1d4ed8,#4f46e5)', color: '#fff' }}
          >
            <div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <FlaskConical className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold mb-2 leading-tight">Research Context</h2>
              <p className="text-sm opacity-80 leading-relaxed">
                Provide patient parameters to personalize your clinical research session.
              </p>
            </div>
            <div className="space-y-2 text-sm opacity-80">
              {['Semantic RAG pipeline', 'Real-time PubMed + OpenAlex', 'ClinicalTrials.gov'].map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-white/60" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Form panel */}
          <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <span
                  className="inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
                >
                  New Session
                </span>
                <h2 id="ctx-title" className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  Start Research
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--color-surface-3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="space-y-4 flex-1" onSubmit={submit}>
              {submitError && (
                <p
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                >
                  {submitError}
                </p>
              )}

              {/* Disease */}
              <Field>
                <Label htmlFor="ctx-disease">Medical Condition *</Label>
                <input
                  id="ctx-disease"
                  ref={diseaseInputRef}
                  value={form.disease}
                  onChange={(e) => update('disease', e.target.value)}
                  placeholder="e.g. Metastatic Breast Cancer"
                  disabled={isSubmitting}
                  required
                  className="cl-input w-full"
                  style={inputStyle}
                />
              </Field>

              {/* Intent chips */}
              <Field>
                <Label>Primary Intent</Label>
                <div className="flex flex-wrap gap-2">
                  {INTENTS.map((opt) => {
                    const active = form.intent === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => update('intent', active ? '' : opt)}
                        disabled={isSubmitting}
                        className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
                        style={
                          active
                            ? { background: '#2563eb', color: '#fff', border: '1px solid #2563eb' }
                            : { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--text-secondary)' }
                        }
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Focus textarea */}
              <Field>
                <Label htmlFor="ctx-focus">Research Focus (optional)</Label>
                <textarea
                  id="ctx-focus"
                  rows={3}
                  value={form.focus}
                  onChange={(e) => update('focus', e.target.value)}
                  placeholder="Describe specific clinical nuances or questions…"
                  disabled={isSubmitting}
                  className="cl-input w-full resize-none"
                  style={inputStyle}
                />
              </Field>

              {/* Location */}
              <Field>
                <Label htmlFor="ctx-city">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> Location (optional)</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="ctx-city"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    placeholder="City"
                    disabled={isSubmitting}
                    className="cl-input"
                    style={inputStyle}
                  />
                  <input
                    value={form.country}
                    onChange={(e) => update('country', e.target.value)}
                    placeholder="Country"
                    disabled={isSubmitting}
                    className="cl-input"
                    style={inputStyle}
                  />
                </div>
              </Field>

              {/* Demographics */}
              <Field>
                <Label>
                  <span className="inline-flex items-center gap-1"><Users className="h-2.5 w-2.5" /> Demographics (optional)</span>
                </Label>
                <div
                  className="rounded-xl p-3"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Age Range</label>
                      <select
                        value={form.ageRange}
                        onChange={(e) => update('ageRange', e.target.value)}
                        disabled={isSubmitting}
                        className="cl-input w-full text-sm"
                        style={inputStyle}
                      >
                        {AGE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Biological Sex</label>
                      <select
                        value={form.sex}
                        onChange={(e) => update('sex', e.target.value)}
                        disabled={isSubmitting}
                        className="cl-input w-full text-sm"
                        style={inputStyle}
                      >
                        <option value="">All</option>
                        {SEX_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                      Comorbidities
                    </label>
                    <input
                      value={form.conditions}
                      onChange={(e) => update('conditions', e.target.value)}
                      disabled={isSubmitting}
                      placeholder="e.g. diabetes, hypertension"
                      className="cl-input w-full text-sm"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </Field>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="cl-btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isSubmitting ? 'Starting…' : 'Start Research'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] pt-1" style={{ color: 'var(--text-muted)' }}>
                <Lock className="h-2.5 w-2.5" />
                Processed locally — no data leaves your device
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
