import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAccountStore } from '../../store/accountStore';
import type { CrmUser, PagedUsers } from './types';
import { Avatar, KycBadge, StatusBadge, Skeleton, EmptyState } from './ui';
import { fmtMoney, timeAgo } from './format';
import { GOAL_ORDER, GOAL_LABELS, EXPERIENCE_LEVELS } from './survey';
import { parseCsv, mapRows, CSV_TEMPLATE, type ImportRow } from './importCsv';
import { toast } from '../../store/toastStore';

interface ImportResult {
  received: number;
  inserted: number;
  skipped: number;
  invalid: number;
}

const IMPORT_BATCH = 200;

function downloadTemplate() {
  const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla-usuarios.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type ColKey = 'phone' | 'email' | 'status' | 'kyc' | 'equity' | 'invested' | 'trades' | 'created' | 'lastActive';

interface Column {
  key: ColKey;
  label: string;
  width: string;
  align?: 'right';
  render: (u: CrmUser) => React.ReactNode;
}

const COLUMNS: Column[] = [
  {
    key: 'email',
    label: 'Correo',
    width: 'minmax(160px,1.4fr)',
    render: (u) => (
      <a
        href={`mailto:${u.email}`}
        className="block truncate text-[#B8BFCC] hover:text-[#60A5FA]"
        title={u.email}
        onClick={(e) => e.stopPropagation()}
      >
        {u.email}
      </a>
    ),
  },
  {
    key: 'phone',
    label: 'Teléfono',
    width: '150px',
    render: (u) =>
      u.phone ? (
        <span className="tabular-nums text-[#B8BFCC] whitespace-nowrap" title={u.phone}>
          {u.phone}
        </span>
      ) : (
        <span className="text-[#5B6472]">—</span>
      ),
  },
  { key: 'status', label: 'Estado', width: '118px', render: (u) => <StatusBadge status={u.status} /> },
  { key: 'kyc', label: 'KYC', width: '128px', render: (u) => <KycBadge kyc={u.kycStatus} /> },
  {
    key: 'equity',
    label: 'Equity',
    width: '116px',
    align: 'right',
    render: (u) => <span className="tabular-nums text-[#F2F3F5]">{fmtMoney(u.virtualBalance + u.invested)}</span>,
  },
  {
    key: 'invested',
    label: 'Invertido',
    width: '116px',
    align: 'right',
    render: (u) => <span className="tabular-nums text-[#B8BFCC]">{fmtMoney(u.invested)}</span>,
  },
  {
    key: 'trades',
    label: 'Operaciones',
    width: '108px',
    align: 'right',
    render: (u) => <span className="tabular-nums text-[#B8BFCC]">{u.tradesCount}</span>,
  },
  {
    key: 'created',
    label: 'Registrado',
    width: '128px',
    align: 'right',
    render: (u) => <span className="text-[#8B92A0]">{timeAgo(u.createdAt)}</span>,
  },
  {
    key: 'lastActive',
    label: 'Última act.',
    width: '116px',
    align: 'right',
    render: (u) => <span className="text-[#8B92A0]">{timeAgo(u.lastActiveAt)}</span>,
  },
];

const DEFAULT_VISIBLE: ColKey[] = ['email', 'phone', 'status', 'kyc', 'equity', 'trades', 'lastActive'];
const PAGE_SIZES = [10, 25, 50];

function csvCell(v: unknown) {
  return `"${String(v).replace(/"/g, '""')}"`;
}
function downloadCsv(rows: CrmUser[]) {
  const head = [
    'ID', 'Nombre', 'Email', 'Teléfono', 'Estado', 'KYC',
    'Equity', 'Invertido', 'Operaciones',
    'Experiencia (1-10)', 'Tecnología (1-10)', 'Objetivo',
    'Registrado', 'Última actividad',
  ];
  const lines = [head.map(csvCell).join(',')];
  for (const u of rows) {
    const goal = u.survey?.goal ? (GOAL_LABELS[u.survey.goal] ?? u.survey.goal) : '';
    lines.push(
      [
        u.id,
        u.name,
        u.email,
        u.phone ?? '',
        u.status,
        u.kycStatus,
        (u.virtualBalance + u.invested).toFixed(2),
        u.invested.toFixed(2),
        u.tradesCount,
        u.survey?.tradingExperience ?? '',
        u.survey?.techComfort ?? '',
        goal,
        new Date(u.createdAt).toISOString(),
        new Date(u.lastActiveAt).toISOString(),
      ]
        .map(csvCell)
        .join(',')
    );
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsers() {
  const [data, setData] = useState<PagedUsers | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kyc, setKyc] = useState('');
  const [segment, setSegment] = useState('');
  const [experience, setExperience] = useState('');
  const [goal, setGoal] = useState('');
  const [tag, setTag] = useState('');
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [visible, setVisible] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dense, setDense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canModerate = useAccountStore((s) => s.user?.permissions ?? []).includes('users.moderate');
  const canReset = useAccountStore((s) => s.user?.permissions ?? []).includes('users.reset');
  const canManageRoles = useAccountStore((s) => s.user?.permissions ?? []).includes('roles.manage');
  const [purging, setPurging] = useState(false);
  const [purgingAll, setPurgingAll] = useState(false);

  async function handlePurgeAll() {
    const answer = window.prompt(
      'ATENCIÓN: esto eliminará TODOS los usuarios (clientes y staff), dejando solo tu cuenta admin. ' +
        'No se puede deshacer.\n\nEscribe ELIMINAR TODO para confirmar:'
    );
    if (answer !== 'ELIMINAR TODO') return;
    setPurgingAll(true);
    try {
      const res = await api<{ deleted: number }>('/admin/users/purge-all', { method: 'POST' });
      toast.success('Entorno vaciado', `${res.deleted} usuario(s) eliminados. Solo queda tu cuenta admin.`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error('No se pudo vaciar', (e as Error).message);
    } finally {
      setPurgingAll(false);
    }
  }

  async function handlePurgeDemo() {
    if (
      !window.confirm(
        '¿Eliminar los usuarios demo de prueba (correos @example.com)?\n\n' +
          'No se puede deshacer. No afecta al admin, al staff ni a usuarios reales registrados.'
      )
    )
      return;
    setPurging(true);
    try {
      const res = await api<{ deleted: number }>('/admin/users/purge-demo', { method: 'POST' });
      if (res.deleted > 0) toast.success('Usuarios demo eliminados', `${res.deleted} cuenta(s) de prueba borradas.`);
      else toast.info('Nada que limpiar', 'No quedan usuarios demo (@example.com).');
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error('No se pudo limpiar', (e as Error).message);
    } finally {
      setPurging(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const rows = mapRows(parseCsv(text)).filter((r: ImportRow) => r.name.trim() && r.email.trim());
      if (rows.length === 0) {
        toast.error('Nada que importar', 'No se encontraron filas con nombre y email válidos.');
        return;
      }
      const totals = { received: 0, inserted: 0, skipped: 0, invalid: 0 };
      for (let i = 0; i < rows.length; i += IMPORT_BATCH) {
        const batch = rows.slice(i, i + IMPORT_BATCH);
        const res = await api<ImportResult>('/admin/users/import', { method: 'POST', body: { users: batch } });
        totals.received += res.received;
        totals.inserted += res.inserted;
        totals.skipped += res.skipped;
        totals.invalid += res.invalid;
      }
      const detail = `${totals.inserted} creados` +
        (totals.skipped ? ` · ${totals.skipped} ya existían` : '') +
        (totals.invalid ? ` · ${totals.invalid} inválidos` : '');
      if (totals.inserted > 0) toast.success('Importación completa', detail + '. Contraseña por defecto: demo1234');
      else toast.info('Sin nuevos usuarios', detail || 'Todos ya existían.');
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error('Error al importar', (e as Error).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  useEffect(() => setPage(1), [q, status, kyc, segment, experience, goal, tag, pageSize]);

  // Etiquetas disponibles para el filtro superior (se recargan al cambiar datos).
  useEffect(() => {
    api<{ tag: string; count: number }[]>('/admin/tags')
      .then(setTags)
      .catch(() => setTags([]));
  }, [reloadKey]);

  // Si la etiqueta seleccionada deja de existir (p. ej. tras vaciar), se limpia.
  useEffect(() => {
    if (tag && !tags.some((t) => t.tag === tag)) setTag('');
  }, [tags, tag]);

  function buildParams(extra?: Record<string, string>) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    if (kyc) p.set('kyc', kyc);
    if (segment) p.set('segment', segment);
    if (experience) p.set('experience', experience);
    if (goal) p.set('goal', goal);
    if (tag) p.set('tag', tag);
    for (const k in extra) p.set(k, extra[k]);
    return p;
  }

  useEffect(() => {
    const p = buildParams({ page: String(page), pageSize: String(pageSize) });
    setData(null);
    const t = setTimeout(() => {
      api<PagedUsers>(`/admin/users?${p.toString()}`)
        .then(setData)
        .catch(() => setData({ items: [], total: 0, page: 1, pageSize }));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, kyc, segment, experience, goal, tag, page, pageSize, reloadKey]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const rows = data?.items ?? [];
  const loading = data === null;
  const cols = COLUMNS.filter((c) => visible.has(c.key));
  const gridCols = `36px minmax(200px,2fr) ${cols.map((c) => c.width).join(' ')}`;

  const pageIds = rows.map((r) => r.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fetchAllFiltered(): Promise<CrmUser[]> {
    const out: CrmUser[] = [];
    let pg = 1;
    for (;;) {
      const p = buildParams({ page: String(pg), pageSize: '100' });
      const res = await api<PagedUsers>(`/admin/users?${p.toString()}`);
      out.push(...res.items);
      if (out.length >= res.total || res.items.length === 0) break;
      pg++;
    }
    return out;
  }

  async function exportAll() {
    setBusy(true);
    try {
      downloadCsv(await fetchAllFiltered());
    } finally {
      setBusy(false);
    }
  }
  async function exportSelection() {
    setBusy(true);
    try {
      const all = await fetchAllFiltered();
      downloadCsv(all.filter((u) => selected.has(u.id)));
    } finally {
      setBusy(false);
    }
  }
  async function bulkStatus(newStatus: 'active' | 'suspended') {
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => api(`/admin/users/${id}`, { method: 'PATCH', body: { status: newStatus } })));
      setSelected(new Set());
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#F2F3F5]">Usuarios</h1>
          <p className="text-sm text-[#8B92A0]">{loading ? 'Cargando…' : `${total} resultados`}</p>
        </div>
        <div className="flex items-center gap-2">
          {canModerate && (
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs font-semibold rounded-lg bg-[#3B82F6] hover:bg-[#2f6fd6] text-white px-3 py-1.5"
            >
              + Añadir usuario
            </button>
          )}
          {canReset && (
            <button
              onClick={handlePurgeDemo}
              disabled={purging}
              title="Elimina los usuarios de prueba con correo @example.com"
              className="text-xs font-medium rounded-lg border border-[#FF5C5C]/40 text-[#FF5C5C] hover:bg-[#FF5C5C]/10 px-3 py-1.5 disabled:opacity-40"
            >
              {purging ? 'Limpiando…' : 'Limpiar usuarios demo'}
            </button>
          )}
          {canManageRoles && (
            <button
              onClick={handlePurgeAll}
              disabled={purgingAll}
              title="Elimina TODOS los usuarios excepto tu cuenta admin"
              className="text-xs font-semibold rounded-lg border border-[#FF5C5C] bg-[#FF5C5C]/10 text-[#FF5C5C] hover:bg-[#FF5C5C]/20 px-3 py-1.5 disabled:opacity-40"
            >
              {purgingAll ? 'Vaciando…' : 'Vaciar todos'}
            </button>
          )}
          <button
            onClick={() => setDense((d) => !d)}
            aria-pressed={dense}
            className={`text-xs font-medium rounded-lg border px-3 py-1.5 transition-colors ${
              dense ? 'bg-[#1E2128] border-[#262A33] text-[#F2F3F5]' : 'border-[#262A33] text-[#8B92A0] hover:text-[#F2F3F5]'
            }`}
          >
            Vista sencilla
          </button>
          <ColumnMenu visible={visible} setVisible={setVisible} />
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="text-xs font-medium rounded-lg border border-[#16C784]/40 text-[#16C784] hover:bg-[#16C784]/10 px-3 py-1.5 disabled:opacity-40"
          >
            {importing ? 'Importando…' : 'Importar CSV'}
          </button>
          <button
            onClick={downloadTemplate}
            className="text-xs font-medium text-[#5B6472] hover:text-[#8B92A0] px-1"
            title="Descargar plantilla CSV"
          >
            plantilla
          </button>
          <button
            onClick={exportAll}
            disabled={busy || total === 0}
            className="text-xs font-medium rounded-lg border border-[#262A33] text-[#8B92A0] hover:text-[#F2F3F5] px-3 py-1.5 disabled:opacity-40"
          >
            Exportar CSV
          </button>
        </div>
      </header>

      {/* Tag filter row: quick chips to filter users by the tags the team created. */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#5B6472]">Etiquetas:</span>
          <button
            onClick={() => setTag('')}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              tag === ''
                ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#60A5FA]'
                : 'border-[#262A33] text-[#8B92A0] hover:text-[#F2F3F5]'
            }`}
          >
            Todas
          </button>
          {tags.map(({ tag: t, count }) => (
            <button
              key={t}
              onClick={() => setTag((cur) => (cur === t ? '' : t))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                tag === t
                  ? 'border-[#3B82F6] bg-[#3B82F6]/15 text-[#60A5FA]'
                  : 'border-[#262A33] text-[#B8BFCC] hover:text-[#F2F3F5]'
              }`}
            >
              {t}
              <span className="tabular-nums text-[10px] text-[#5B6472]">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Top filters (segment sits above the grid; per-column filters live in the header row) */}
      <div className="flex flex-wrap gap-2">
        <Select label="Segmento" value={segment} onChange={setSegment} options={[['', 'Segmento: todos'], ['active', 'Han operado'], ['lead', 'Leads']]} />
        <Select
          label="Nivel de experiencia"
          value={experience}
          onChange={setExperience}
          options={[['', 'Experiencia: toda'], ...EXPERIENCE_LEVELS.map((l) => [l.key, l.label] as [string, string])]}
        />
        <Select
          label="Objetivo de onboarding"
          value={goal}
          onChange={setGoal}
          options={[['', 'Objetivo: todos'], ...GOAL_ORDER.map((g) => [g, GOAL_LABELS[g]] as [string, string])]}
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-[#12213A] border border-[#274372] rounded-xl px-4 py-2.5 text-sm">
          <span className="text-[#93c0f8] font-medium">{selected.size} seleccionados</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <BulkBtn onClick={() => bulkStatus('active')} disabled={busy}>
              Activar
            </BulkBtn>
            <BulkBtn onClick={() => bulkStatus('suspended')} disabled={busy}>
              Suspender
            </BulkBtn>
            <BulkBtn onClick={exportSelection} disabled={busy}>
              Exportar
            </BulkBtn>
            <button onClick={() => setSelected(new Set())} className="text-xs text-[#8B92A0] hover:text-[#F2F3F5] px-2">
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#101216] border border-[#1E2128] rounded-2xl overflow-x-auto">
        <div className="min-w-[960px]">
          {/* header */}
          <div
            className="grid gap-3 px-4 py-2.5 text-[11px] uppercase tracking-wide text-[#5B6472] border-b border-[#1E2128] items-center"
            style={{ gridTemplateColumns: gridCols }}
          >
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleAllOnPage}
              aria-label="Seleccionar todos en esta página"
              className="w-4 h-4 accent-[#3B82F6]"
            />
            <span>Usuario</span>
            {cols.map((c) => (
              <span key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                {c.label}
              </span>
            ))}
          </div>

          {/* inline per-column filter row */}
          <div
            className="grid gap-3 px-4 py-2 border-b border-[#1A1D23] items-center"
            style={{ gridTemplateColumns: gridCols }}
          >
            <span />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar nombre, email o teléfono…"
              aria-label="Filtrar por nombre, email o teléfono"
              className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-2.5 py-1.5 text-xs text-[#F2F3F5] placeholder:text-[#5B6472] outline-none focus-visible:border-[#3B82F6]"
            />
            {cols.map((c) => (
              <div key={c.key} className={c.align === 'right' ? 'flex justify-end' : ''}>
                {c.key === 'status' ? (
                  <FilterSelect value={status} onChange={setStatus} options={[['', 'Todos'], ['active', 'Activos'], ['suspended', 'Suspend.']]} label="Filtrar estado" />
                ) : c.key === 'kyc' ? (
                  <FilterSelect value={kyc} onChange={setKyc} options={[['', 'Todos'], ['verified', 'Verif.'], ['pending', 'Pend.'], ['none', 'Sin verif.']]} label="Filtrar KYC" />
                ) : null}
              </div>
            ))}
          </div>

          {/* rows */}
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid gap-3 px-4 items-center border-b border-[#1A1D23] last:border-0" style={{ gridTemplateColumns: gridCols, paddingBlock: dense ? 8 : 14 }}>
                <Skeleton className="w-4 h-4 rounded" />
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
                {cols.map((c) => (
                  <Skeleton key={c.key} className="h-3.5 w-16" />
                ))}
              </div>
            ))
          ) : total === 0 ? (
            <EmptyState
              title="Sin resultados"
              hint="Prueba con otro término de búsqueda o quita los filtros activos."
            />
          ) : (
            rows.map((u) => {
              const isSel = selected.has(u.id);
              return (
                <div
                  key={u.id}
                  className={`grid gap-3 px-4 items-center border-b border-[#1A1D23] last:border-0 transition-colors ${
                    isSel ? 'bg-[#3B82F6]/[0.06]' : 'hover:bg-white/[0.03]'
                  }`}
                  style={{ gridTemplateColumns: gridCols, paddingBlock: dense ? 8 : 14 }}
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleOne(u.id)}
                    aria-label={`Seleccionar ${u.name}`}
                    className="w-4 h-4 accent-[#3B82F6]"
                  />
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.name} size={dense ? 26 : 34} />
                    <div className="min-w-0">
                      <Link
                        to={`/admin/users/${u.id}`}
                        className="text-sm font-medium text-[#F2F3F5] truncate block hover:text-[#60A5FA] outline-none focus-visible:text-[#60A5FA]"
                      >
                        {u.name}
                      </Link>
                      {!dense && !visible.has('email') && (
                        <div className="text-xs text-[#8B92A0] truncate">{u.email}</div>
                      )}
                    </div>
                  </div>
                  {cols.map((c) => (
                    <div key={c.key} className={`text-sm ${c.align === 'right' ? 'text-right' : ''}`}>
                      {c.render(u)}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* footer: page size + pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between gap-4 text-xs text-[#8B92A0] flex-wrap">
          <div className="flex items-center gap-2">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Filas por página"
              className="rounded-lg border border-[#1E2128] bg-[#101216] px-2 py-1 text-[#B8BFCC] outline-none focus-visible:border-[#3B82F6]"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s} className="bg-[#101216]">
                  {s}
                </option>
              ))}
            </select>
            <span>
              · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
            </span>
          </div>
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

      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || !email.trim()) {
      toast.error('Faltan datos', 'Ingresa nombre y email válidos.');
      return;
    }
    setBusy(true);
    try {
      await api('/admin/users', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password: password || undefined },
      });
      toast.success('Usuario creado', `${name.trim()} fue añadido${password ? '' : ' (contraseña: demo1234)'}.`);
      onCreated();
    } catch (err) {
      toast.error('No se pudo crear', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[#262A33] bg-[#101216] p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-[#F2F3F5]">Añadir usuario</h2>
        <div>
          <label className="block text-xs text-[#8B92A0] mb-1">Nombre completo</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#8B92A0] mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#8B92A0] mb-1">Contraseña (opcional)</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Por defecto: demo1234"
            className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] placeholder:text-[#5B6472] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-xs font-medium text-[#8B92A0] hover:text-[#F2F3F5] px-3 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-xs font-semibold rounded-lg bg-[#3B82F6] hover:bg-[#2f6fd6] text-white px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ColumnMenu({ visible, setVisible }: { visible: Set<ColKey>; setVisible: (s: Set<ColKey>) => void }) {
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer text-xs font-medium rounded-lg border border-[#262A33] text-[#8B92A0] hover:text-[#F2F3F5] px-3 py-1.5 [&::-webkit-details-marker]:hidden">
        Columnas
      </summary>
      <div className="absolute right-0 mt-1 z-20 bg-[#16181C] border border-[#262A33] rounded-xl p-1.5 w-48 shadow-lg">
        {COLUMNS.map((c) => (
          <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-sm text-[#B8BFCC] cursor-pointer">
            <input
              type="checkbox"
              checked={visible.has(c.key)}
              onChange={() => {
                const next = new Set(visible);
                if (next.has(c.key)) next.delete(c.key);
                else next.add(c.key);
                setVisible(next);
              }}
              className="w-4 h-4 accent-[#3B82F6]"
            />
            {c.label}
          </label>
        ))}
      </div>
    </details>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-2 py-1.5 text-xs text-[#B8BFCC] outline-none focus-visible:border-[#3B82F6]"
    >
      {options.map(([val, l]) => (
        <option key={val} value={val} className="bg-[#101216]">
          {l}
        </option>
      ))}
    </select>
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

function BulkBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-medium rounded-lg border border-[#274372] bg-[#0A0B0D]/40 text-[#B8BFCC] hover:text-[#F2F3F5] hover:border-[#3B82F6] px-2.5 py-1 disabled:opacity-40"
    >
      {children}
    </button>
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
