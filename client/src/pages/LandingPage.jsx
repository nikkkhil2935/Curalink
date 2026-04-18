import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Clock3, Search, Stethoscope } from 'lucide-react';
import AppTopNav from '@/components/layout/AppTopNav.jsx';
import ErrorBanner from '@/components/ui/ErrorBanner.jsx';
import { api, extractApiError } from '@/utils/api.js';
import { patchToast, pushToast } from '@/store/useToastStore.js';

const INTENT_OPTIONS = [
  'Treatment planning',
  'Safety and side effects',
  'Clinical trial matching',
  'Diagnostics and biomarkers',
  'Guideline comparison'
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    question: '',
    disease: '',
    intent: '',
    city: '',
    country: '',
    age: '',
    sex: ''
  });
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [creating, setCreating] = useState(false);
  const [startError, setStartError] = useState('');
  const [recentSessions, setRecentSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionLoadError, setSessionLoadError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  const canSubmit = useMemo(
    () => Boolean(form.question.trim() || form.disease.trim()) && !creating,
    [creating, form.disease, form.question]
  );

  const update = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const reloadSessions = () => setRefreshToken((previous) => previous + 1);

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      setLoadingSessions(true);
      setSessionLoadError('');
      try {
        const { data } = await api.get('/sessions');
        if (!cancelled) {
          setRecentSessions(Array.isArray(data?.sessions) ? data.sessions : []);
        }
      } catch (error) {
        if (!cancelled) {
          setSessionLoadError(extractApiError(error, 'Unable to load recent sessions.'));
          setRecentSessions([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    };

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    const query = form.question.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSuggestionsLoading(false);
      return () => {};
    }

    let cancelled = false;
    setSuggestionsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await api.get('/suggestions', { params: { q: query, limit: 5 } });
        if (cancelled) {
          return;
        }
        const nextSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setSuggestions(nextSuggestions);
        setShowSuggestions(nextSuggestions.length > 0);
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.question]);

  const startSession = async (event) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setStartError('');
    setCreating(true);

    const loadingToastId = pushToast({
      title: 'Starting Session',
      message: 'Creating a clinical research session and preparing first response...',
      loading: true
    });

    try {
      const disease = form.disease.trim() || form.question.trim();
      const { data: sessionData } = await api.post('/sessions', {
        disease,
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

      const sessionId = sessionData?.session?._id;
      if (!sessionId) {
        throw new Error('Session creation did not return an id.');
      }

      let focusMessage = '';
      if (form.question.trim()) {
        const { data: queryData } = await api.post(`/sessions/${sessionId}/query`, {
          message: form.question.trim()
        });
        focusMessage = String(queryData?.message?._id || '');
      }

      patchToast(loadingToastId, {
        loading: false,
        variant: 'success',
        title: 'Session Ready',
        message: 'Your research workflow is ready with evidence-backed results.'
      });

      const targetUrl = focusMessage
        ? `/research/${sessionId}?focusMessage=${focusMessage}`
        : `/research/${sessionId}`;
      navigate(targetUrl);
    } catch (error) {
      const message = extractApiError(error, 'Failed to start research session.');
      setStartError(message);
      patchToast(loadingToastId, {
        loading: false,
        variant: 'error',
        title: 'Session Failed',
        message
      });
      setCreating(false);
    }
  };

  return (
    <div className="app-shell token-bg token-text min-h-screen">
      <AppTopNav />

      <main className="mx-auto flex w-full max-w-300 flex-col gap-8 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        {startError ? <ErrorBanner message={startError} onClose={() => setStartError('')} /> : null}

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="surface-panel rounded-2xl p-6 lg:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_32%,transparent)] bg-(--accent-soft) px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-(--accent)">
              <Stethoscope className="h-3.5 w-3.5" />
              Medical Research RAG
            </div>

            <h1 className="max-w-xl text-3xl font-extrabold leading-tight text-(--text-primary) md:text-4xl">
              Ask a clinical question and move from evidence retrieval to traceable answers.
            </h1>
            <p className="mt-3 max-w-2xl text-sm token-text-muted md:text-base">
              Curalink runs a linear workflow: question intake, retrieval from trusted sources, grounded synthesis, and analytics.
            </p>

            <form className="mt-6 space-y-4" onSubmit={startSession}>
              <div className="relative">
                <label htmlFor="clinical-question" className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] token-text-subtle">
                  Clinical Question
                </label>
                <textarea
                  id="clinical-question"
                  rows={3}
                  value={form.question}
                  onChange={(event) => update('question', event.target.value)}
                  onFocus={() => setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 120);
                  }}
                  placeholder="e.g., What are first-line options for metastatic hormone receptor-positive breast cancer?"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:border-(--accent)"
                  required={!form.disease.trim()}
                />

                {showSuggestions ? (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border token-border token-surface shadow-(--panel-shadow)">
                    {suggestionsLoading ? (
                      <div className="space-y-2 p-3">
                        <div className="skeleton-block h-3 w-3/4" />
                        <div className="skeleton-block h-3 w-4/5" />
                        <div className="skeleton-block h-3 w-2/3" />
                      </div>
                    ) : (
                      suggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            update('question', item);
                            setShowSuggestions(false);
                          }}
                          className="block w-full border-b border-[color-mix(in_srgb,var(--border-subtle)_65%,transparent)] px-3 py-2 text-left text-sm token-text hover:bg-(--bg-surface-2)"
                        >
                          {item}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="condition" className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] token-text-subtle">
                    Condition
                  </label>
                  <input
                    id="condition"
                    value={form.disease}
                    onChange={(event) => update('disease', event.target.value)}
                    placeholder="e.g., metastatic breast cancer"
                    className="w-full rounded-xl px-3 py-2 text-sm focus:border-(--accent)"
                  />
                </div>

                <div>
                  <label htmlFor="intent" className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] token-text-subtle">
                    Intent
                  </label>
                  <select
                    id="intent"
                    value={form.intent}
                    onChange={(event) => update('intent', event.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm focus:border-(--accent)"
                  >
                    <option value="">Select focus</option>
                    {INTENT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={form.city}
                  onChange={(event) => update('city', event.target.value)}
                  placeholder="City (optional)"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:border-(--accent)"
                />
                <input
                  value={form.country}
                  onChange={(event) => update('country', event.target.value)}
                  placeholder="Country (optional)"
                  className="w-full rounded-xl px-3 py-2 text-sm focus:border-(--accent)"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed"
                >
                  Ask Your First Clinical Question
                  <ArrowRight className="h-4 w-4" />
                </button>
                <span className="text-xs token-text-subtle">Journey: Landing → Query → Results/Citations → Analytics</span>
              </div>
            </form>
          </div>

          <div className="surface-soft rounded-2xl p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] token-text-subtle">How Curalink Works</h2>
            <ol className="space-y-3 text-sm token-text-muted">
              <li className="rounded-lg token-surface p-3">1. Enter your clinical question with context.</li>
              <li className="rounded-lg token-surface p-3">2. Retrieve PubMed, OpenAlex, and ClinicalTrials evidence.</li>
              <li className="rounded-lg token-surface p-3">3. Review grounded results with citations and confidence.</li>
              <li className="rounded-lg token-surface p-3">4. Track performance and outcomes in analytics.</li>
            </ol>
          </div>
        </section>

        <section className="surface-soft rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] token-text-subtle">
              <Clock3 className="h-4 w-4" />
              Recent Sessions
            </h2>
            <button
              type="button"
              onClick={reloadSessions}
              className="rounded-md border token-border px-2 py-1 text-xs token-text-muted hover:bg-(--bg-surface-2) hover:text-(--text-primary)"
            >
              Refresh
            </button>
          </div>

          {sessionLoadError ? (
            <ErrorBanner message={sessionLoadError} onClose={() => setSessionLoadError('')} />
          ) : null}

          {loadingSessions ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="skeleton-block h-24" />
              <div className="skeleton-block h-24" />
              <div className="skeleton-block h-24" />
            </div>
          ) : null}

          {!loadingSessions && !recentSessions.length ? (
            <div className="rounded-xl border token-border token-surface p-6 text-center">
              <p className="text-sm token-text">No sessions yet.</p>
              <p className="mt-1 text-xs token-text-subtle">Ask your first clinical question to generate evidence-backed results.</p>
            </div>
          ) : null}

          {!loadingSessions && recentSessions.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {recentSessions.slice(0, 6).map((session) => (
                <button
                  key={session._id}
                  type="button"
                  onClick={() => navigate(`/research/${session._id}`)}
                  className="rounded-xl border token-border token-surface p-4 text-left transition-colors hover:border-(--accent) hover:bg-(--bg-surface-2)"
                >
                  <p className="line-clamp-2 text-sm font-semibold token-text">{session.title || session.disease || 'Untitled session'}</p>
                  <p className="mt-1 text-xs token-text-subtle">{session.intent || 'General clinical inquiry'}</p>
                  <p className="mt-3 inline-flex items-center gap-1 text-xs token-text-muted">
                    <Activity className="h-3 w-3" />
                    Open Session
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
