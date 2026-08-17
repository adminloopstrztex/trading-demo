import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { CrmUser, PagedUsers } from './types';
import { Avatar, KycBadge, Skeleton, EmptyState } from './ui';
import { timeAgo } from './format';

export default function AdminLeads() {
  const [leads, setLeads] = useState<CrmUser[] | null>(null);
  const [pending, setPending] = useState<CrmUser[] | null>(null);

  useEffect(() => {
    api<PagedUsers>('/admin/users?segment=lead&pageSize=100')
      .then((d) => setLeads(d.items))
      .catch(() => setLeads([]));
    api<PagedUsers>('/admin/users?kyc=pending&pageSize=100')
      .then((d) => setPending(d.items))
      .catch(() => setPending([]));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#F2F3F5]">Leads y verificación</h1>
        <p className="text-sm text-[#8B92A0]">Prospectos por convertir y cola de KYC</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <ListCard
          title="Leads — registrados sin operar"
          users={leads}
          emptyTitle="Sin leads pendientes"
          emptyHint="Cuando alguien se registre y aún no opere, aparecerá aquí para darle seguimiento."
          meta={(u) => `Registrado ${timeAgo(u.createdAt)}`}
        />
        <ListCard
          title="Pendientes de verificación (KYC)"
          users={pending}
          emptyTitle="Nada en la cola de KYC"
          emptyHint="Las verificaciones pendientes de revisión aparecerán aquí."
          meta={(u) => `Última actividad ${timeAgo(u.lastActiveAt)}`}
          showKyc
        />
      </div>
    </div>
  );
}

function ListCard({
  title,
  users,
  emptyTitle,
  emptyHint,
  meta,
  showKyc,
}: {
  title: string;
  users: CrmUser[] | null;
  emptyTitle: string;
  emptyHint: string;
  meta: (u: CrmUser) => string;
  showKyc?: boolean;
}) {
  return (
    <div className="bg-[#101216] border border-[#1E2128] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E2128]">
        <h2 className="text-sm font-semibold text-[#F2F3F5]">{title}</h2>
        {users && (
          <span className="text-xs text-[#8B92A0] bg-[#1E2128] rounded-md px-2 py-0.5 tabular-nums">
            {users.length}
          </span>
        )}
      </div>

      {!users ? (
        <div className="p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        users.map((u) => (
          <Link
            key={u.id}
            to={`/admin/users/${u.id}`}
            className="flex items-center gap-3 px-5 py-3 border-b border-[#1A1D23] last:border-0 hover:bg-white/[0.03] transition-colors outline-none focus-visible:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#3B82F6]/50"
          >
            <Avatar name={u.name} size={34} />
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
