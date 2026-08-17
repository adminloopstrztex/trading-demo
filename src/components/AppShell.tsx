import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import { useMarketTicker } from '../hooks/useMarketTicker';
import { useCryptoFeed } from '../hooks/useCryptoFeed';
import { useOrderWatcher } from '../hooks/useOrderWatcher';
import Sidebar from './Sidebar';
import Logo from './Logo';

export default function AppShell() {
  useMarketTicker(1200);
  useCryptoFeed(20000);
  useOrderWatcher();
  const user = useAccountStore((s) => s.user);
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
        </header>
        <main className="flex-1 min-h-0 max-w-[1400px] mx-auto w-full px-6 py-6 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
