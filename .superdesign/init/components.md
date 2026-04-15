# Shared UI Components

## ContextForm
Source: `client/src/components/ContextForm.jsx`
Description: Modal form for session context input.

```jsx
import { useMemo, useState } from 'react';

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
  const [form, setForm] = useState({
    disease: '',
    intent: '',
    city: '',
    country: '',
    age: '',
    sex: ''
  });

  const canSubmit = useMemo(() => form.disease.trim().length > 0, [form.disease]);

  const update = (key, value) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    onSubmit({
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Start a Research Session</h2>
            <p className="mt-1 text-sm text-slate-400">Provide context so retrieval and trial matching are personalized.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Disease / Condition *</label>
            <input
              value={form.disease}
              onChange={(event) => update('disease', event.target.value)}
              placeholder="e.g. Parkinson's Disease"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              required
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {diseaseSuggestions.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => update('disease', suggestion)}
                  className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">What do you want to know?</label>
            <input
              value={form.intent}
              onChange={(event) => update('intent', event.target.value)}
              placeholder="e.g. Deep brain stimulation outcomes"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">City</label>
              <input
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder="Toronto"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Country</label>
              <input
                value={form.country}
                onChange={(event) => update('country', event.target.value)}
                placeholder="Canada"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Age (optional)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={(event) => update('age', event.target.value)}
                placeholder="45"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-300">Sex (optional)</label>
              <select
                value={form.sex}
                onChange={(event) => update('sex', event.target.value)}
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
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Begin Research
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## ChatInput
Source: `client/src/components/chat/ChatInput.jsx`
Description: Message composer with send and speech controls.

```jsx
import { useEffect, useRef, useState } from 'react';
import { Mic, SendHorizontal } from 'lucide-react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const voiceButtonLabel = !isSpeechSupported
    ? 'Voice input is not supported in this browser'
    : isListening
      ? 'Stop voice input'
      : 'Start voice input';

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSpeechSupported(Boolean(SpeechRecognition));

    const handleInputInjection = (event) => {
      const injectedText = event?.detail || '';
      if (typeof injectedText === 'string') {
        setText(injectedText);
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('set-chat-input', handleInputInjection);
    return () => window.removeEventListener('set-chat-input', handleInputInjection);
  }, []);

  const handleSend = () => {
    if (!text.trim() || disabled) {
      return;
    }

    onSend(text);
    setText('');
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition || disabled) {
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || '';
      setText(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="border-t border-slate-800 p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask a research question..."
          rows={2}
          disabled={disabled}
          className="min-h-16 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={startVoice}
            disabled={disabled || !isSpeechSupported}
            title={voiceButtonLabel}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${
              isListening
                ? 'border-red-500 bg-red-500 text-white'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
            aria-label={voiceButtonLabel}
          >
            <Mic size={16} />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send message"
          >
            <SendHorizontal size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

## MessageBubble
Source: `client/src/components/chat/MessageBubble.jsx`
Description: User/assistant message rendering with structured answer support.

```jsx
import StructuredAnswer from './StructuredAnswer.jsx';

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? (
        <div className="max-w-[85%] rounded-xl rounded-tr-md bg-blue-600 px-4 py-3 text-sm text-white">
          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
          <p className="mt-2 text-right text-[10px] text-blue-100">{formatDate(message.createdAt)}</p>
        </div>
      ) : (
        <div className="max-w-full w-full space-y-3">
          {message.contextBadge ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-800 bg-blue-950 px-2 py-0.5 text-xs text-blue-300">
                {message.contextBadge}
              </span>
            </div>
          ) : null}

          {message.structuredAnswer ? (
            <StructuredAnswer answer={message.structuredAnswer} retrievalStats={message.retrievalStats} />
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-100">
              <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
            </div>
          )}

          {message.structuredAnswer?.follow_up_suggestions?.length ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Suggested follow-ups</p>
              <div className="flex flex-wrap gap-2">
                {message.structuredAnswer.follow_up_suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion}-${index}`}
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent('set-chat-input', { detail: suggestion }))}
                    className="inline-flex min-h-11 items-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-300 transition hover:border-blue-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-[10px] text-slate-500">{formatDate(message.createdAt)}</p>
        </div>
      )}
    </div>
  );
}
```

## StructuredAnswer
Source: `client/src/components/chat/StructuredAnswer.jsx`
Description: Structured evidence-first assistant response card.

```jsx
import {
  Activity,
  AlertTriangle,
  FileText,
  Microscope,
  Pill,
  Shield,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';

const EVIDENCE_STYLES = {
  STRONG: { color: 'text-emerald-400', bg: 'bg-emerald-950 border-emerald-800', Icon: ShieldCheck },
  MODERATE: { color: 'text-amber-400', bg: 'bg-amber-950 border-amber-800', Icon: Shield },
  LIMITED: { color: 'text-rose-400', bg: 'bg-rose-950 border-rose-800', Icon: ShieldAlert }
};

const INSIGHT_ICONS = {
  TREATMENT: Pill,
  DIAGNOSIS: Microscope,
  RISK: AlertTriangle,
  PREVENTION: Shield,
  GENERAL: FileText
};

function CitationTag({ id }) {
  const isPublication = id?.startsWith('P');

  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-xs ${
        isPublication ? 'border border-blue-700 bg-blue-950 text-blue-300' : 'border border-emerald-700 bg-emerald-950 text-emerald-300'
      }`}
    >
      [{id}]
    </span>
  );
}

export default function StructuredAnswer({ answer, retrievalStats }) {
  const evidenceStyle = EVIDENCE_STYLES[answer?.evidence_strength] || EVIDENCE_STYLES.MODERATE;
  const EvidenceIcon = evidenceStyle.Icon || Activity;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className={`flex items-center justify-between border-b border-slate-800 px-4 py-2 ${evidenceStyle.bg}`}>
        <span className={`inline-flex items-center gap-2 text-xs font-medium ${evidenceStyle.color}`}>
          <EvidenceIcon className="h-4 w-4" aria-hidden="true" />
          {answer?.evidence_strength || 'MODERATE'} evidence
        </span>
        {retrievalStats ? (
          <span className="text-[11px] text-slate-400">
            {retrievalStats.totalCandidates ?? 0} candidates -> {retrievalStats.rerankedTo ?? 0} shown
          </span>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        {answer?.condition_overview ? (
          <section>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Overview</p>
            <p className="text-sm leading-relaxed text-slate-100">{answer.condition_overview}</p>
          </section>
        ) : null}

        {answer?.research_insights?.length ? (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Research findings</p>
            <div className="space-y-2">
              {answer.research_insights.map((insight, index) => (
                <div key={`${insight.insight}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-slate-300">
                      {(() => {
                        const Icon = INSIGHT_ICONS[insight.type] || FileText;
                        return <Icon className="h-4 w-4" aria-hidden="true" />;
                      })()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed text-slate-100">{insight.insight}</p>
                      {insight.source_ids?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {insight.source_ids.map((id) => (
                            <CitationTag key={id} id={id} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {answer?.clinical_trials?.length ? (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Clinical trials</p>
            <div className="space-y-2">
              {answer.clinical_trials.map((trial, index) => (
                <div
                  key={`${trial.summary}-${index}`}
                  className={`rounded-xl border p-3 ${trial.location_relevant ? 'border-emerald-800 bg-emerald-950/30' : 'border-slate-800 bg-slate-950/40'}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
                      {trial.status || 'UNKNOWN'}
                    </span>
                    {trial.location_relevant ? (
                      <span className="rounded-full border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-300">
                        Near you
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-100">{trial.summary}</p>
                  {trial.contact ? <p className="mt-1 text-xs text-slate-400">Contact: {trial.contact}</p> : null}
                  {trial.source_ids?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {trial.source_ids.map((id) => (
                        <CitationTag key={id} id={id} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {answer?.key_researchers?.length ? (
          <section>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Key researchers</p>
            <div className="flex flex-wrap gap-2">
              {answer.key_researchers.map((researcher) => (
                <span key={researcher} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                  {researcher}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {answer?.recommendations ? (
          <section className="rounded-xl border border-blue-900/60 bg-blue-950/20 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-400">Guidance</p>
            <p className="text-sm leading-relaxed text-slate-200">{answer.recommendations}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
```

## SourceCard
Source: `client/src/components/evidence/SourceCard.jsx`
Description: Compact citation source card.

```jsx
function getStrengthBadge(score) {
  if (score >= 0.7) {
    return { label: 'Strong', className: 'border-green-500/30 bg-green-500/10 text-green-300' };
  }
  if (score >= 0.4) {
    return { label: 'Moderate', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' };
  }
  return { label: 'Limited', className: 'border-red-500/30 bg-red-500/10 text-red-300' };
}

export default function SourceCard({ source, prefix }) {
  const badge = getStrengthBadge(Number(source.finalScore || 0));

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          [{prefix}] {source.source} {source.year || 'N/A'}
        </p>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-100">{source.title || 'Untitled source'}</h3>

      {source.authors?.length ? (
        <p className="mt-1 text-xs text-slate-400">{source.authors.slice(0, 4).join(', ')}</p>
      ) : null}

      {source.abstract ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-300">{source.abstract.slice(0, 360)}</p>
      ) : null}

      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs font-semibold text-blue-300 hover:text-blue-200"
        >
          Open source link
        </a>
      ) : null}
    </article>
  );
}
```
