import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api';
import type { CrmUserDetail, CrmUser, Note } from './types';
import { KycBadge, StatusBadge, timeAgo } from './ui';

export default function AdminUserDetail() {
  const { id = '' } = useParams();
  const [u, setU] = useState<CrmUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);

  function reload() {
    api<CrmUserDetail>(`/admin/users/${id}`)
      .then(setU)
      .catch((e) => setError((e as Error).message));
  }
  useEffect(reload, [id]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api<CrmUser>(`/admin/users/${id}`, { method: 'PATCH', body });
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    const note = await api<Note>(`/admin/users/${id}/notes`, {
      method: 'POST',
      body: { text: noteText.trim() },
    });
    setNoteText('');
    setU((prev) => (prev ? { ...prev, notes: [note, ...prev.notes] } : prev));
  }

  if (error) return <p className="text-[#FF5C5C] text-sm">{error}</p>;
  if (!u) return <p className="text-[#8B92A0] text-sm">Cargando…</p>;

  const equity = u.virtualBalance + u.invested;
  const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <Link to="/admin/users" className="text-sm text-[#8B92A0] hover:text-[#F2F3F5]">
        ← Volver a usuarios
      </Link>

      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-[#1E2128] flex items-center justify-center text-lg font-semibold text-[#B8BFCC]">
          {u.name.slice(0, 1)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#F2F3F5]">{u.name}</h1>
            <StatusBadge status={u.status} />
            <KycBadge kyc={u.kycStatus} />
          </div>
          <p className="text-sm text-[#8B92A0]">{u.email}</p>
          <p className="text-xs text-[#5B6472] mt-0.5">
            Registrado {timeAgo(u.createdAt)} · Última actividad {timeAgo(u.lastActiveAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Equity" value={money(equity)} />
        <Stat label="Efectivo" value={money(u.virtualBalance)} />
        <Stat label="Invertido" value={money(u.invested)} />
        <Stat label="Operaciones" value={String(u.tradesCount)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          <Card title="Portafolio">
            {u.holdings.length === 0 ? (
              <Empty>Sin posiciones abiertas.</Empty>
            ) : (
              <Table
                head={['Activo', 'Cantidad', 'Precio prom.', 'Valor']}
                rows={u.holdings.map((h) => [
                  h.symbol,
                  h.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 }),
                  money(h.avgPrice),
                  money(h.avgPrice * h.quantity),
                ])}
              />
            )}
          </Card>

          <Card title="Historial de órdenes">
            {u.transactions.length === 0 ? (
              <Empty>Sin operaciones.</Empty>
            ) : (
              <Table
                head={['Fecha', 'Activo', 'Tipo', 'Cantidad', 'Precio']}
                rows={u.transactions.map((t) => [
                  new Date(t.timestamp).toLocaleDateString(),
                  t.symbol,
                  t.side === 'buy' ? 'Compra' : 'Venta',
                  t.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 }),
                  money(t.price),
                ])}
              />
            )}
          </Card>

          <Card title="Notas internas">
            <div className="flex gap-2 mb-3">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
                placeholder="Añadir nota…"
                className="flex-1 rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] focus:outline-none focus:border-[#3B82F6]"
              />
              <button
                onClick={addNote}
                className="rounded-lg bg-[#3B82F6] hover:bg-[#2f6fd6] text-white text-sm font-medium px-4"
              >
                Añadir
              </button>
            </div>
            {u.notes.length === 0 ? (
              <Empty>Sin notas todavía.</Empty>
            ) : (
              <div className="space-y-2">
                {u.notes.map((n) => (
                  <div key={n.id} className="bg-[#0A0B0D] border border-[#1E2128] rounded-lg px-3 py-2">
                    <p className="text-sm text-[#D5DAE2]">{n.text}</p>
                    <p className="text-[11px] text-[#5B6472] mt-1">
                      {n.by} · {timeAgo(n.at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Acciones de administrador">
            <div className="space-y-4 text-sm">
              <Control label="Estado de la cuenta">
                <ActionBtn active={u.status === 'active'} disabled={busy} onClick={() => patch({ status: 'active' })}>
                  Activa
                </ActionBtn>
                <ActionBtn danger active={u.status === 'suspended'} disabled={busy} onClick={() => patch({ status: 'suspended' })}>
                  Suspender
                </ActionBtn>
              </Control>

              <Control label="Verificación KYC">
                <ActionBtn active={u.kycStatus === 'verified'} disabled={busy} onClick={() => patch({ kycStatus: 'verified' })}>
                  Verificar
                </ActionBtn>
                <ActionBtn active={u.kycStatus === 'pending'} disabled={busy} onClick={() => patch({ kycStatus: 'pending' })}>
                  Pendiente
                </ActionBtn>
                <ActionBtn active={u.kycStatus === 'none'} disabled={busy} onClick={() => patch({ kycStatus: 'none' })}>
                  Ninguno
                </ActionBtn>
              </Control>

              <Control label="Saldo demo">
                <ActionBtn
                  disabled={busy}
                  onClick={() => {
                    if (confirm('¿Resetear el saldo virtual de este usuario a $10,000 y borrar sus posiciones?'))
                      patch({ resetBalance: true });
                  }}
                >
                  Resetear a $10,000
                </ActionBtn>
              </Control>
            </div>
          </Card>

          <Card title="Etiquetas">
            {u.tags.length === 0 ? (
              <Empty>Sin etiquetas.</Empty>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {u.tags.map((t) => (
                  <span key={t} className="text-xs text-[#B8BFCC] bg-[#1E2128] rounded-md px-2 py-1">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#101216] border border-[#1E2128] rounded-2xl p-4">
      <div className="text-xs text-[#8B92A0] mb-1">{label}</div>
      <div className="text-lg font-semibold text-[#F2F3F5]">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#101216] border border-[#1E2128] rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-[#F2F3F5] mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[#5B6472]">{children}</p>;
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase text-[#5B6472] text-left">
            {head.map((h, i) => (
              <th key={h} className={`pb-2 font-normal ${i >= 2 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[#1A1D23]">
              {r.map((c, j) => (
                <td key={j} className={`py-2 text-[#D5DAE2] ${j >= 2 ? 'text-right' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-[#8B92A0] mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  active,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const base = active
    ? danger
      ? 'bg-[#FF5C5C] text-[#0A0B0D] border-[#FF5C5C]'
      : 'bg-[#3B82F6] text-white border-[#3B82F6]'
    : 'bg-transparent text-[#B8BFCC] border-[#262A33] hover:bg-white/5';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-medium rounded-lg border px-2.5 py-1.5 disabled:opacity-50 ${base}`}
    >
      {children}
    </button>
  );
}
