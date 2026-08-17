import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import Logo from './Logo';
import { useAccountStore } from '../store/accountStore';

const ICONS: Record<string, ReactNode> = {
  portfolio: (
    <path
      d="M4 14L9 9L13 12L20 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M6 13l3-3 2.5 2.5L16 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  invest: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  orders: (
    <path
      d="M5 4h14v16l-3-2-2 2-3-2-3 2-2-2-1 2V4z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  ),
};

function NavIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      {ICONS[name]}
    </svg>
  );
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAccountStore((s) => s.user);
  const logout = useAccountStore((s) => s.logout);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
      isActive ? 'bg-[#16C784]/15 text-[#16C784]' : 'text-[#8B92A0] hover:bg-white/5 hover:text-[#F2F3F5]'
    }`;

  return (
    <>
      {/* Backdrop cuando el drawer está abierto (todos los tamaños) */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-[#0F1115] border-r border-[#1E2128] flex flex-col px-3 py-5 transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-2 mb-8">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="-mr-1 p-1 text-[#8B92A0] hover:text-[#F2F3F5]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to="/app" className={linkClass} end onClick={onClose}>
            <NavIcon name="portfolio" />
            Portfolio
          </NavLink>
          <NavLink to="/app/terminal" className={linkClass} onClick={onClose}>
            <NavIcon name="terminal" />
            Terminal
          </NavLink>
          <NavLink to="/app/invest" className={linkClass} onClick={onClose}>
            <NavIcon name="invest" />
            Invertir
          </NavLink>
          <NavLink to="/app/orders" className={linkClass} onClick={onClose}>
            <NavIcon name="orders" />
            Órdenes
          </NavLink>
        </nav>
        <div className="mt-auto px-2 pt-4 border-t border-[#1E2128]">
          <div className="text-sm font-medium text-[#F2F3F5]">{user?.name}</div>
          <button onClick={logout} className="text-xs text-[#8B92A0] hover:text-[#FF5C5C] mt-1">
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
