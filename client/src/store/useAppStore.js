import { create } from 'zustand';

function normalizeList(values) {
  if (Array.isArray(values)) {
    return values.map((item) => String(item || '').trim()).filter(Boolean);
  }

  return String(values || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPatientProfileFromSession(session) {
  const safeSession = session && typeof session === 'object' ? session : {};
  const demographics = safeSession.demographics && typeof safeSession.demographics === 'object'
    ? safeSession.demographics
    : {};
  const location = safeSession.location && typeof safeSession.location === 'object'
    ? safeSession.location
    : {};

  return {
    age: Number.isFinite(Number(demographics.age)) ? Number(demographics.age) : null,
    ageRange: String(demographics.ageRange || '').trim(),
    sex: String(demographics.sex || '').trim(),
    conditions: normalizeList(demographics.conditions),
    location: {
      city: String(location.city || '').trim(),
      country: String(location.country || '').trim()
    },
    intent: String(safeSession.intent || '').trim()
  };
}

function buildConflictMap(messages = []) {
  const map = {};

  (Array.isArray(messages) ? messages : []).forEach((message) => {
    const messageId = String(message?._id || message?.id || '');
    if (!messageId || message?.role !== 'assistant') {
      return;
    }

    map[messageId] = Array.isArray(message?.conflicts) ? message.conflicts : [];
  });

  return map;
}

export const useAppStore = create((set) => ({
  currentSession: null,
  sessionUploadedDocs: [],
  pdfContextActive: false,
  showAbnormalAlert: false,
  latestAbnormalFindings: [],
  messages: [],
  sources: [],
  sourcesByMessageId: {},
  conflicts: [],
  conflictsByMessageId: {},
  sessionConflicts: {
    totalConflicts: 0,
    outcomeGroups: []
  },
  patientProfile: null,
  livingBrief: null,
  selectedAssistantMessageId: null,
  highlightedMessageId: null,
  isLoading: false,
  activeTab: 'publications',
  error: null,

  setSession: (session) =>
    set({
      currentSession: session,
      sessionUploadedDocs: Array.isArray(session?.uploadedDocs) ? session.uploadedDocs : [],
      pdfContextActive: Array.isArray(session?.uploadedDocs) ? session.uploadedDocs.length > 0 : false,
      patientProfile: buildPatientProfileFromSession(session),
      livingBrief: session?.brief?.generatedAt ? session.brief : null
    }),
  setSessionUploadedDocs: (docs) =>
    set({
      sessionUploadedDocs: Array.isArray(docs) ? docs : [],
      pdfContextActive: Array.isArray(docs) ? docs.length > 0 : false
    }),
  addUploadedDoc: (doc) =>
    set((state) => {
      const current = Array.isArray(state.sessionUploadedDocs) ? state.sessionUploadedDocs : [];
      const next = [
        ...current.filter((item) => String(item?.doc_id || '') !== String(doc?.doc_id || '')),
        doc
      ];
      return {
        sessionUploadedDocs: next,
        pdfContextActive: next.length > 0
      };
    }),
  removeUploadedDoc: (docId) =>
    set((state) => {
      const next = (Array.isArray(state.sessionUploadedDocs) ? state.sessionUploadedDocs : []).filter(
        (item) => String(item?.doc_id || '') !== String(docId || '')
      );
      return {
        sessionUploadedDocs: next,
        pdfContextActive: next.length > 0
      };
    }),
  setPdfContextActive: (value) => set({ pdfContextActive: Boolean(value) }),
  setShowAbnormalAlert: (value) => set({ showAbnormalAlert: Boolean(value) }),
  setLatestAbnormalFindings: (findings) =>
    set({
      latestAbnormalFindings: Array.isArray(findings) ? findings : []
    }),
  setError: (error) => set({ error }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      showAbnormalAlert: message?.role === 'user' ? false : state.showAbnormalAlert
    })),
  setPatientProfile: (patientProfile) =>
    set((state) => ({
      patientProfile: {
        ...(state.patientProfile || {}),
        ...(patientProfile || {})
      }
    })),
  setSessionConflicts: (sessionConflicts) =>
    set({
      sessionConflicts: {
        totalConflicts: Number(sessionConflicts?.totalConflicts || 0),
        outcomeGroups: Array.isArray(sessionConflicts?.outcomeGroups) ? sessionConflicts.outcomeGroups : []
      }
    }),
  setLivingBrief: (brief) =>
    set({
      livingBrief: brief?.generatedAt ? brief : null
    }),
  setConflictsForMessage: (messageId, conflicts) =>
    set((state) => {
      const normalizedId = messageId ? String(messageId) : '';
      if (!normalizedId) {
        return {};
      }

      const normalizedConflicts = Array.isArray(conflicts) ? conflicts : [];
      return {
        conflictsByMessageId: {
          ...state.conflictsByMessageId,
          [normalizedId]: normalizedConflicts
        },
        conflicts:
          state.selectedAssistantMessageId && state.selectedAssistantMessageId === normalizedId
            ? normalizedConflicts
            : state.conflicts
      };
    }),
  applyAssistantResponse: (message, sources, metadata = {}) =>
    set((state) => {
      const assistantMessageId = String(message?._id || `assistant-${Date.now()}`);
      const nextMessage = message?._id ? message : { ...message, _id: assistantMessageId };
      const nextSources = Array.isArray(sources) ? sources : [];
      const nextConflicts = Array.isArray(metadata?.conflicts)
        ? metadata.conflicts
        : Array.isArray(message?.conflicts)
          ? message.conflicts
          : [];

      return {
        messages: [...state.messages, nextMessage],
        sources: nextSources,
        conflicts: nextConflicts,
        selectedAssistantMessageId: assistantMessageId,
        sourcesByMessageId: {
          ...state.sourcesByMessageId,
          [assistantMessageId]: nextSources
        },
        conflictsByMessageId: {
          ...state.conflictsByMessageId,
          [assistantMessageId]: nextConflicts
        },
        patientProfile: metadata?.patientProfile
          ? {
              ...(state.patientProfile || {}),
              ...(metadata.patientProfile || {})
            }
          : state.patientProfile,
        livingBrief: metadata?.brief?.generatedAt
          ? metadata.brief
          : state.livingBrief,
        showAbnormalAlert: false
      };
    }),
  setMessages: (messages) =>
    set((state) => {
      const safeMessages = Array.isArray(messages) ? messages : [];
      const latestAssistant = [...safeMessages].reverse().find((message) => message.role === 'assistant');
      const latestAssistantId = latestAssistant?._id ? String(latestAssistant._id) : null;
      const conflictsByMessageId = buildConflictMap(safeMessages);

      return {
        messages: safeMessages,
        conflictsByMessageId,
        selectedAssistantMessageId: latestAssistantId,
        sources: latestAssistantId ? state.sourcesByMessageId[latestAssistantId] || state.sources : [],
        conflicts: latestAssistantId ? conflictsByMessageId[latestAssistantId] || [] : []
      };
    }),
  setSources: (sources, messageId = null) =>
    set((state) => {
      const normalizedSources = Array.isArray(sources) ? sources : [];
      const targetMessageId = messageId ? String(messageId) : state.selectedAssistantMessageId;
      const nextState = {
        sources: normalizedSources
      };

      if (targetMessageId) {
        nextState.sourcesByMessageId = {
          ...state.sourcesByMessageId,
          [targetMessageId]: normalizedSources
        }
      };

      return nextState;
    }),
  setSelectedAssistantMessage: (messageId) =>
    set((state) => {
      const normalizedMessageId = messageId ? String(messageId) : null;
      return {
        selectedAssistantMessageId: normalizedMessageId,
        sources: normalizedMessageId ? state.sourcesByMessageId[normalizedMessageId] || [] : [],
        conflicts: normalizedMessageId ? state.conflictsByMessageId[normalizedMessageId] || [] : []
      };
    }),
  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        const candidateId = String(message?._id || message?.id || '');
        if (!candidateId || candidateId !== String(messageId)) {
          return message;
        }

        return {
          ...message,
          ...updates
        };
      })
    })),
  setHighlightedMessage: (messageId) =>
    set({ highlightedMessageId: messageId ? String(messageId) : null }),
  setLoading: (val) => set({ isLoading: val }),
  setActiveTab: (activeTab) => set({ activeTab }),
  reset: () =>
    set({
      currentSession: null,
      sessionUploadedDocs: [],
      pdfContextActive: false,
      showAbnormalAlert: false,
      latestAbnormalFindings: [],
      messages: [],
      sources: [],
      sourcesByMessageId: {},
      conflicts: [],
      conflictsByMessageId: {},
      sessionConflicts: {
        totalConflicts: 0,
        outcomeGroups: []
      },
      patientProfile: null,
      livingBrief: null,
      selectedAssistantMessageId: null,
      highlightedMessageId: null,
      isLoading: false,
      activeTab: 'publications',
      error: null
    })
}));
