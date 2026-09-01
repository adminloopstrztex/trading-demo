import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  desc?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

// Convenience API so callers don't need the hook: toast.success('...').
export const toast = {
  success: (title: string, desc?: string) => useToastStore.getState().push({ kind: 'success', title, desc }),
  error: (title: string, desc?: string) => useToastStore.getState().push({ kind: 'error', title, desc }),
  info: (title: string, desc?: string) => useToastStore.getState().push({ kind: 'info', title, desc }),
};
