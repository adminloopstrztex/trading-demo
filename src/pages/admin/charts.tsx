import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { fmtMoney } from './ui';
import type { AssetVolume } from './types';

export interface SeriesPoint {
  date: string;
  signups: number;
  cumulativeUsers: number;
  trades: number;
  volume: number;
}

const AXIS = '#5B6472';
const GRID = '#1A1D23';

function shortDate(d: string) {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

function TooltipBox({
  active,
  payload,
  label,
  format,
  name,
}: {
  active?: boolean;
  // Recharts types `value` very broadly; keep this permissive and coerce below.
  payload?: readonly { value?: unknown }[];
  label?: string | number;
  format: (v: number) => string;
  name: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#262A33] bg-[#16181C] px-3 py-2 shadow-lg">
      <div className="text-[11px] text-[#8B92A0]">{label ? shortDate(String(label)) : ''}</div>
      <div className="text-sm font-medium text-[#F2F3F5]">
        {format(Number(payload[0].value))} <span className="text-[#8B92A0] font-normal">{name}</span>
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  dataKey,
  color,
}: {
  data: SeriesPoint[];
  dataKey: keyof SeriesPoint;
  color: string;
}) {
  const id = `spark-${String(dataKey)}`;
  return (
    <div className="h-9 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey as string}
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GrowthChart({ data }: { data: SeriesPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: '#3B82F6', strokeOpacity: 0.4 }}
            content={({ active, payload, label }) => (
              <TooltipBox active={active} payload={payload} label={label} name="usuarios" format={(v) => String(v)} />
            )}
          />
          <Area
            type="monotone"
            dataKey="cumulativeUsers"
            stroke="#3B82F6"
            strokeWidth={2}
            fill="url(#growthFill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, fill: '#3B82F6', stroke: '#0A0B0D', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VolumeChart({ data }: { data: SeriesPoint[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3A6" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#22D3A6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={28} />
          <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
          <Tooltip
            cursor={{ stroke: '#22D3A6', strokeOpacity: 0.4 }}
            content={({ active, payload, label }) => (
              <TooltipBox active={active} payload={payload} label={label} name="volumen" format={(v) => fmtMoney(v)} />
            )}
          />
          <Area type="monotone" dataKey="volume" stroke="#22D3A6" strokeWidth={2} fill="url(#volFill)" isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AssetBars({ data }: { data: AssetVolume[] }) {
  const top = data.slice(0, 6);
  const max = Math.max(...top.map((d) => d.volume), 1);
  if (top.length === 0) return <p className="text-sm text-[#5B6472]">Sin operaciones todavía.</p>;
  return (
    <div className="space-y-2.5">
      {top.map((d) => (
        <div key={d.symbol} className="flex items-center gap-3">
          <span className="w-16 text-xs font-medium text-[#B8BFCC] shrink-0">{d.symbol}</span>
          <div className="flex-1 h-2.5 bg-[#1A1D23] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#3B82F6] transition-[width] duration-500"
              style={{ width: `${(d.volume / max) * 100}%` }}
            />
          </div>
          <span className="w-20 text-right text-xs text-[#F2F3F5] tabular-nums">{fmtMoney(d.volume)}</span>
        </div>
      ))}
    </div>
  );
}

export function KycDonut({
  verified,
  pending,
  none,
}: {
  verified: number;
  pending: number;
  none: number;
}) {
  const total = verified + pending + none;
  const data = [
    { name: 'Verificados', value: verified, color: '#16C784' },
    { name: 'Pendientes', value: pending, color: '#E8B339' },
    { name: 'Sin verificar', value: none, color: '#5B6472' },
  ];
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={46}
              outerRadius={64}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-semibold text-[#F2F3F5] leading-none">{total}</span>
          <span className="text-[10px] text-[#8B92A0] mt-0.5">usuarios</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm flex-1">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-[#B8BFCC] flex-1">{d.name}</span>
            <span className="text-[#F2F3F5] font-medium tabular-nums">{d.value}</span>
            <span className="text-xs text-[#5B6472] w-9 text-right tabular-nums">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
