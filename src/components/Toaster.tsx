import type { ReactNode } from 'react';
import { useToastStore, type ToastKind } from '../store/toastStore';

const ICON: Record<ToastKind, ReactNode> = {
  success: (
    <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  ),
  error: (
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
};

const ACCENT: Record<ToastKind, string> = {
  success: 'var(--up)',
  error: 'var(--down)',
  info: 'var(--accent)',
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]"
      role="region"
      aria-live="polite"
      aria-label="Notificaciones"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="strx-toast-in flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)' }}
        >
          <span
            className="mt-0.5 grid place-items-center w-5 h-5 rounded-full shrink-0"
            style={{ color: ACCENT[t.kind] }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              {ICON[t.kind]}
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {t.title}
            </div>
            {t.desc && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {t.desc}
              </div>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            aria-label="Cerrar notificación"
            className="shrink-0 -mr-1 -mt-0.5 p-1"
            style={{ color: 'var(--text-dim)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
