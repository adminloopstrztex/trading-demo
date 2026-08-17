import type { ReactNode } from 'react';

const AVATAR_COLORS = [
  ['#16C784', 'rgba(22,199,132,0.14)'],
  ['#60A5FA', 'rgba(59,130,246,0.16)'],
  ['#E8B339', 'rgba(232,179,57,0.14)'],
  ['#C084FC', 'rgba(192,132,252,0.16)'],
  ['#F472B6', 'rgba(244,114,182,0.14)'],
  ['#22D3EE', 'rgba(34,211,238,0.14)'],
];

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [fg, bg] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.4 }}
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
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

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[#101216] border border-[#1E2128] rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-semibold text-[#F2F3F5]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#1A1D23] ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      {icon && (
        <div className="w-11 h-11 rounded-xl bg-[#16181C] border border-[#262A33] flex items-center justify-center text-[#5B6472] mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-[#D5DAE2]">{title}</p>
      {hint && <p className="text-xs text-[#8B92A0] mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
