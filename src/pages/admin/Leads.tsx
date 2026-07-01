import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { CrmUser } from './types';
import { KycBadge, timeAgo } from './ui';

export default function AdminLeads() {
  const [leads, setLeads] = useState<CrmUser[]>([]);
  const [pending, setPending] = useState<CrmUser[]>([]);

  useEffect(() => {
    api<CrmUser[]>('/admin/users?segment=lead').then(setLeads);
    api<CrmUser[]>('/admin/users?kyc=pending').then(setPending);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#F2F3F5]">Leads y verificación</h1>
        <p className="text-sm text-[#8B92A0]">Prospectos por convertir y cola de KYC</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ListCard
          title="Leads — registrados sin operar"
          count={leads.length}
          users={leads}
          emptyText="No hay leads pendientes."
          meta={(u) => `Registrado ${timeAgo(u.createdAt)}`}
        />
        <ListCard
          title="Pendientes de verificación (KYC)"
          count={pending.length}
          users={pending}
          emptyText="No hay verificaciones pendientes."
          meta={(u) => `Última actividad ${timeAgo(u.lastActiveAt)}`}
          showKyc
        />
      </div>
    </div>
  );
}

function ListCard({
  title,
  count,
  users,
  emptyText,
  meta,
  showKyc,
}: {
  title: string;
  count: number;
  users: CrmUser[];
  emptyText: string;
  meta: (u: CrmUser) => string;
  showKyc?: boolean;
}) {
  return (
    <div className="bg-[#101216] border border-[#1E2128] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E2128]">
        <h2 className="text-sm font-semibold text-[#F2F3F5]">{title}</h2>
        <span className="text-xs text-[#8B92A0] bg-[#1E2128] rounded-md px-2 py-0.5">{count}</span>
      </div>
      {users.length === 0 ? (
        <p className="text-sm text-[#5B6472] px-5 py-6 text-center">{emptyText}</p>
      ) : (
        users.map((u) => (
          <Link
            key={u.id}
            to={`/admin/users/${u.id}`}
            className="flex items-center gap-3 px-5 py-3 border-b border-[#1A1D23] last:border-0 hover:bg-white/[0.03]"
          >
            <div className="w-8 h-8 rounded-full bg-[#1E2128] flex items-center justify-center text-xs font-semibold text-[#B8BFCC]">
              {u.name.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#F2F3F5] truncate">{u.name}</div>
              <div className="text-xs text-[#8B92A0] truncate">{meta(u)}</div>
            </div>
            {showKyc && <KycBadge kyc={u.kycStatus} />}
          </Link>
        ))
      )}
    </div>
  );
}
