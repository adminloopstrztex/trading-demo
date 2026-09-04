import { useMemo, useState } from 'react';
import { useMarketStore } from '../store/marketStore';
import { useAccountStore } from '../store/accountStore';
import TradingChart from '../components/TradingChart';
import Price from '../components/Price';
import { toast } from '../store/toastStore';
import type { Asset, AssetCategory } from '../types';

const CATEGORIES: { key: AssetCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'crypto', label: 'Cripto' },
  { key: 'forex', label: 'Forex' },
  { key: 'stock', label: 'Acciones' },
  { key: 'metal', label: 'Metales' },
];

function decimalsFor(a: Asset): number {
  if (a.category === 'forex') return a.symbol.includes('JPY') ? 3 : 5;
  return a.price >= 1000 ? 2 : a.price < 10 ? 4 : 2;
}
function trend(a: Asset): boolean {
  const c = a.candles;
  if (c.length < 2) return true;
  return c[c.length - 1].close >= c[c.length - 2].close;
}

export default function Terminal() {
  const assets = useMarketStore((s) => s.assets);
  const selectedSymbol = useMarketStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useMarketStore((s) => s.setSelectedSymbol);
  const asset = assets[selectedSymbol] ?? Object.values(assets)[0];

  const [cat, setCat] = useState<AssetCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [chartType, setChartType] = useState<'candles' | 'area'>('candles');

  const list = useMemo(
    () =>
      Object.values(assets).filter(
        (a) =>
          (cat === 'all' || a.category === cat) &&
          (a.symbol.toLowerCase().includes(q.toLowerCase()) || a.name.toLowerCase().includes(q.toLowerCase()))
      ),
    [assets, cat, q]
  );

  if (!asset) return null;

  const dec = decimalsFor(asset);
  const spread = asset.price * asset.spreadPct;
  const ask = asset.price + spread / 2;
  const bid = asset.price - spread / 2;
  const first = asset.candles[0];
  const positive = first ? asset.price >= first.close : true;
  const changePct = first ? ((asset.price - first.close) / first.close) * 100 : 0;
  const linePoints = asset.candles.map((c) => ({ time: c.time, value: c.close }));

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
        {/* Market watch (nuestros precios) */}
        <div className="hidden lg:flex flex-col min-h-0 bg-[#0F1115] border border-[#1E2128] rounded-xl overflow-hidden">
          <div className="p-2.5 border-b border-[#1E2128]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar instrumento"
              className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-1.5 text-sm text-[#F2F3F5] placeholder:text-[#5B6472] outline-none focus:border-[#3B82F6]"
            />
          </div>
          <div className="flex gap-1 px-2 py-1.5 border-b border-[#1E2128] overflow-x-auto">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`text-[11px] font-medium rounded-md px-2 py-1 whitespace-nowrap ${
                  cat === c.key ? 'bg-[#1E2128] text-[#F2F3F5]' : 'text-[#8B92A0] hover:text-[#F2F3F5]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-1.5 text-[10px] uppercase text-[#5B6472] border-b border-[#1E2128]">
            <span>Par</span>
            <span className="text-right w-16">Compra</span>
            <span className="text-right w-16">Venta</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.map((a) => {
              const d = decimalsFor(a);
              const sp = a.price * a.spreadPct;
              const up = trend(a);
              const isSel = a.symbol === selectedSymbol;
              return (
                <button
                  key={a.symbol}
                  onClick={() => setSelectedSymbol(a.symbol)}
                  className={`w-full grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-left border-b border-[#141821] ${
                    isSel ? 'bg-[#16C784]/10' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={up ? 'text-[#16C784]' : 'text-[#FF5C5C]'}>{up ? '▲' : '▼'}</span>
                    <span className="text-xs font-medium text-[#F2F3F5] truncate">{a.symbol}</span>
                  </span>
                  <span className="text-right w-16 text-xs tabular-nums text-[#16C784]">{(a.price + sp / 2).toFixed(d)}</span>
                  <span className="text-right w-16 text-xs tabular-nums text-[#FF5C5C]">{(a.price - sp / 2).toFixed(d)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart (TradingView) */}
        <div className="flex flex-col min-h-0 bg-[#0F1115] border border-[#1E2128] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-[#1E2128] flex-wrap">
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="text-base font-semibold text-[#F2F3F5]">{asset.symbol}</span>
              <span className="text-xs text-[#8B92A0] truncate">{asset.name}</span>
              <Price value={asset.price} format={(v) => v.toFixed(dec)} className="text-sm font-mono text-[#F2F3F5]" />
              <span className={`text-xs font-medium ${positive ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}>
                {positive ? '+' : ''}
                {changePct.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-1 bg-[#1A1D23] rounded-lg p-0.5">
              {(['candles', 'area'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  aria-pressed={chartType === t}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartType === t ? 'bg-[#262A33] text-[#F2F3F5]' : 'text-[#8B92A0] hover:text-[#F2F3F5]'
                  }`}
                >
                  {t === 'candles' ? 'Velas' : 'Línea'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <TradingChart
              type={chartType}
              candles={asset.candles}
              line={linePoints}
              positive={positive}
              chartKey={asset.symbol}
              decimals={dec}
            />
          </div>

          <TradeBar symbol={asset.symbol} bid={bid} ask={ask} dec={dec} price={asset.price} />
        </div>
      </div>

      <AccountBar />
    </div>
  );
}

function TradeBar({ symbol, bid, ask, dec, price }: { symbol: string; bid: number; ask: number; dec: number; price: number }) {
  const trade = useAccountStore((s) => s.trade);
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState(false);

  async function go(side: 'buy' | 'sell') {
    const usd = Number(amount) || 0;
    if (!(usd > 0)) {
      toast.error('Monto inválido', 'Ingresa un monto en USD mayor a 0.');
      return;
    }
    setBusy(true);
    const res = await trade(side, symbol, usd / price, price);
    setBusy(false);
    if (res.ok) {
      toast.success(`${side === 'buy' ? 'Compra ejecutada' : 'Venta ejecutada'}`, `$${usd.toFixed(2)} de ${symbol}.`);
    } else {
      toast.error('No se pudo operar', res.error || 'Inténtalo de nuevo.');
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-[#1E2128] flex-wrap">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5B6472] text-xs">$</span>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Monto en USD"
          className="w-24 rounded-lg border border-[#1E2128] bg-[#0A0B0D] pl-5 pr-2 py-1.5 text-sm text-[#F2F3F5] outline-none focus:border-[#16C784]"
        />
      </div>
      <button
        onClick={() => go('sell')}
        disabled={busy}
        className="rounded-lg bg-[#FF5C5C]/15 text-[#FF5C5C] hover:bg-[#FF5C5C]/25 disabled:opacity-50 text-sm font-semibold px-4 py-1.5"
      >
        Vender {bid.toFixed(dec)}
      </button>
      <button
        onClick={() => go('buy')}
        disabled={busy}
        className="rounded-lg bg-[#16C784]/15 text-[#16C784] hover:bg-[#16C784]/25 disabled:opacity-50 text-sm font-semibold px-4 py-1.5"
      >
        Comprar {ask.toFixed(dec)}
      </button>
    </div>
  );
}

function AccountBar() {
  const assets = useMarketStore((s) => s.assets);
  const balance = useAccountStore((s) => s.virtualBalance);
  const holdings = useAccountStore((s) => s.holdings);

  const portfolioValue = holdings.reduce((s, h) => s + (assets[h.symbol]?.price ?? h.avgPrice) * h.quantity, 0);
  const costBasis = holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0);
  const pnl = portfolioValue - costBasis;
  const equity = balance + portfolioValue;
  const saldo = equity - pnl;
  const libre = equity - costBasis;
  const nivel = costBasis > 0 ? (equity / costBasis) * 100 : 0;
  const money = (n: number) => `$${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-[#0F1115] border border-[#1E2128] rounded-xl px-4 py-2.5 grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
      <Metric label="Saldo" value={money(saldo)} />
      <Metric label="Lucro" value={`${pnl >= 0 ? '+' : ''}${money(pnl)}`} tone={pnl >= 0 ? 'up' : 'down'} />
      <Metric label="Equidad" value={money(equity)} />
      <Metric label="Margen" value={money(costBasis)} />
      <Metric label="Libre" value={money(libre)} />
      <Metric label="Nivel" value={`${nivel.toFixed(0)}%`} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-[#16C784]' : tone === 'down' ? 'text-[#FF5C5C]' : 'text-[#F2F3F5]';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[#5B6472]">{label}</div>
      <div className={`font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
