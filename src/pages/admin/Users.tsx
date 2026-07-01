import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { CrmUser } from './types';
import { KycBadge, StatusBadge, timeAgo } from './ui';

export default function AdminUsers() {
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [kyc, setKyc] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (kyc) params.set('kyc', kyc);
    setLoading(true);
    const t = setTimeout(() => {
      api<CrmUser[]>(`/admin/users?${params.toString()}`)
        .then(setUsers)
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, status, kyc]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#F2F3F5]">Usuarios</h1>
        <p className="text-sm text-[#8B92A0]">{users.length} resultados</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="flex-1 min-w-[220px] rounded-xl border border-[#1E2128] bg-[#101216] px-4 py-2 text-sm text-[#F2F3F5] focus:outline-none focus:border-[#3B82F6] placeholder:text-[#5B6472]"
        />
        <Select value={status} onChange={setStatus} options={[['', 'Estado: todos'], ['active', 'Activos'], ['suspended', 'Suspendidos']]} />
        <Select value={kyc} onChange={setKyc} options={[['', 'KYC: todos'], ['verified', 'Verificados'], ['pending', 'Pendientes'], ['none', 'Sin verificar']]} />
      </div>

      <div className="bg-[#101216] border border-[#1E2128] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3 text-[11px] uppercase text-[#5B6472] border-b border-[#1E2128]">
          <span>Usuario</span>
          <span>Estado</span>
          <span>KYC</span>
          <span className="text-right">Equity</span>
          <span className="text-right">Última act.</span>
        </div>
        {loading ? (
          <p className="text-sm text-[#8B92A0] px-5 py-6 text-center">Cargando…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-[#8B92A0] px-5 py-6 text-center">Sin resultados.</p>
        ) : (
          users.map((u) => {
            const equity = u.virtualBalance + u.invested;
            return (
              <Link
                key={u.id}
                to={`/admin/users/${u.id}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-3.5 items-center border-b border-[#1A1D23] last:border-0 hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#1E2128] flex items-center justify-center text-xs font-semibold text-[#B8BFCC] shrink-0">
                    {u.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#F2F3F5] truncate">{u.name}</div>
                    <div className="text-xs text-[#8B92A0] truncate">{u.email}</div>
                  </div>
                </div>
                <StatusBadge status={u.status} />
                <KycBadge kyc={u.kycStatus} />
                <span className="text-sm text-[#F2F3F5] text-right">
                  ${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-xs text-[#8B92A0] text-right">{timeAgo(u.lastActiveAt)}</span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-[#1E2128] bg-[#101216] px-3 py-2 text-sm text-[#B8BFCC] focus:outline-none focus:border-[#3B82F6]"
    >
      {options.map(([val, label]) => (
        <option key={val} value={val} className="bg-[#101216]">
          {label}
        </option>
      ))}
    </select>
  );
}
