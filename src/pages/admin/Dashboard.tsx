import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { Metrics, CrmUser, AssetVolume, PagedUsers } from './types';
import { Card, Skeleton, Avatar, StatusBadge } from './ui';
import { timeAgo, fmtMoney } from './format';
import { Sparkline, GrowthChart, VolumeChart, KycDonut, AssetBars, GoalDonut, ExperienceBars, type SeriesPoint } from './charts';

const RANGES: { key: number; label: string }[] = [
  { key: 7, label: '7D' },
  { key: 30, label: '30D' },
  { key: 90, label: '90D' },
];

export default function AdminDashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [recent, setRecent] = useState<CrmUser[] | null>(null);
  const [topUsers, setTopUsers] = useState<CrmUser[] | null>(null);
  const [assets, setAssets] = useState<AssetVolume[] | null>(null);
  const [series, setSeries] = useState<SeriesPoint[] | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Metrics>('/admin/metrics'),
      api<PagedUsers>('/admin/users?pageSize=6'),
      api<PagedUsers>('/admin/users?sort=equity&pageSize=5'),
      api<AssetVolume[]>('/admin/assets'),
    ])
      .then(([metrics, recentPage, topPage, a]) => {
        setM(metrics);
        setRecent(recentPage.items);
        setTopUsers(topPage.items);
        setAssets(a);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    api<SeriesPoint[]>(`/admin/timeseries?days=${days}`)
      .then(setSeries)
      .catch((e) => setError((e as Error).message));
  }, [days]);

  if (error) return <p className="text-[#FF5C5C] text-sm">{error}</p>;

  const rangeLabel = `últimos ${days} días`;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[#F2F3F5]">Dashboard</h1>
          <p className="text-sm text-[#8B92A0]">Resumen de la plataforma</p>
        </div>
        <RangeToggle value={days} onChange={setDays} />
      </header>

      {/* KPIs with period deltas + trend sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {m && series ? (
          <>
            <Kpi label="Usuarios totales" value={m.totalUsers} sub="vs. mes previo" delta={m.deltas.users}>
              <Sparkline data={series} dataKey="cumulativeUsers" color="#3B82F6" />
            </Kpi>
            <Kpi label="Activos" value={m.activeUsers} sub="vs. mes previo" delta={m.deltas.trades} tone="green">
              <Sparkline data={series} dataKey="trades" color="#16C784" />
            </Kpi>
            <Kpi label="Leads sin operar" value={m.leads} sub={`${m.newToday} nuevos hoy`} tone="amber">
              <Sparkline data={series} dataKey="signups" color="#E8B339" />
            </Kpi>
            <Kpi label="Volumen simulado" value={fmtMoney(m.totalVolume)} sub="vs. mes previo" delta={m.deltas.volume}>
              <Sparkline data={series} dataKey="volume" color="#22D3A6" />
            </Kpi>
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)
        )}
      </div>

      {/* Growth chart + KYC donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 items-stretch">
        <Card title="Crecimiento de usuarios" action={<span className="text-xs text-[#5B6472]">{rangeLabel}</span>}>
          {series ? <GrowthChart data={series} /> : <Skeleton className="h-64 rounded-xl" />}
        </Card>

        <Card title="Verificación KYC">
          {m ? (
            <>
              <KycDonut
                verified={m.kycVerified}
                pending={m.kycPending}
                none={m.totalUsers - m.kycVerified - m.kycPending}
              />
              <div className="mt-4 pt-4 border-t border-[#1E2128] flex justify-between text-sm">
                <span className="text-[#8B92A0]">Patrimonio total</span>
                <span className="text-[#F2F3F5] font-semibold">{fmtMoney(m.totalEquity)}</span>
              </div>
            </>
          ) : (
            <Skeleton className="h-36 rounded-xl" />
          )}
        </Card>
      </div>

      {/* Onboarding survey: experience level + learning goals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 items-stretch">
        <Card
          title="Perfil de onboarding"
          action={
            <span className="text-xs text-[#5B6472]">
              {m ? `${m.survey.responded} de ${m.totalUsers} respondieron` : ''}
            </span>
          }
        >
          {m ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Experiencia media" value={`${m.survey.avgExperience}/10`} />
                <MiniStat label="Comodidad tecnología" value={`${m.survey.avgTech}/10`} />
              </div>
              <div>
                <div className="text-xs text-[#8B92A0] mb-2">Nivel de experiencia</div>
                <ExperienceBars survey={m.survey} />
              </div>
            </div>
          ) : (
            <Skeleton className="h-48 rounded-xl" />
          )}
        </Card>

        <Card title="Objetivos de aprendizaje">
          {m ? <GoalDonut goals={m.survey.goals} /> : <Skeleton className="h-36 rounded-xl" />}
        </Card>
      </div>

      {/* Volume chart + asset distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-5 items-stretch">
        <Card title="Volumen operado" action={<span className="text-xs text-[#5B6472]">{rangeLabel}</span>}>
          {series ? <VolumeChart data={series} /> : <Skeleton className="h-40 rounded-xl" />}
        </Card>

        <Card title="Distribución por activo" action={<span className="text-xs text-[#5B6472]">volumen</span>}>
          {assets ? <AssetBars data={assets} /> : <Skeleton className="h-40 rounded-xl" />}
        </Card>
      </div>

      {/* Top users + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5 items-start">
        <Card
          title="Top usuarios por patrimonio"
          action={
            <Link to="/admin/users" className="text-xs font-medium text-[#60A5FA] hover:text-[#93c0f8]">
              Ver todos
            </Link>
          }
        >
          {!topUsers ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <ol className="space-y-1">
              {topUsers.map((u, i) => (
                <li key={u.id}>
                  <Link
                    to={`/admin/users/${u.id}`}
                    className="flex items-center gap-3 py-1.5 px-1 -mx-1 rounded-lg hover:bg-white/[0.03] transition-colors outline-none focus-visible:bg-white/[0.04]"
                  >
                    <span className="w-4 text-xs text-[#5B6472] tabular-nums text-center">{i + 1}</span>
                    <Avatar name={u.name} size={30} />
                    <span className="text-sm text-[#F2F3F5] truncate flex-1">{u.name}</span>
                    <span className="text-sm text-[#F2F3F5] font-medium tabular-nums">
                      {fmtMoney(u.virtualBalance + u.invested)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Embudo de conversión">
          {!m ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              <FunnelRow label="Registrados" value={m.totalUsers} total={m.totalUsers} />
              <FunnelRow label="Verificados (KYC)" value={m.kycVerified} total={m.totalUsers} />
              <FunnelRow label="Activos (operaron)" value={m.activeUsers} total={m.totalUsers} />
            </div>
          )}
        </Card>
      </div>

      {/* Recent activity */}
      <Card
        title="Actividad reciente"
        action={
          <Link to="/admin/users" className="text-xs font-medium text-[#60A5FA] hover:text-[#93c0f8]">
            Ver todos
          </Link>
        }
      >
        {!recent ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-44" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {recent.map((u) => (
              <li key={u.id} className="border-b border-[#1A1D23]">
                <Link
                  to={`/admin/users/${u.id}`}
                  className="flex items-center gap-3 py-2.5 rounded-lg px-1 -mx-1 hover:bg-white/[0.03] transition-colors outline-none focus-visible:bg-white/[0.04]"
                >
                  <Avatar name={u.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#F2F3F5] truncate">{u.name}</div>
                    <div className="text-xs text-[#8B92A0] truncate">{u.email}</div>
                  </div>
                  <StatusBadge status={u.status} />
                  <span className="text-xs text-[#5B6472] w-16 text-right shrink-0">{timeAgo(u.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function pct(v: number, total: number) {
  return total > 0 ? Math.round((v / total) * 100) : 0;
}

function RangeToggle({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex bg-[#101216] border border-[#1E2128] rounded-lg p-0.5" role="group" aria-label="Rango de fechas">
      {RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 ${
            value === r.key ? 'bg-[#1E2128] text-[#F2F3F5]' : 'text-[#8B92A0] hover:text-[#F2F3F5]'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function DeltaBadge({ pct: p }: { pct: number }) {
  const flat = p === 0;
  const up = p > 0;
  const color = flat ? 'text-[#8B92A0]' : up ? 'text-[#16C784]' : 'text-[#FF5C5C]';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${color}`}>
      {arrow}
      {Math.abs(p)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  delta,
  children,
}: {
  label: string;
  value: number | string;
  sub: string;
  tone?: 'green' | 'amber';
  delta?: number;
  children: React.ReactNode;
}) {
  const color = tone === 'green' ? 'text-[#16C784]' : tone === 'amber' ? 'text-[#E8B339]' : 'text-[#F2F3F5]';
  return (
    <div className="bg-[#101216] border border-[#1E2128] rounded-2xl p-4 flex flex-col">
      <div className="text-xs text-[#8B92A0]">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className={`text-2xl font-semibold ${color}`}>{value}</div>
        {delta !== undefined && <DeltaBadge pct={delta} />}
      </div>
      <div className="text-[11px] text-[#5B6472] mt-0.5 mb-2">{sub}</div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0A0B0D] border border-[#1E2128] rounded-xl px-3 py-2.5">
      <div className="text-[11px] text-[#8B92A0]">{label}</div>
      <div className="text-lg font-semibold text-[#F2F3F5] tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function FunnelRow({ label, value, total }: { label: string; value: number; total: number }) {
  const p = pct(value, total);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[#B8BFCC]">{label}</span>
        <span className="text-[#8B92A0]">
          {value} · {p}%
        </span>
      </div>
      <div className="h-2 bg-[#1A1D23] rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-[#3B82F6] transition-[width] duration-500" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
