import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, FileText, Plus, Stethoscope, Trash2, UploadCloud } from 'lucide-react';

import Button from '@/components/ui/Button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog.jsx';
import { useAppStore } from '@/store/useAppStore.js';
import { patchToast, pushToast } from '@/store/useToastStore.js';
import { deletePDFDoc, getSessionPDFDocs, uploadPDF } from '@/utils/api.js';

const STAGE_STEPS = [
  { progress: 30, stage: 'reading', delayMs: 500 },
  { progress: 60, stage: 'parsing', delayMs: 1500 },
  { progress: 85, stage: 'embedding', delayMs: 2000 }
];

function formatDocType(value) {
  const normalized = String(value || 'unknown').replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function truncate(value, max = 28) {
  const text = String(value || '').trim();
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function normalizeAbnormalFindings(findings = []) {
  return (Array.isArray(findings) ? findings : [])
    .map((item) => ({
      name: String(item?.name || '').trim(),
      flag: String(item?.flag || '').trim().toUpperCase()
    }))
    .filter((item) => item.name && item.flag);
}

export default function PDFUploadPanel({ sessionId }) {
  const sessionUploadedDocs = useAppStore((state) => state.sessionUploadedDocs);
  const setSessionUploadedDocs = useAppStore((state) => state.setSessionUploadedDocs);
  const addUploadedDoc = useAppStore((state) => state.addUploadedDoc);
  const removeUploadedDoc = useAppStore((state) => state.removeUploadedDoc);
  const setShowAbnormalAlert = useAppStore((state) => state.setShowAbnormalAlert);
  const setLatestAbnormalFindings = useAppStore((state) => state.setLatestAbnormalFindings);
  const messages = useAppStore((state) => state.messages);

  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('reading');
  const [expandedSummaryByDocId, setExpandedSummaryByDocId] = useState({});
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState(null);
  const timeoutRefs = useRef([]);

  const docs = useMemo(
    () => (Array.isArray(sessionUploadedDocs) ? sessionUploadedDocs : []),
    [sessionUploadedDocs]
  );

  const clearProgressTimers = () => {
    timeoutRefs.current.forEach((timerId) => window.clearTimeout(timerId));
    timeoutRefs.current = [];
  };

  const scheduleFakeProgress = () => {
    clearProgressTimers();
    setUploadProgress(0);
    setUploadStage('reading');

    STAGE_STEPS.forEach((step) => {
      const timerId = window.setTimeout(() => {
        setUploadStage(step.stage);
        setUploadProgress(step.progress);
      }, step.delayMs);
      timeoutRefs.current.push(timerId);
    });
  };

  useEffect(() => {
    let cancelled = false;

    if (!sessionId) {
      setSessionUploadedDocs([]);
      return () => {};
    }

    const loadDocs = async () => {
      try {
        const { data } = await getSessionPDFDocs(sessionId);
        if (!cancelled) {
          setSessionUploadedDocs(Array.isArray(data?.docs) ? data.docs : []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError?.response?.data?.error || 'Unable to load uploaded documents.');
        }
      }
    };

    void loadDocs();
    return () => {
      cancelled = true;
    };
  }, [sessionId, setSessionUploadedDocs]);

  useEffect(() => {
    return () => {
      clearProgressTimers();
    };
  }, []);

  const completeUploadProgress = () => {
    clearProgressTimers();
    setUploadProgress(100);
    setUploadStage('done');

    const timerId = window.setTimeout(() => {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('reading');
    }, 800);
    timeoutRefs.current.push(timerId);
  };

  const handleUpload = async (file) => {
    if (!sessionId || !file || isUploading) {
      return;
    }

    setError('');
    setIsUploading(true);
    scheduleFakeProgress();

    const toastId = pushToast({
      title: 'Analyzing PDF',
      message: `Processing ${file.name}...`,
      loading: true
    });

    try {
      const { data } = await uploadPDF(sessionId, file);
      const uploadedDoc = {
        doc_id: data?.doc_id,
        filename: data?.filename || file.name,
        document_type: data?.document_type || 'unknown',
        structured_summary: data?.structured_summary || '',
        abnormal_findings: Array.isArray(data?.abnormal_findings) ? data.abnormal_findings : [],
        has_abnormal_findings: Boolean(data?.has_abnormal_findings),
        total_chunks: Number(data?.total_chunks || 0),
        uploaded_at: new Date().toISOString()
      };

      if (Array.isArray(data?.uploadedDocs)) {
        setSessionUploadedDocs(data.uploadedDocs);
      } else {
        addUploadedDoc(uploadedDoc);
      }

      const abnormalFindings = normalizeAbnormalFindings(data?.abnormal_findings);
      if (Boolean(data?.has_abnormal_findings) && abnormalFindings.length && messages.length === 0) {
        setLatestAbnormalFindings(abnormalFindings);
        setShowAbnormalAlert(true);
      }

      completeUploadProgress();

      patchToast(toastId, {
        loading: false,
        variant: 'success',
        title: 'Report analyzed',
        message: `${uploadedDoc.filename} analyzed - ${uploadedDoc.total_chunks} chunks indexed, ${abnormalFindings.length} abnormal finding${abnormalFindings.length === 1 ? '' : 's'}.`
      });
    } catch (uploadError) {
      clearProgressTimers();
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage('reading');

      const message = uploadError?.response?.data?.error || uploadError?.message || 'PDF upload failed.';
      setError(message);
      patchToast(toastId, {
        loading: false,
        variant: 'error',
        title: 'Upload failed',
        message
      });
    }
  };

  const onDropAccepted = (acceptedFiles) => {
    if (!acceptedFiles?.length) {
      return;
    }

    void handleUpload(acceptedFiles[0]);
  };

  const onDropRejected = (rejections) => {
    const firstError = rejections?.[0]?.errors?.[0];
    if (!firstError) {
      setError('Unable to process this file. Please upload a valid PDF under 20MB.');
      return;
    }

    if (firstError.code === 'file-too-large') {
      setError('File too large. Maximum size is 20MB.');
      return;
    }

    setError('Only PDF files are allowed.');
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFilePicker
  } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    noClick: true,
    onDropAccepted,
    onDropRejected,
    disabled: isUploading
  });

  const handleDeleteDoc = async () => {
    const doc = pendingDeleteDoc;
    if (!doc || !sessionId) {
      setPendingDeleteDoc(null);
      return;
    }

    try {
      const { data } = await deletePDFDoc(sessionId, doc.doc_id);
      if (Array.isArray(data?.uploadedDocs)) {
        setSessionUploadedDocs(data.uploadedDocs);
      } else {
        removeUploadedDoc(doc.doc_id);
      }
    } catch (deleteError) {
      setError(deleteError?.response?.data?.error || 'Unable to remove this PDF right now.');
    } finally {
      setPendingDeleteDoc(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold token-text">Your Documents</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={openFilePicker}
          disabled={isUploading || !sessionId}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div
        {...getRootProps()}
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          isDragActive
            ? 'border-[color-mix(in_srgb,var(--accent)_58%,transparent)] bg-(--accent-soft)'
            : 'token-border token-surface-2'
        }`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto mb-2 h-5 w-5 text-(--text-subtle)" />
        <p className="text-sm font-medium token-text">Drop PDF here or click Add to upload</p>
        <p className="mt-1 text-xs token-text-subtle">Max 20MB - Medical reports and notes supported</p>
      </div>

      {isUploading ? (
        <div className="rounded-xl border token-border token-surface p-4">
          <p className="mb-2 text-sm font-semibold token-text">Analyzing your report...</p>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-(--bg-surface-2)">
            <div
              className="h-full bg-(--accent) transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-xs token-text-subtle">
            {uploadStage === 'reading' && 'Reading PDF...'}
            {uploadStage === 'parsing' && 'Extracting medical data...'}
            {uploadStage === 'embedding' && 'Building search index...'}
            {uploadStage === 'done' && 'Done'}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--bg-surface))] px-3 py-2 text-xs text-(--danger)">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        {docs.length === 0 ? (
          <p className="rounded-lg border token-border token-surface px-3 py-3 text-xs token-text-subtle">
            No documents uploaded yet.
          </p>
        ) : (
          docs.map((doc) => {
            const summary = String(doc?.structured_summary || '').trim();
            const docType = String(doc?.document_type || 'unknown');
            const abnormalFindings = normalizeAbnormalFindings(doc?.abnormal_findings);
            const isExpanded = Boolean(expandedSummaryByDocId[doc.doc_id]);
            const summaryPreview = isExpanded ? summary : truncate(summary, 150);

            return (
              <div key={doc.doc_id} className="rounded-xl border token-border token-surface p-3 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold token-text">
                      {docType === 'lab_report' ? (
                        <Stethoscope className="h-4 w-4 text-(--accent)" />
                      ) : (
                        <FileText className="h-4 w-4 text-(--accent)" />
                      )}
                      {truncate(doc.filename, 32)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-(--accent-soft) px-2 py-0.5 text-[11px] font-medium text-(--accent)">
                        {formatDocType(docType)}
                      </span>
                      {doc?.has_abnormal_findings ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_15%,var(--bg-surface))] px-2 py-0.5 text-[11px] font-medium text-(--warning)">
                          <AlertTriangle className="h-3 w-3" />
                          {abnormalFindings.length} abnormal
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPendingDeleteDoc(doc)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--text-subtle) hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] hover:text-(--danger)"
                    aria-label={`Remove ${doc.filename}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {summary ? (
                  <p className="text-xs leading-relaxed token-text-muted">
                    {summaryPreview}
                    {summary.length > 150 ? (
                      <button
                        type="button"
                        className="ml-1 text-(--accent)"
                        onClick={() =>
                          setExpandedSummaryByDocId((previous) => ({
                            ...previous,
                            [doc.doc_id]: !isExpanded
                          }))
                        }
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    ) : null}
                  </p>
                ) : null}

                {abnormalFindings.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {abnormalFindings.slice(0, 4).map((finding) => (
                      <span
                        key={`${doc.doc_id}-${finding.name}-${finding.flag}`}
                        className="rounded-full border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_15%,var(--bg-surface))] px-2 py-0.5 text-[11px] font-medium text-(--warning)"
                      >
                        {finding.name} {finding.flag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={Boolean(pendingDeleteDoc)} onOpenChange={(open) => !open && setPendingDeleteDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove document?</DialogTitle>
            <DialogDescription>
              This will remove the document from this session's PDF context.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteDoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDeleteDoc}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
