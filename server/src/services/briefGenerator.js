import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import SourceDoc from '../models/SourceDoc.js';
import Analytics from '../models/Analytics.js';
import logger from '../lib/logger.js';
import { callLLM, parseLLMResponse } from './llm.js';

function summarizeText(value, maxLength = 200) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function safeYear(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

function normalizeBrief(brief = {}) {
  return {
    generatedAt: new Date(),
    background: String(brief.background || '').trim(),
    currentEvidence: String(brief.currentEvidence || '').trim(),
    conflicts: String(brief.conflicts || '').trim(),
    openQuestions: String(brief.openQuestions || '').trim(),
    keySources: Array.isArray(brief.keySources)
      ? brief.keySources
          .map((entry) => ({
            id: String(entry?.id || '').trim(),
            title: String(entry?.title || '').trim(),
            year: safeYear(entry?.year),
            url: String(entry?.url || '').trim()
          }))
          .filter((entry) => entry.id || entry.title)
      : []
  };
}

function buildFallbackBrief({ session, assistantMessages, uniqueSources, conflicts }) {
  const latestAssistant = assistantMessages[assistantMessages.length - 1] || null;
  const followUps = latestAssistant?.structuredAnswer?.follow_up_suggestions || [];

  return normalizeBrief({
    background: `Session focus: ${session?.disease || 'Unknown condition'}${session?.intent ? ` (${session.intent})` : ''}.`,
    currentEvidence:
      summarizeText(latestAssistant?.structuredAnswer?.condition_overview || latestAssistant?.text || '') ||
      'Evidence is still accumulating for this session.',
    conflicts: conflicts.length
      ? `Detected ${conflicts.length} evidence conflicts across outcomes: ${conflicts
          .slice(0, 3)
          .map((entry) => entry.outcomePhrase)
          .join(', ')}.`
      : 'No major evidence conflicts were detected in this session.',
    openQuestions: followUps.length
      ? followUps.slice(0, 3).join(' ')
      : 'What additional subgroup analyses or recent studies should be reviewed?',
    keySources: uniqueSources.slice(0, 8).map((source) => ({
      id: String(source?._id || source?.id || ''),
      title: String(source?.title || '').trim(),
      year: safeYear(source?.year),
      url: String(source?.url || '').trim()
    }))
  });
}

function buildBriefPrompts({ session, assistantMessages, uniqueSources, conflicts }) {
  const answerSummaries = assistantMessages
    .map((message, index) => {
      const summary = summarizeText(
        message?.structuredAnswer?.condition_overview || message?.text || '',
        200
      );
      return summary ? `${index + 1}. ${summary}` : null;
    })
    .filter(Boolean)
    .join('\n');

  const sourceSummaries = uniqueSources
    .slice(0, 25)
    .map((source, index) => {
      const year = safeYear(source?.year);
      return `${index + 1}. ${source?.title || 'Untitled source'}${year ? ` (${year})` : ''}`;
    })
    .join('\n');

  const conflictSummary = conflicts.length
    ? conflicts
        .slice(0, 12)
        .map((entry, index) => {
          const left = `${entry?.sourceA?.title || 'Source A'} (${entry?.sourceA?.year || 'n/a'})`;
          const right = `${entry?.sourceB?.title || 'Source B'} (${entry?.sourceB?.year || 'n/a'})`;
          return `${index + 1}. ${entry?.outcomePhrase || 'Outcome'}: ${left} vs ${right}`;
        })
        .join('\n')
    : 'No conflicts detected.';

  const systemPrompt = [
    'You are a medical librarian generating a longitudinal research brief.',
    'Return valid JSON only with this exact shape:',
    '{',
    '  "background": "string",',
    '  "currentEvidence": "string",',
    '  "conflicts": "string",',
    '  "openQuestions": "string",',
    '  "keySources": [{"id":"string","title":"string","year":2024,"url":"string"}]',
    '}',
    'Use concise clinical language and avoid treatment advice.'
  ].join('\n');

  const userPrompt = [
    `Condition: ${session?.disease || 'Unknown'}`,
    `Intent: ${session?.intent || 'General research'}`,
    `Location context: ${session?.location?.city || ''} ${session?.location?.country || ''}`.trim() ||
      'Location context: Not specified',
    '',
    'Assistant answer summaries:',
    answerSummaries || 'None',
    '',
    'Unique source list:',
    sourceSummaries || 'None',
    '',
    'Conflict summary:',
    conflictSummary,
    '',
    'Generate sections for Background, Current Evidence, Conflicts, Open Questions, and Key Sources.'
  ].join('\n');

  return {
    systemPrompt,
    userPrompt
  };
}

export async function generateSessionBrief(sessionId) {
  if (!mongoose.Types.ObjectId.isValid(sessionId)) {
    throw new Error('Invalid session id');
  }

  const session = await Session.findById(sessionId).lean();
  if (!session) {
    throw new Error('Session not found');
  }

  const assistantMessages = await Message.find({ sessionId, role: 'assistant' })
    .sort({ createdAt: 1 })
    .lean();

  const sourceIds = new Set();
  const allConflicts = [];

  assistantMessages.forEach((message) => {
    (message?.usedSourceIds || []).forEach((sourceId) => {
      if (sourceId) {
        sourceIds.add(String(sourceId));
      }
    });

    (message?.conflicts || []).forEach((conflict) => {
      if (conflict) {
        allConflicts.push(conflict);
      }
    });
  });

  const uniqueSources = sourceIds.size
    ? await SourceDoc.find({ _id: { $in: Array.from(sourceIds) } }).lean()
    : [];

  let nextBrief = null;

  if (assistantMessages.length < 2) {
    nextBrief = normalizeBrief({
      background:
        'Brief generation requires at least two assistant responses to synthesize longitudinal evidence.',
      currentEvidence: '',
      conflicts: '',
      openQuestions: '',
      keySources: []
    });
  } else {
    const { systemPrompt, userPrompt } = buildBriefPrompts({
      session,
      assistantMessages,
      uniqueSources,
      conflicts: allConflicts
    });

    try {
      const llmData = await callLLM(systemPrompt, userPrompt, { max_tokens: 1200 });
      const parsedBrief = parseLLMResponse(llmData, {
        mode: 'brief',
        fallbackSources: uniqueSources
      });
      nextBrief = normalizeBrief(parsedBrief);
    } catch (error) {
      logger.warn(`Brief generation LLM call failed for session ${sessionId}: ${error.message}`);
      nextBrief = buildFallbackBrief({
        session,
        assistantMessages,
        uniqueSources,
        conflicts: allConflicts
      });
    }
  }

  const updatedSession = await Session.findByIdAndUpdate(
    sessionId,
    {
      $set: {
        brief: {
          ...nextBrief,
          version: Number(session?.brief?.version || 0) + 1
        }
      }
    },
    { new: true }
  ).lean();

  await Analytics.create({
    event: 'brief_generated',
    disease: String(session?.disease || '').toLowerCase(),
    sessionId,
    metadata: {
      version: Number(updatedSession?.brief?.version || 0),
      sourceCount: uniqueSources.length,
      conflictCount: allConflicts.length
    }
  }).catch((error) => {
    logger.error(`Analytics brief_generated logging error: ${error.message}`);
  });

  return updatedSession?.brief || null;
}

export default generateSessionBrief;
