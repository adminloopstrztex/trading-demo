import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandStore } from '../store/commandStore';
import { useAccountStore } from '../store/accountStore';
import { useMarketStore } from '../store/marketStore';

interface Item {
  id: string;
  group: string;
  label: string;
  sub?: string;
  keywords?: string;
  icon: ReactNode;
  run: () => void;
}

const ICON = {
  portfolio: <path d="M4 14l5-5 4 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  invest: (
    <>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  terminal: <rect x="3" y="4" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="2" />,
  orders: <path d="M5 4h14v16l-3-2-2 2-3-2-3 2-2-2-1 2V4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  crm: <path d="M4 19V5m5 14V9m5 10V4m5 15v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  asset: <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />,
  logout: <path d="M14 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2v-2M10 12h11m0 0l-3-3m3 3l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
} as const;

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
      {children}
    </svg>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function CommandPalette() {
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const toggle = useCommandStore((s) => s.toggle);
  const navigate = useNavigate();
  const user = useAccountStore((s) => s.user);
  const logout = useAccountStore((s) => s.logout);
  const assets = useMarketStore((s) => s.assets);

  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut (only for signed-in users, so it never hijacks the landing/login).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        if (!user) return;
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, user]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const isAdmin = (user?.permissions ?? []).includes('crm.view');

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => {
      navigate(to);
      setOpen(false);
    };
    const nav: Item[] = [
      { id: 'nav-portfolio', group: 'Ir a', label: 'Portafolio', keywords: 'inicio balance', icon: <Glyph>{ICON.portfolio}</Glyph>, run: go('/app') },
      { id: 'nav-invest', group: 'Ir a', label: 'Invertir', keywords: 'mercado activos comprar', icon: <Glyph>{ICON.invest}</Glyph>, run: go('/app/invest') },
      { id: 'nav-terminal', group: 'Ir a', label: 'Terminal', keywords: 'grafico pro', icon: <Glyph>{ICON.terminal}</Glyph>, run: go('/app/terminal') },
      { id: 'nav-orders', group: 'Ir a', label: 'Órdenes', keywords: 'pendientes limite stop historial', icon: <Glyph>{ICON.orders}</Glyph>, run: go('/app/orders') },
    ];
    if (isAdmin) {
      nav.push(
        { id: 'nav-crm', group: 'CRM', label: 'Dashboard CRM', keywords: 'admin metricas panel', icon: <Glyph>{ICON.crm}</Glyph>, run: go('/admin') },
        { id: 'nav-users', group: 'CRM', label: 'Usuarios', keywords: 'clientes crm', icon: <Glyph>{ICON.crm}</Glyph>, run: go('/admin/users') },
        { id: 'nav-team', group: 'CRM', label: 'Equipo', keywords: 'roles permisos staff', icon: <Glyph>{ICON.crm}</Glyph>, run: go('/admin/team') }
      );
    }
    const assetItems: Item[] = Object.values(assets).map((a) => ({
      id: `asset-${a.symbol}`,
      group: 'Activos',
      label: a.symbol,
      sub: a.name,
      keywords: a.name,
      icon: <Glyph>{ICON.asset}</Glyph>,
      run: go(`/app/invest/${a.symbol}`),
    }));
    const actions: Item[] = [
      {
        id: 'act-logout',
        group: 'Acciones',
        label: 'Cerrar sesión',
        keywords: 'salir logout',
        icon: <Glyph>{ICON.logout}</Glyph>,
        run: () => {
          logout();
          setOpen(false);
          navigate('/login');
        },
      },
    ];
    return [...nav, ...assetItems, ...actions];
  }, [assets, isAdmin, navigate, setOpen, logout]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => `${it.label} ${it.sub ?? ''} ${it.keywords ?? ''}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (sel >= filtered.length) setSel(Math.max(0, filtered.length - 1));
  }, [filtered, sel]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(filtered.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[sel]?.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Group for display while keeping a flat index for keyboard selection.
  let flat = -1;
  const groups: { name: string; rows: { it: Item; idx: number }[] }[] = [];
  for (const it of filtered) {
    flat++;
    const g = groups.find((x) => x.name === it.group);
    const row = { it, idx: flat };
    if (g) g.rows.push(row);
    else groups.push({ name: it.group, rows: [row] });
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Buscador de comandos"
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-dim)' }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            placeholder="Buscar activos, ir a una sección…"
            aria-label="Buscar"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
          <kbd
            className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
            style={{ color: 'var(--text-dim)', borderColor: 'var(--border-strong)' }}
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm px-4 py-8 text-center" style={{ color: 'var(--text-dim)' }}>
              Sin resultados para “{query}”.
            </p>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="px-2 pb-1">
                <div
                  className="text-[10px] font-mono uppercase tracking-wider px-2 pt-2 pb-1"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {g.name}
                </div>
                {g.rows.map(({ it, idx }) => {
                  const active = idx === sel;
                  return (
                    <button
                      key={it.id}
                      ref={active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                      onMouseMove={() => setSel(idx)}
                      onClick={it.run}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left"
                      style={{
                        background: active ? 'var(--up-soft)' : 'transparent',
                        color: active ? 'var(--text)' : 'var(--text-muted)',
                      }}
                    >
                      <span style={{ color: active ? 'var(--up)' : 'var(--text-dim)' }}>{it.icon}</span>
                      <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                        {it.label}
                      </span>
                      {it.sub && (
                        <span className="text-xs truncate max-w-[45%]" style={{ color: 'var(--text-dim)' }}>
                          {it.sub}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="flex items-center gap-4 px-4 py-2 border-t text-[11px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-dim)' }}
        >
          <span className="font-mono">↑↓ navegar</span>
          <span className="font-mono">↵ abrir</span>
          <span className="ml-auto font-mono">{isMac ? '⌘' : 'Ctrl'} K</span>
        </div>
      </div>
    </div>
  );
}
