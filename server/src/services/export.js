import Session from '../models/Session.js';
import Message from '../models/Message.js';
import SourceDoc from '../models/SourceDoc.js';

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
}

function toStringId(value) {
  return value == null ? '' : String(value);
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAsciiLine(value) {
  return sanitizeText(value)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, maxLength = 320) {
  const normalized = sanitizeText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizeSession(sessionDoc) {
  if (!sessionDoc) {
    return null;
  }

  return {
    id: toStringId(sessionDoc._id),
    disease: sessionDoc.disease || '',
    intent: sessionDoc.intent || '',
    location: sessionDoc.location || {},
    demographics: sessionDoc.demographics || {},
    title: sessionDoc.title || '',
    brief: normalizeBrief(sessionDoc.brief),
    queryHistory: Array.isArray(sessionDoc.queryHistory) ? sessionDoc.queryHistory : [],
    messageCount: Number(sessionDoc.messageCount || 0),
    createdAt: sessionDoc.createdAt || null,
    updatedAt: sessionDoc.updatedAt || null
  };
}

function normalizeBrief(brief) {
  if (!brief || typeof brief !== 'object') {
    return null;
  }

  return {
    generatedAt: brief.generatedAt || null,
    background: String(brief.background || ''),
    currentEvidence: String(brief.currentEvidence || ''),
    conflicts: String(brief.conflicts || ''),
    openQuestions: String(brief.openQuestions || ''),
    keySources: Array.isArray(brief.keySources) ? brief.keySources : [],
    version: Number(brief.version || 0)
  };
}

function normalizeMessage(messageDoc) {
  return {
    id: toStringId(messageDoc._id),
    sessionId: toStringId(messageDoc.sessionId),
    role: messageDoc.role || 'assistant',
    text: messageDoc.text || '',
    structuredAnswer: messageDoc.structuredAnswer || null,
    usedSourceIds: Array.isArray(messageDoc.usedSourceIds) ? messageDoc.usedSourceIds : [],
    sourceIndex: messageDoc.sourceIndex || {},
    retrievalStats: messageDoc.retrievalStats || null,
    trace: messageDoc.trace || null,
    intentType: messageDoc.intentType || null,
    contextBadge: messageDoc.contextBadge || null,
    isBookmarked: Boolean(messageDoc.isBookmarked),
    bookmarkedAt: messageDoc.bookmarkedAt || null,
    createdAt: messageDoc.createdAt || null,
    updatedAt: messageDoc.updatedAt || null
  };
}

function normalizeEvidence(evidenceDoc) {
  const relevanceScore =
    evidenceDoc?.finalScore ?? evidenceDoc?.lastRelevanceScore ?? evidenceDoc?.relevanceScore ?? 0;

  return {
    id: toStringId(evidenceDoc?._id),
    title: evidenceDoc?.title || '',
    type: evidenceDoc?.type || '',
    source: evidenceDoc?.source || '',
    relevance_score: clampScore(relevanceScore),
    url: evidenceDoc?.url || '',
    relevanceScore: clampScore(evidenceDoc?.relevanceScore ?? 0),
    credibilityScore: clampScore(evidenceDoc?.sourceCredibility ?? 0),
    recencyScore: clampScore(evidenceDoc?.recencyScore ?? 0),
    compositeScore: clampScore(evidenceDoc?.finalScore ?? 0),
    updatedAt: evidenceDoc?.updatedAt || null
  };
}

function buildTimings(messages = []) {
  return messages
    .filter((message) => message.role === 'assistant')
    .map((message) => ({
      messageId: toStringId(message._id),
      createdAt: message.createdAt || null,
      total_ms: Number(message?.retrievalStats?.timeTakenMs || 0),
      retrieval_pipeline: Array.isArray(message?.retrievalStats?.pipeline_timings)
        ? message.retrievalStats.pipeline_timings
        : [],
      llm_pipeline: Array.isArray(message?.trace?.pipeline_timings) ? message.trace.pipeline_timings : [],
      llm_elapsed_seconds: Number(message?.trace?.llm?.elapsed_seconds || 0)
    }));
}

export async function createSessionExportPayload(sessionId) {
  const sessionDoc = await Session.findById(sessionId).lean();
  if (!sessionDoc) {
    return null;
  }

  const messageDocs = await Message.find({ sessionId }).sort({ createdAt: 1 }).lean();

  const sourceIds = new Set();
  messageDocs.forEach((message) => {
    (message.usedSourceIds || []).forEach((sourceId) => {
      if (sourceId) {
        sourceIds.add(String(sourceId));
      }
    });
  });

  const evidenceDocs =
    sourceIds.size > 0
      ? await SourceDoc.find({ _id: { $in: Array.from(sourceIds) } }).sort({ updatedAt: -1 }).lean()
      : [];

  const payload = {
    session: normalizeSession(sessionDoc),
    messages: messageDocs.map(normalizeMessage),
    evidence: evidenceDocs.map(normalizeEvidence),
    timings: buildTimings(messageDocs),
    exportedAt: new Date().toISOString(),
    totals: {
      messageCount: messageDocs.length,
      evidenceCount: evidenceDocs.length
    }
  };

  return payload;
}

export function flattenEvidenceRows(evidence = []) {
  return (Array.isArray(evidence) ? evidence : []).map((item) => ({
    id: toStringId(item.id || item._id),
    title: sanitizeText(item.title || ''),
    type: sanitizeText(item.type || ''),
    relevance_score: clampScore(item.relevance_score ?? item.relevanceScore ?? 0),
    url: sanitizeText(item.url || '')
  }));
}

function escapeCsvValue(value) {
  const normalized = String(value ?? '');
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function buildCsvExport(payload) {
  const rows = flattenEvidenceRows(payload?.evidence || []);
  const brief = payload?.session?.brief;
  const header = ['id', 'title', 'type', 'relevance_score', 'url'];

  const csvRows = [];

  if (brief?.generatedAt) {
    csvRows.push(['section', 'label', 'value'].join(','));
    csvRows.push(['brief', 'generated_at', escapeCsvValue(String(brief.generatedAt))].join(','));
    csvRows.push(['brief', 'version', escapeCsvValue(String(brief.version || 0))].join(','));
    csvRows.push(['brief', 'background', escapeCsvValue(brief.background || '')].join(','));
    csvRows.push(['brief', 'current_evidence', escapeCsvValue(brief.currentEvidence || '')].join(','));
    csvRows.push(['brief', 'conflicts', escapeCsvValue(brief.conflicts || '')].join(','));
    csvRows.push(['brief', 'open_questions', escapeCsvValue(brief.openQuestions || '')].join(','));

    (brief.keySources || []).forEach((entry, index) => {
      csvRows.push(
        [
          'brief_key_source',
          String(index + 1),
          escapeCsvValue(`${entry?.id || ''} | ${entry?.title || ''} | ${entry?.year || ''} | ${entry?.url || ''}`)
        ].join(',')
      );
    });

    csvRows.push('');
  }

  csvRows.push(header.join(','));
  rows.forEach((row) => {
    csvRows.push(
      [
        escapeCsvValue(row.id),
        escapeCsvValue(row.title),
        escapeCsvValue(row.type),
        escapeCsvValue(row.relevance_score.toFixed(4)),
        escapeCsvValue(row.url)
      ].join(',')
    );
  });

  return `${csvRows.join('\n')}\n`;
}

function buildPdfLines(payload) {
  const lines = [];
  const session = payload?.session || {};
  const brief = session?.brief;
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const evidence = Array.isArray(payload?.evidence) ? payload.evidence : [];
  const timings = Array.isArray(payload?.timings) ? payload.timings : [];

  lines.push('Curalink Session Export');
  lines.push(`Session: ${toAsciiLine(session.title || session.id || 'Unknown')}`);
  lines.push(`Condition: ${toAsciiLine(session.disease || 'Unknown')}`);
  lines.push(`Intent: ${toAsciiLine(session.intent || 'Not specified')}`);
  lines.push(`Exported At: ${toAsciiLine(payload?.exportedAt || new Date().toISOString())}`);
  lines.push('');

  if (brief?.generatedAt) {
    lines.push('Living Research Brief');
    lines.push(`Version: ${Number(brief.version || 0)} | Generated: ${toAsciiLine(brief.generatedAt)}`);
    if (brief.background) {
      lines.push(`Background: ${toAsciiLine(truncate(brief.background, 260))}`);
    }
    if (brief.currentEvidence) {
      lines.push(`Current Evidence: ${toAsciiLine(truncate(brief.currentEvidence, 260))}`);
    }
    if (brief.conflicts) {
      lines.push(`Conflicts: ${toAsciiLine(truncate(brief.conflicts, 260))}`);
    }
    if (brief.openQuestions) {
      lines.push(`Open Questions: ${toAsciiLine(truncate(brief.openQuestions, 260))}`);
    }
    if (Array.isArray(brief.keySources) && brief.keySources.length) {
      lines.push('Brief Key Sources:');
      brief.keySources.slice(0, 5).forEach((entry, index) => {
        lines.push(
          `${index + 1}. ${toAsciiLine(truncate(entry?.title || entry?.id || 'Untitled source', 90))}${entry?.year ? ` (${entry.year})` : ''}`
        );
      });
    }
    lines.push('');
  }

  lines.push(`Messages: ${messages.length}`);
  lines.push(`Evidence Sources: ${evidence.length}`);
  lines.push(`Timing Records: ${timings.length}`);
  lines.push('');

  lines.push('Recent Assistant Summaries');
  messages
    .filter((message) => message.role === 'assistant')
    .slice(-4)
    .forEach((message, index) => {
      lines.push(
        `${index + 1}. ${toAsciiLine(
          truncate(message?.structuredAnswer?.condition_overview || message.text || 'No summary', 120)
        )}`
      );
    });

  lines.push('');
  lines.push('Top Evidence');
  evidence.slice(0, 8).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${toAsciiLine(truncate(item.title || 'Untitled source', 90))} | ${toAsciiLine(item.type)} | score ${Number(
        item.relevance_score || item.compositeScore || 0
      ).toFixed(2)}`
    );
  });

  lines.push('');
  lines.push('Performance');
  timings.slice(-3).forEach((timing, index) => {
    lines.push(
      `${index + 1}. message ${toAsciiLine(
        truncate(timing.messageId, 12)
      )} | total ${Number(timing.total_ms || 0).toFixed(0)} ms | llm ${Number(
        timing.llm_elapsed_seconds || 0
      ).toFixed(2)} s`
    );
  });

  return lines.slice(0, 52);
}

function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createTextPdfBuffer(lines) {
  const safeLines = (Array.isArray(lines) ? lines : []).map((line) => toAsciiLine(line));

  const contentParts = ['BT', '/F1 10 Tf', '40 760 Td', '14 TL'];
  safeLines.forEach((line) => {
    contentParts.push(`(${escapePdfText(line)}) Tj`);
    contentParts.push('T*');
  });
  contentParts.push('ET');

  const contentStream = contentParts.join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  ];

  const header = '%PDF-1.4\n';
  let offset = Buffer.byteLength(header, 'utf8');
  const offsets = [0];

  objects.forEach((objectBody) => {
    offsets.push(offset);
    offset += Buffer.byteLength(objectBody, 'utf8');
  });

  const xrefStart = offset;
  const xrefRows = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n'];
  offsets.slice(1).forEach((entryOffset) => {
    xrefRows.push(`${String(entryOffset).padStart(10, '0')} 00000 n \n`);
  });

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(`${header}${objects.join('')}${xrefRows.join('')}${trailer}`, 'utf8');
}

async function renderPdfWithPdfKit(payload) {
  try {
    const module = await import('pdfkit');
    const PDFDocument = module?.default || module;

    if (typeof PDFDocument !== 'function') {
      return null;
    }

    return await new Promise((resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({ margin: 40 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const session = payload?.session || {};
      const brief = session?.brief;
      doc.fontSize(18).text('Curalink Session Export');
      doc.moveDown(0.5);
      doc.fontSize(11).text(`Condition: ${session.disease || 'Unknown'}`);
      doc.text(`Session: ${session.title || session.id || 'Unknown'}`);
      doc.text(`Exported At: ${payload?.exportedAt || new Date().toISOString()}`);
      doc.moveDown();

      if (brief?.generatedAt) {
        doc.fontSize(13).text('Living Research Brief');
        doc.fontSize(10).text(`Version: ${Number(brief.version || 0)} | Generated: ${brief.generatedAt}`);
        if (brief.background) {
          doc.moveDown(0.3);
          doc.fontSize(11).text('Background');
          doc.fontSize(10).text(brief.background);
        }
        if (brief.currentEvidence) {
          doc.moveDown(0.3);
          doc.fontSize(11).text('Current Evidence');
          doc.fontSize(10).text(brief.currentEvidence);
        }
        if (brief.conflicts) {
          doc.moveDown(0.3);
          doc.fontSize(11).text('Conflicts');
          doc.fontSize(10).text(brief.conflicts);
        }
        if (brief.openQuestions) {
          doc.moveDown(0.3);
          doc.fontSize(11).text('Open Questions');
          doc.fontSize(10).text(brief.openQuestions);
        }
        if (Array.isArray(brief.keySources) && brief.keySources.length) {
          doc.moveDown(0.3);
          doc.fontSize(11).text('Key Sources');
          brief.keySources.slice(0, 8).forEach((entry, index) => {
            doc
              .fontSize(10)
              .text(
                `${index + 1}. ${truncate(entry?.title || entry?.id || 'Untitled source', 95)}${entry?.year ? ` (${entry.year})` : ''}`
              );
          });
        }

        doc.moveDown();
      }

      doc.fontSize(13).text('Top Evidence');
      (payload?.evidence || []).slice(0, 12).forEach((item, index) => {
        doc
          .fontSize(10)
          .text(
            `${index + 1}. ${truncate(item.title || 'Untitled source', 95)} (${item.type || 'unknown'}) score ${Number(
              item.relevance_score || item.compositeScore || 0
            ).toFixed(2)}`
          );
      });

      doc.moveDown();
      doc.fontSize(13).text('Recent Assistant Messages');
      (payload?.messages || [])
        .filter((message) => message.role === 'assistant')
        .slice(-4)
        .forEach((message, index) => {
          const summary = truncate(message?.structuredAnswer?.condition_overview || message.text || '', 180);
          doc.fontSize(10).text(`${index + 1}. ${summary}`);
        });

      doc.end();
    });
  } catch {
    return null;
  }
}

export async function buildPdfExport(payload) {
  const rendered = await renderPdfWithPdfKit(payload);
  if (rendered) {
    return {
      buffer: rendered,
      renderer: 'pdfkit'
    };
  }

  return {
    buffer: createTextPdfBuffer(buildPdfLines(payload)),
    renderer: 'text-fallback'
  };
}
