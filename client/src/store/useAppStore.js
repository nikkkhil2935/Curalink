import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  currentSession: null,
  messages: [],
  sources: [],
  isLoading: false,
  activeTab: 'publications',
  showContextForm: false,

  setSession: (session) => set({ currentSession: session }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),
  setMessages: (messages) => set({ messages }),
  setSources: (sources) => set({ sources }),
  setLoading: (val) => set({ isLoading: val }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setShowContextForm: (showContextForm) => set({ showContextForm }),
  reset: () =>
    set({
      currentSession: null,
      messages: [],
      sources: [],
      isLoading: false,
      activeTab: 'publications',
      showContextForm: false
    })
}));
