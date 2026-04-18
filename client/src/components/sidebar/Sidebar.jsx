import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronsLeft, ChevronsRight, NotebookText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore.js';
import SessionExportMenu from '@/components/features/SessionExportMenu.jsx';
import BookmarksPanel from '@/components/features/BookmarksPanel.jsx';
import LivingBrief from '@/components/features/LivingBrief.jsx';
import ConflictAlert from '@/components/features/ConflictAlert.jsx';
import PDFUploadPanel from '@/components/features/PDFUploadPanel.jsx';
import Card from '../ui/Card.jsx';
import Button from '@/components/ui/Button.jsx';
import { cn } from '@/lib/utils.js';
import { usePatientProfile } from '@/hooks/usePatientProfile.js';

export default function Sidebar({ collapsed = false, onToggleCollapse }) {
  const { currentSession, sessionUploadedDocs, messages, patientProfile, sessionConflicts } = useAppStore();
  const { savePatientProfile, isSavingProfile, profileError } = usePatientProfile(currentSession?._id);
  const navigate = useNavigate();
  const [profileDraft, setProfileDraft] = useState({
    intent: '',
    ageRange: '',
    sex: '',
    conditions: '',
    city: '',
    country: ''
  });

  useEffect(() => {
    setProfileDraft({
      intent: String(patientProfile?.intent || currentSession?.intent || ''),
      ageRange: String(patientProfile?.ageRange || currentSession?.demographics?.ageRange || ''),
      sex: String(patientProfile?.sex || currentSession?.demographics?.sex || ''),
      conditions: Array.isArray(patientProfile?.conditions)
        ? patientProfile.conditions.join(', ')
        : Array.isArray(currentSession?.demographics?.conditions)
          ? currentSession.demographics.conditions.join(', ')
          : '',
      city: String(patientProfile?.location?.city || currentSession?.location?.city || ''),
      country: String(patientProfile?.location?.country || currentSession?.location?.country || '')
    });
  }, [currentSession, patientProfile]);

  const selectedAssistant = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === 'assistant' && m.retrievalStats);
  }, [messages]);

  const stats = selectedAssistant?.retrievalStats || null;
  const profileInputClass =
    'w-full rounded-lg border token-border bg-(--bg-surface) px-3 py-2 text-sm token-text placeholder:text-(--text-subtle)';

  if (collapsed) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-between p-2">
        <div className="flex w-full flex-col items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border token-border text-(--text-muted) hover:bg-(--bg-surface-2) hover:text-(--text-primary)"
          >
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/analytics')}
            aria-label="Open analytics dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border token-border text-(--text-muted) hover:bg-(--bg-surface-2) hover:text-(--text-primary)"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="w-full rounded-lg border token-border token-surface-2 p-2 text-center">
          <p className="text-[11px] font-semibold token-text-muted">Msgs</p>
          <p className="text-sm font-semibold token-text">{messages.length}</p>
        </div>

        <div className="w-full rounded-lg border token-border token-surface-2 p-2 text-center">
          <p className="text-[11px] font-semibold token-text-muted">Conflicts</p>
          <p className="text-sm font-semibold token-text">{Number(sessionConflicts?.totalConflicts || 0)}</p>
        </div>

        <div className="w-full rounded-lg border token-border token-surface-2 p-2 text-center">
          <p className="text-[11px] font-semibold token-text-muted">Docs</p>
          <p className="text-sm font-semibold token-text">{Array.isArray(sessionUploadedDocs) ? sessionUploadedDocs.length : 0}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col justify-between overflow-hidden p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold token-text">
          <NotebookText className="h-4 w-4 text-(--accent)" aria-hidden="true" />
          Session Panel
        </h2>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Collapse sidebar"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border token-border text-(--text-muted) hover:bg-(--bg-surface-2) hover:text-(--text-primary)"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto pr-1">
        <Card tone="soft" padding="sm" className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">Session Info</h3>

          <div className="space-y-2.5 text-sm leading-6 token-text-muted">
            {currentSession ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="token-text-subtle">Disease</span>
                  <span className="text-right font-semibold token-text">{currentSession.disease || 'N/A'}</span>
                </div>
                {currentSession.intent ? (
                  <div className="flex justify-between gap-3">
                    <span className="token-text-subtle">Intent</span>
                    <span className="text-right font-semibold token-text">{currentSession.intent}</span>
                  </div>
                ) : null}
                {currentSession.location?.city || currentSession.location?.country ? (
                  <div className="flex justify-between gap-3">
                    <span className="token-text-subtle">Location</span>
                    <span className="text-right font-semibold token-text">
                      {[currentSession.location.city, currentSession.location.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                ) : null}
              </>
            ) : (
              <span className="block text-center text-xs italic token-text-subtle">No active session</span>
            )}
          </div>
        </Card>

        <Card tone="soft" padding="sm" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">Documents</h3>
            <span className="rounded-full border border-[color-mix(in_srgb,var(--accent)_38%,transparent)] bg-(--accent-soft) px-2 py-0.5 text-[11px] font-semibold text-(--accent)">
              {Array.isArray(sessionUploadedDocs) ? sessionUploadedDocs.length : 0}
            </span>
          </div>
          <PDFUploadPanel sessionId={currentSession?._id ? String(currentSession._id) : ''} />
        </Card>

        {stats ? (
          <Card tone="soft" padding="sm" className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">Retrieval Stats</h3>
            <div className="space-y-2.5 text-sm leading-6 token-text-muted">
              <div className="flex justify-between text-(--accent)">
                <span>Total Candidates</span>
                <span className="font-semibold">{stats.totalCandidates || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>PubMed fetched</span>
                <span>{stats.pubmedFetched || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>OpenAlex fetched</span>
                <span>{stats.openalexFetched || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>ClinicalTrials fetched</span>
                <span>{stats.ctFetched || 0}</span>
              </div>
              <div className="mt-2 flex justify-between text-(--warning)">
                <span>Shown to You</span>
                <span className="font-semibold">{stats.rerankedTo || 0}</span>
              </div>
              <div className="mt-2 flex justify-between border-t token-border pt-2 text-sm token-text-subtle">
                <span>Retrieved in</span>
                <span>{stats.timeTakenMs ? (stats.timeTakenMs / 1000).toFixed(1) + 's' : '0.0s'}</span>
              </div>
            </div>
          </Card>
        ) : null}

        <Card tone="soft" padding="sm" className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] token-text-subtle">Adaptive Patient Profile</h3>

          {profileError ? (
            <p className="rounded-md border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,var(--bg-surface))] px-2 py-1.5 text-xs text-(--danger)">
              {profileError}
            </p>
          ) : null}

          <div className="grid gap-2.5">
            <input
              value={profileDraft.intent}
              onChange={(event) => setProfileDraft((previous) => ({ ...previous, intent: event.target.value }))}
              placeholder="Intent"
              className={profileInputClass}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={profileDraft.ageRange}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, ageRange: event.target.value }))}
                placeholder="Age range"
                className={profileInputClass}
              />
              <input
                value={profileDraft.sex}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, sex: event.target.value }))}
                placeholder="Sex"
                className={profileInputClass}
              />
            </div>
            <input
              value={profileDraft.conditions}
              onChange={(event) => setProfileDraft((previous) => ({ ...previous, conditions: event.target.value }))}
              placeholder="Conditions (comma separated)"
              className={profileInputClass}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={profileDraft.city}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, city: event.target.value }))}
                placeholder="City"
                className={profileInputClass}
              />
              <input
                value={profileDraft.country}
                onChange={(event) => setProfileDraft((previous) => ({ ...previous, country: event.target.value }))}
                placeholder="Country"
                className={profileInputClass}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                void savePatientProfile({
                  intent: profileDraft.intent,
                  location: {
                    city: profileDraft.city,
                    country: profileDraft.country
                  },
                  demographics: {
                    ageRange: profileDraft.ageRange,
                    sex: profileDraft.sex,
                    conditions: profileDraft.conditions
                  }
                });
              }}
              disabled={isSavingProfile}
              className="rounded-lg border token-border bg-(--bg-surface-2) px-3 py-2 text-xs font-semibold token-text-muted hover:border-(--accent) hover:text-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingProfile ? 'Saving profile...' : 'Save profile context'}
            </button>
          </div>
        </Card>

        <ConflictAlert
          conflicts={[]}
          totalConflicts={sessionConflicts?.totalConflicts}
          compact
        />

        <LivingBrief sessionId={currentSession?._id ? String(currentSession._id) : ''} compact />

        <BookmarksPanel />
      </div>

      <div className={cn('mt-4 w-full space-y-3 border-t token-border pt-4')}>
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate('/analytics')}
          aria-label="Open analytics dashboard"
          className="w-full justify-center"
        >
          View Analytics Dashboard
        </Button>
        <SessionExportMenu />
      </div>
    </div>
  );
}
