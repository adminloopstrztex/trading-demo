export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function StatusBadge({ status }: { status: 'active' | 'suspended' }) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-0.5 w-fit ${
        active ? 'text-[#16C784] bg-[#16C784]/12' : 'text-[#FF5C5C] bg-[#FF5C5C]/12'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#16C784]' : 'bg-[#FF5C5C]'}`} />
      {active ? 'Activo' : 'Suspendido'}
    </span>
  );
}

export function KycBadge({ kyc }: { kyc: 'none' | 'pending' | 'verified' }) {
  const map = {
    verified: { label: 'Verificado', color: 'text-[#16C784] bg-[#16C784]/12' },
    pending: { label: 'Pendiente', color: 'text-[#E8B339] bg-[#E8B339]/12' },
    none: { label: 'Sin verificar', color: 'text-[#8B92A0] bg-[#8B92A0]/12' },
  }[kyc];
  return (
    <span className={`inline-flex items-center text-xs font-medium rounded-md px-2 py-0.5 w-fit ${map.color}`}>
      {map.label}
    </span>
  );
}
