import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Metrics } from './types';

export default function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Metrics>('/admin/metrics')
      .then(setM)
      .catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="text-[#FF5C5C] text-sm">{error}</p>;
  if (!m) return <p className="text-[#8B92A0] text-sm">Cargando métricas…</p>;

  const money = (n: number) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-xl font-semibold text-[#F2F3F5]">Dashboard</h1>
        <p className="text-sm text-[#8B92A0]">Resumen de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Usuarios totales" value={m.totalUsers} />
        <Stat label="Nuevos hoy" value={m.newToday} accent="blue" />
        <Stat label="Nuevos (7 días)" value={m.newThisWeek} accent="blue" />
        <Stat label="Usuarios activos" value={m.activeUsers} accent="green" />
        <Stat label="Leads (sin operar)" value={m.leads} accent="amber" />
        <Stat label="Suspendidos" value={m.suspended} accent="red" />
        <Stat label="Operaciones" value={m.totalTrades} />
        <Stat label="Volumen simulado" value={money(m.totalVolume)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Embudo de conversión">
          <Funnel
            rows={[
              { label: 'Registrados', value: m.totalUsers, color: '#60A5FA' },
              { label: 'Verificados (KYC)', value: m.kycVerified, color: '#16C784' },
              { label: 'Activos (operaron)', value: m.activeUsers, color: '#22D3A6' },
            ]}
            total={m.totalUsers}
          />
        </Panel>

        <Panel title="Verificación KYC">
          <div className="space-y-3">
            <KycRow label="Verificados" value={m.kycVerified} total={m.totalUsers} color="#16C784" />
            <KycRow label="Pendientes" value={m.kycPending} total={m.totalUsers} color="#E8B339" />
            <KycRow
              label="Sin verificar"
              value={m.totalUsers - m.kycVerified - m.kycPending}
              total={m.totalUsers}
              color="#5B6472"
            />
          </div>
          <div className="mt-5 pt-4 border-t border-[#1E2128] flex justify-between text-sm">
            <span className="text-[#8B92A0]">Patrimonio total (equity)</span>
            <span className="text-[#F2F3F5] font-semibold">{money(m.totalEquity)}</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const color =
    accent === 'blue'
      ? 'text-[#60A5FA]'
      : accent === 'green'
        ? 'text-[#16C784]'
        : accent === 'amber'
          ? 'text-[#E8B339]'
          : accent === 'red'
            ? 'text-[#FF5C5C]'
            : 'text-[#F2F3F5]';
  return (
    <div className="bg-[#101216] border border-[#1E2128] rounded-2xl p-4">
      <div className="text-xs text-[#8B92A0] mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#101216] border border-[#1E2128] rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-[#F2F3F5] mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Funnel({
  rows,
  total,
}: {
  rows: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = total > 0 ? (r.value / total) * 100 : 0;
        return (
          <div key={r.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#B8BFCC]">{r.label}</span>
              <span className="text-[#8B92A0]">
                {r.value} · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-[#1A1D23] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KycRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      <span className="text-sm text-[#B8BFCC] flex-1">{label}</span>
      <span className="text-sm text-[#8B92A0]">{value}</span>
      <span className="text-xs text-[#5B6472] w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}
