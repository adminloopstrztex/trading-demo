import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import { useAccountStore } from '../store/accountStore';
import { useHistoryStore } from '../store/historyStore';
import TradingChart from '../components/TradingChart';
import AssetLogo from '../components/AssetLogo';
import WelcomeBanner from '../components/WelcomeBanner';
import { useCountUp } from '../hooks/useCountUp';

export default function Portfolio() {
  const assets = useMarketStore((s) => s.assets);
  const holdings = useAccountStore((s) => s.holdings);
  const balance = useAccountStore((s) => s.virtualBalance);
  const user = useAccountStore((s) => s.user);
  const { equityHistory, pushEquity } = useHistoryStore();

  const portfolioValue = holdings.reduce((sum, h) => {
    const price = assets[h.symbol]?.price ?? h.avgPrice;
    return sum + price * h.quantity;
  }, 0);
  const equity = balance + portfolioValue;
  const costBasis = holdings.reduce((sum, h) => sum + h.avgPrice * h.quantity, 0);
  const pnl = portfolioValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

  useEffect(() => {
    pushEquity(equity);
  }, [equity, pushEquity]);

  const first = equityHistory[0]?.value ?? equity;
  const periodChange = equity - first;
  const positive = periodChange >= 0;
  const animatedEquity = useCountUp(equity);

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-6">
      <WelcomeBanner />
      <div>
        <p className="text-sm text-[#8B92A0] mb-1">Hola, {user?.name?.split(' ')[0]}</p>
        <h1 className="text-[40px] font-semibold text-[#F2F3F5] tracking-tight tabular-nums">
          ${animatedEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h1>
        <p className={`text-sm font-medium mt-1 ${positive ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}>
          {positive ? '+' : ''}${periodChange.toFixed(2)} hoy
        </p>
      </div>

      <div className="bg-[#101216] rounded-2xl border border-[#1E2128] p-2 flex-1 min-h-[320px]">
        {equityHistory.length > 1 ? (
          <TradingChart type="area" line={equityHistory} positive={positive} chartKey="equity" secondsVisible />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-[#8B92A0]">
            Cargando datos del mercado…
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Efectivo disponible" value={`$${balance.toFixed(2)}`} />
        <Stat label="Invertido" value={`$${costBasis.toFixed(2)}`} />
        <Stat
          label="Rendimiento"
          value={`${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct.toFixed(1)}%)`}
          tone={pnl >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#F2F3F5]">Tus inversiones</h2>
          <Link to="/app/invest" className="text-sm font-medium text-[#16C784]">
            + Invertir
          </Link>
        </div>

        {holdings.length === 0 ? (
          <div className="bg-[#101216] rounded-2xl border border-[#1E2128] p-8 text-center">
            <p className="text-sm text-[#8B92A0] mb-3">Aún no tienes inversiones.</p>
            <Link
              to="/app/invest"
              className="inline-block bg-[#16C784] hover:bg-[#13B374] text-[#0A0B0D] text-sm font-medium rounded-xl px-4 py-2"
            >
              Explorar mercado
            </Link>
          </div>
        ) : (
          <div className="bg-[#101216] rounded-2xl border border-[#1E2128] divide-y divide-[#1E2128]">
            {holdings.map((h) => {
              const asset = assets[h.symbol];
              const price = asset?.price ?? h.avgPrice;
              const value = price * h.quantity;
              const itemPnl = (price - h.avgPrice) * h.quantity;
              const itemPnlPct = ((price - h.avgPrice) / h.avgPrice) * 100;
              return (
                <Link
                  key={h.symbol}
                  to={`/app/invest/${h.symbol}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3">
                    <AssetLogo symbol={h.symbol} size={36} />
                    <div>
                      <div className="font-medium text-[#F2F3F5]">{h.symbol}</div>
                      <div className="text-xs text-[#8B92A0]">{asset?.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-[#F2F3F5]">${value.toFixed(2)}</div>
                    <div
                      className={`text-xs font-medium ${itemPnl >= 0 ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}
                    >
                      {itemPnl >= 0 ? '+' : ''}${itemPnl.toFixed(2)} ({itemPnlPct.toFixed(1)}%)
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  const color =
    tone === 'positive' ? 'text-[#16C784]' : tone === 'negative' ? 'text-[#FF5C5C]' : 'text-[#F2F3F5]';
  return (
    <div className="bg-[#101216] rounded-2xl border border-[#1E2128] p-4">
      <div className="text-xs text-[#8B92A0] mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
