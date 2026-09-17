import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { AuditEntry, PagedAudit } from './types';
import { Avatar, Skeleton, EmptyState } from './ui';
import { timeAgo } from './format';

// Etiqueta y color por tipo de acción.
const ACTIONS: Record<string, { label: string; color: string }> = {
  'user.create': { label: 'Creó cliente', color: '#16C784' },
  'user.update': { label: 'Actualizó cliente', color: '#60A5FA' },
  'user.delete': { label: 'Eliminó cliente', color: '#FF5C5C' },
  'user.password_reset': { label: 'Restableció contraseña', color: '#E8B339' },
  'user.role_change': { label: 'Cambió rol', color: '#A78BFA' },
  'users.import': { label: 'Importó usuarios', color: '#16C784' },
  'staff.create': { label: 'Creó miembro del equipo', color: '#A78BFA' },
  'self.password_change': { label: 'Cambió su contraseña', color: '#E8B339' },
  'self.email_change': { label: 'Cambió su correo', color: '#E8B339' },
};

const FILTERS: [string, string][] = [
  ['', 'Todas las acciones'],
  ['user.create', 'Creación de clientes'],
  ['user.update', 'Cambios de estado/KYC'],
  ['user.delete', 'Eliminaciones'],
  ['user.password_reset', 'Restablecer contraseñas'],
  ['user.role_change', 'Cambios de rol'],
  ['users.import', 'Importaciones'],
  ['staff.create', 'Alta de equipo'],
];

const PAGE_SIZE = 25;

function fullDate(ts: number) {
  return new Date(ts).toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminAudit() {
  const [data, setData] = useState<PagedAudit | null>(null);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [action]);

  useEffect(() => {
    setData(null);
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (action) p.set('action', action);
    api<PagedAudit>(`/admin/audit?${p.toString()}`)
      .then(setData)
      .catch(() => setData({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE }));
  }, [action, page]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = data === null;
  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#F2F3F5]">Registro de actividad</h1>
          <p className="text-sm text-[#8B92A0]">
            {loading ? 'Cargando…' : `${total} evento${total === 1 ? ' registrado' : 's registrados'}`}
          </p>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filtrar por acción"
          className="rounded-xl border border-[#1E2128] bg-[#101216] px-3 py-2 text-sm text-[#B8BFCC] outline-none focus-visible:border-[#3B82F6]"
        >
          {FILTERS.map(([v, l]) => (
            <option key={v} value={v} className="bg-[#101216]">
              {l}
            </option>
          ))}
        </select>
      </header>

      <div className="bg-[#101216] border border-[#1E2128] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[#1A1D23]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-3.5 w-64" />
                <Skeleton className="h-3 w-24 ml-auto" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <EmptyState
            title="Sin actividad todavía"
            hint="Aquí aparecerán los cambios que el equipo haga en el CRM: estados, KYC, contraseñas, eliminaciones y más."
          />
        ) : (
          <div className="divide-y divide-[#1A1D23]">
            {rows.map((e) => (
              <AuditRow key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between gap-4 text-xs text-[#8B92A0] flex-wrap">
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
  );
}

function AuditRow({ e }: { e: AuditEntry }) {
  const meta = ACTIONS[e.action] ?? { label: e.action, color: '#8B92A0' };
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-white/[0.02]">
      <Avatar name={e.actorName || '—'} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium text-[#F2F3F5]">{e.actorName || 'Sistema'}</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
            style={{ color: meta.color, background: `${meta.color}1a` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </span>
          {e.targetName && <span className="text-[#B8BFCC] truncate">· {e.targetName}</span>}
        </div>
        {e.detail && <p className="mt-0.5 text-xs text-[#8B92A0]">{e.detail}</p>}
      </div>
      <time className="shrink-0 text-xs text-[#5B6472]" title={fullDate(e.at)}>
        {timeAgo(e.at)}
      </time>
    </div>
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
