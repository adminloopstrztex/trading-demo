import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';

type Level = 'beginner' | 'intermediate' | 'advanced';

function levelOf(exp: number | null | undefined): Level {
  if (exp == null || exp <= 3) return 'beginner';
  if (exp <= 7) return 'intermediate';
  return 'advanced';
}

// Copy adapted to the trader's self-reported experience. Market-focused tone.
const COPY: Record<Level, { title: (n: string) => string; sub: string; cta: string; to: string }> = {
  beginner: {
    title: (n) => `Bienvenido a tus mercados, ${n}`,
    sub: 'Explora los activos, sigue los precios en vivo y coloca tu primera operación cuando estés listo.',
    cta: 'Explorar mercados',
    to: '/app/invest',
  },
  intermediate: {
    title: (n) => `De vuelta a los mercados, ${n}`,
    sub: 'Revisa tus posiciones, vigila las oportunidades y ajusta tu estrategia al momento.',
    cta: 'Abrir la Terminal',
    to: '/app/terminal',
  },
  advanced: {
    title: (n) => `Los mercados están en movimiento, ${n}`,
    sub: 'Afina tu estrategia, aprovecha la volatilidad y ejecuta con precisión.',
    cta: 'Abrir la Terminal',
    to: '/app/terminal',
  },
};

export default function WelcomeBanner() {
  const user = useAccountStore((s) => s.user);
  const storageKey = user ? `stratex-welcome-${user.id}` : '';
  const [dismissed, setDismissed] = useState(() => (storageKey ? localStorage.getItem(storageKey) === '1' : true));

  if (!user || dismissed) return null;

  const firstName = user.name?.split(' ')[0] ?? '';
  const copy = COPY[levelOf(user.survey?.tradingExperience)];

  function dismiss() {
    if (storageKey) localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#16C784]/25 bg-gradient-to-r from-[#0E1B17] via-[#101216] to-[#101216] px-5 py-4">
      {/* subtle accent glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#16C784]/10 blur-3xl" />
      <button
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute right-3 top-3 p-1 text-[#5B6472] hover:text-[#F2F3F5]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#F2F3F5]">{copy.title(firstName)}</h2>
          <p className="text-sm text-[#8B92A0] mt-0.5 max-w-xl">{copy.sub}</p>
        </div>
        <Link
          to={copy.to}
          className="shrink-0 bg-[#16C784] hover:bg-[#13B374] text-[#0A0B0D] font-semibold rounded-xl px-4 py-2 text-sm transition"
        >
          {copy.cta}
        </Link>
      </div>
    </div>
  );
}
