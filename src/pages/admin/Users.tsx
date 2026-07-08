import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { PagedUsers } from './types';
import { Avatar, KycBadge, StatusBadge, Skeleton, EmptyState, fmtMoney, timeAgo } from './ui';

const PAGE_SIZE = 8;

export default function AdminUsers() {
  const [data, setData] = useState<PagedUsers | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kyc, setKyc] = useState('');
  const [segment, setSegment] = useState('');
  const [page, setPage] = useState(1);

  // reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [q, status, kyc, segment]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (kyc) params.set('kyc', kyc);
    if (segment) params.set('segment', segment);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    setData(null);
    const t = setTimeout(() => {
      api<PagedUsers>(`/admin/users?${params.toString()}`)
        .then(setData)
        .catch(() => setData({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE }));
    }, 200);
    return () => clearTimeout(t);
  }, [q, status, kyc, segment, page]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = data?.items ?? [];
  const loading = data === null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-[#F2F3F5]">Usuarios</h1>
        <p className="text-sm text-[#8B92A0]">{loading ? 'Cargando…' : `${total} resultados`}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6472] pointer-events-none">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar usuarios por nombre o email"
            placeholder="Buscar por nombre o email…"
            className="w-full rounded-xl border border-[#1E2128] bg-[#101216] pl-9 pr-4 py-2 text-sm text-[#F2F3F5] placeholder:text-[#5B6472] outline-none focus-visible:border-[#3B82F6] focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30"
          />
        </div>
        <Select label="Segmento" value={segment} onChange={setSegment} options={[['', 'Segmento: todos'], ['active', 'Han operado'], ['lead', 'Leads']]} />
        <Select label="Estado" value={status} onChange={setStatus} options={[['', 'Estado: todos'], ['active', 'Activos'], ['suspended', 'Suspendidos']]} />
        <Select label="KYC" value={kyc} onChange={setKyc} options={[['', 'KYC: todos'], ['verified', 'Verificados'], ['pending', 'Pendientes'], ['none', 'Sin verificar']]} />
      </div>

      <div className="bg-[#101216] border border-[#1E2128] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] uppercase tracking-wide text-[#5B6472] border-b border-[#1E2128]">
          <span>Usuario</span>
          <span>Estado</span>
          <span>KYC</span>
          <span className="text-right">Equity</span>
          <span className="text-right">Última act.</span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 items-center border-b border-[#1A1D23] last:border-0">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-2.5 w-40" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-3 w-14 ml-auto" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          ))
        ) : total === 0 ? (
          <EmptyState
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            title="Sin resultados"
            hint="Prueba con otro término de búsqueda o quita los filtros activos."
          />
        ) : (
          pageItems.map((u) => {
            const equity = u.virtualBalance + u.invested;
            return (
              <Link
                key={u.id}
                to={`/admin/users/${u.id}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 items-center border-b border-[#1A1D23] last:border-0 hover:bg-white/[0.03] transition-colors outline-none focus-visible:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#3B82F6]/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={u.name} size={34} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#F2F3F5] truncate">{u.name}</div>
                    <div className="text-xs text-[#8B92A0] truncate">{u.email}</div>
                  </div>
                </div>
                <StatusBadge status={u.status} />
                <KycBadge kyc={u.kycStatus} />
                <span className="text-sm text-[#F2F3F5] text-right tabular-nums">{fmtMoney(equity)}</span>
                <span className="text-xs text-[#8B92A0] text-right">{timeAgo(u.lastActiveAt)}</span>
              </Link>
            );
          })
        )}

        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#1E2128] text-xs text-[#8B92A0]">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex items-center gap-1">
              <PageBtn disabled={page === 1} onClick={() => setPage((p) => p - 1)} label="Página anterior">
                ‹
              </PageBtn>
              <span className="px-2 tabular-nums">
                {page} / {pageCount}
              </span>
              <PageBtn disabled={page === pageCount} onClick={() => setPage((p) => p + 1)} label="Página siguiente">
                ›
              </PageBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-xl border border-[#1E2128] bg-[#101216] px-3 py-2 text-sm text-[#B8BFCC] outline-none focus-visible:border-[#3B82F6] focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30"
    >
      {options.map(([val, l]) => (
        <option key={val} value={val} className="bg-[#101216]">
          {l}
        </option>
      ))}
    </select>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-7 h-7 rounded-lg border border-[#262A33] text-[#B8BFCC] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 text-base leading-none"
    >
      {children}
    </button>
  );
}
