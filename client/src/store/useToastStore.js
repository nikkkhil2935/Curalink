import { create } from 'zustand';

const TOAST_TTL_MS = 4000;

function nextToastId() {
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export const useToastStore = create((set) => ({
  toasts: [],
  pushToast: (toast) => {
    const id = toast?.id || nextToastId();
    const nextToast = {
      id,
      title: String(toast?.title || ''),
      message: String(toast?.message || ''),
      variant: toast?.variant || 'info',
      loading: Boolean(toast?.loading),
      ttlMs: Number(toast?.ttlMs || TOAST_TTL_MS)
    };

    set((state) => ({
      toasts: [...state.toasts.filter((item) => item.id !== id), nextToast]
    }));

    return id;
  },
  patchToast: (id, patch) => {
    set((state) => ({
      toasts: state.toasts.map((toast) => (toast.id === id ? { ...toast, ...patch } : toast))
    }));
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    }));
  }
}));

export function pushToast(toast) {
  return useToastStore.getState().pushToast(toast);
}

export function patchToast(id, patch) {
  useToastStore.getState().patchToast(id, patch);
}

export function dismissToast(id) {
  useToastStore.getState().dismissToast(id);
}
