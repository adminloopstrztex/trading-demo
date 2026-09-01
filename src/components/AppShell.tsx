import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import { useCommandStore } from '../store/commandStore';
import { useMarketTicker } from '../hooks/useMarketTicker';
import { useCryptoFeed } from '../hooks/useCryptoFeed';
import { useOrderWatcher } from '../hooks/useOrderWatcher';
import Sidebar from './Sidebar';
import Logo from './Logo';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function AppShell() {
  useMarketTicker(1200);
  useCryptoFeed(20000);
  useOrderWatcher();
  const user = useAccountStore((s) => s.user);
  const openPalette = useCommandStore((s) => s.setOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex bg-[#0A0B0D]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 min-w-0 min-h-screen flex flex-col">
        {/* Barra superior con hamburguesa (todos los tamaños) */}
        <header className="flex items-center gap-3 h-14 px-4 border-b border-[#1E2128] bg-[#0F1115]">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            className="-ml-1 p-1 text-[#F2F3F5]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Logo size={28} />
          <button
            onClick={() => openPalette(true)}
            aria-label="Buscar (abrir paleta de comandos)"
            className="ml-auto flex items-center gap-2 rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-1.5 text-[#8B92A0] hover:text-[#F2F3F5] hover:border-[#262A33] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline text-sm">Buscar</span>
            <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#262A33]">
              {isMac ? '⌘' : 'Ctrl'} K
            </kbd>
          </button>
        </header>
        <main className="flex-1 min-h-0 max-w-[1400px] mx-auto w-full px-6 py-6 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
