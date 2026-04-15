import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  currentSession: null,
  messages: [],
  sources: [],
  sourcesByMessageId: {},
  selectedAssistantMessageId: null,
  isLoading: false,
  activeTab: 'publications',
  showContextForm: false,

  setSession: (session) => set({ currentSession: session }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),
  applyAssistantResponse: (message, sources) =>
    set((state) => {
      const assistantMessageId = String(message?._id || `assistant-${Date.now()}`);
      const nextMessage = message?._id ? message : { ...message, _id: assistantMessageId };
      const nextSources = Array.isArray(sources) ? sources : [];

      return {
        messages: [...state.messages, nextMessage],
        sources: nextSources,
        selectedAssistantMessageId: assistantMessageId,
        sourcesByMessageId: {
          ...state.sourcesByMessageId,
          [assistantMessageId]: nextSources
        }
      };
    }),
  setMessages: (messages) =>
    set((state) => {
      const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
      const latestAssistantId = latestAssistant?._id ? String(latestAssistant._id) : null;

      return {
        messages,
        selectedAssistantMessageId: latestAssistantId,
        sources: latestAssistantId ? state.sourcesByMessageId[latestAssistantId] || state.sources : []
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
        };
      }

      return nextState;
    }),
  setSelectedAssistantMessage: (messageId) =>
    set((state) => {
      const normalizedMessageId = messageId ? String(messageId) : null;
      return {
        selectedAssistantMessageId: normalizedMessageId,
        sources: normalizedMessageId ? state.sourcesByMessageId[normalizedMessageId] || [] : []
      };
    }),
  setLoading: (val) => set({ isLoading: val }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setShowContextForm: (showContextForm) => set({ showContextForm }),
  reset: () =>
    set({
      currentSession: null,
      messages: [],
      sources: [],
      sourcesByMessageId: {},
      selectedAssistantMessageId: null,
      isLoading: false,
      activeTab: 'publications',
      showContextForm: false
    })
}));
