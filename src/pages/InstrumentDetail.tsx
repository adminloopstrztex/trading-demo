import { useEffect, useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import { useAccountStore } from '../store/accountStore';
import { fetchCryptoCandles } from '../data/cryptoFeed';
import TradingChart from '../components/TradingChart';
import AssetLogo from '../components/AssetLogo';

const RANGES = [
  { key: '1D', count: 30, days: 1 },
  { key: '1S', count: 60, days: 7 },
  { key: 'Todo', count: 90, days: 30 },
];

function triggerHint(
  type: 'limit' | 'stop',
  side: 'buy' | 'sell',
  target: number,
  dec: number
): string {
  const up = (type === 'limit' && side === 'sell') || (type === 'stop' && side === 'buy');
  return `${up ? 'suba' : 'baje'} a $${target.toFixed(dec)} o ${up ? 'más' : 'menos'}`;
}

export default function InstrumentDetail() {
  const { symbol = '' } = useParams();
  const asset = useMarketStore((s) => s.assets[symbol]);
  const setLiveCandles = useMarketStore((s) => s.setLiveCandles);
  const trade = useAccountStore((s) => s.trade);
  const createOrder = useAccountStore((s) => s.createOrder);
  const balance = useAccountStore((s) => s.virtualBalance);
  const holdings = useAccountStore((s) => s.holdings);
  const [range, setRange] = useState('Todo');
  const [chartType, setChartType] = useState<'candles' | 'area'>('candles');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [amount, setAmount] = useState('100');
  const [target, setTarget] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const isLive = asset?.source === 'live';
  const days = RANGES.find((r) => r.key === range)?.days ?? 1;

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    fetchCryptoCandles(symbol, days)
      .then((c) => {
        if (!cancelled) setLiveCandles(symbol, c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLive, days, symbol, setLiveCandles]);

  if (!asset) return <Navigate to="/app/invest" replace />;

  const decimals = asset.price > 1000 ? 2 : asset.price < 10 ? 5 : 2;
  const rangeCount = RANGES.find((r) => r.key === range)?.count ?? asset.candles.length;
  const visibleCandles = asset.source === 'live' ? asset.candles : asset.candles.slice(-rangeCount);
  const visiblePoints = visibleCandles.map((c) => ({ time: c.time, value: c.close }));
  const first = visiblePoints[0]?.value ?? asset.price;
  const positive = asset.price >= first;
  const changePct = ((asset.price - first) / first) * 100;

  const position = holdings.find((h) => h.symbol === symbol);
  const amountNum = Number(amount) || 0;
  const maxSellAmount = position ? position.quantity * asset.price : 0;

  const targetNum = Number(target) || 0;
  // For limit/stop, size the order by the target price (that's the fill price).
  const orderPrice = orderType === 'market' ? asset.price : targetNum;
  const orderUnits = orderPrice > 0 ? amountNum / orderPrice : 0;

  async function handleConfirm() {
    if (submitting) return;
    if (!(amountNum > 0)) {
      setFeedback('Ingresa un monto válido.');
      return;
    }
    if (orderType !== 'market' && !(targetNum > 0)) {
      setFeedback('Ingresa un precio objetivo válido.');
      return;
    }
    setSubmitting(true);
    if (orderType === 'market') {
      const result = await trade(mode, symbol, amountNum / asset.price, asset.price);
      setSubmitting(false);
      setFeedback(
        result.ok
          ? `${mode === 'buy' ? 'Compraste' : 'Vendiste'} $${amountNum.toFixed(2)} de ${symbol}.`
          : result.error || 'No se pudo completar la operación.'
      );
    } else {
      const result = await createOrder(orderType, mode, symbol, orderUnits, targetNum);
      setSubmitting(false);
      if (result.ok) {
        const label = orderType === 'limit' ? 'límite' : 'stop';
        setFeedback(`Orden ${label} de ${mode === 'buy' ? 'compra' : 'venta'} creada en ${targetNum}.`);
        setTarget('');
      } else {
        setFeedback(result.error || 'No se pudo crear la orden.');
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="flex items-center justify-between mb-3">
        <Link to="/app/invest" className="text-sm text-[#8B92A0] hover:text-[#F2F3F5]">
          ← Volver a Invertir
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#101216] border border-[#1E2128] rounded-lg p-0.5">
            <button
              onClick={() => setChartType('candles')}
              title="Velas japonesas"
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                chartType === 'candles' ? 'bg-[#1E2128] text-[#F2F3F5]' : 'text-[#8B92A0] hover:text-[#F2F3F5]'
              }`}
            >
              Velas
            </button>
            <button
              onClick={() => setChartType('area')}
              title="Línea"
              className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                chartType === 'area' ? 'bg-[#1E2128] text-[#F2F3F5]' : 'text-[#8B92A0] hover:text-[#F2F3F5]'
              }`}
            >
              Línea
            </button>
          </div>
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  range === r.key ? 'bg-[#16C784]/15 text-[#16C784]' : 'text-[#8B92A0] hover:bg-white/5'
                }`}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <AssetLogo symbol={asset.symbol} size={40} />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#F2F3F5] leading-tight">{asset.symbol}</span>
            {asset.source === 'live' && (
              <span className="flex items-center gap-1 text-[9px] font-semibold text-[#16C784] bg-[#16C784]/12 rounded px-1 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16C784] animate-pulse" />
                EN VIVO
              </span>
            )}
          </div>
          <div className="text-xs text-[#8B92A0]">{asset.name}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[26px] font-semibold text-[#F2F3F5] leading-tight">
            {asset.price.toFixed(decimals)}
          </div>
          <div className={`text-sm font-medium ${positive ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}>
            {positive ? '+' : ''}
            {changePct.toFixed(2)}% ({range})
          </div>
        </div>
      </div>

      <div className="bg-[#101216] rounded-2xl border border-[#1E2128] p-2 flex-1 min-h-[420px]">
        <TradingChart
          type={chartType}
          line={visiblePoints}
          candles={visibleCandles}
          positive={positive}
          chartKey={symbol}
          decimals={decimals}
        />
      </div>

      {!panelOpen && (
        <div className="sticky bottom-0 mt-4 flex gap-3">
          <button
            onClick={() => {
              setMode('sell');
              setPanelOpen(true);
            }}
            className="flex-1 rounded-xl py-3 text-sm font-semibold bg-[#1A1D23] border border-[#262A33] text-[#FF5C5C] hover:bg-[#1D2025]"
          >
            Vender
          </button>
          <button
            onClick={() => {
              setMode('buy');
              setPanelOpen(true);
            }}
            className="flex-1 rounded-xl py-3 text-sm font-semibold bg-[#16C784] text-[#0A0B0D] hover:bg-[#13B374]"
          >
            Comprar
          </button>
        </div>
      )}

      {panelOpen && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-[#101216] border border-[#1E2128] rounded-2xl p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-[#1A1D23] rounded-xl p-1">
              <button
                onClick={() => setMode('buy')}
                className={`px-4 text-sm font-medium rounded-lg py-1.5 ${
                  mode === 'buy' ? 'bg-[#16C784] text-[#0A0B0D]' : 'text-[#8B92A0]'
                }`}
              >
                Comprar
              </button>
              <button
                onClick={() => setMode('sell')}
                className={`px-4 text-sm font-medium rounded-lg py-1.5 ${
                  mode === 'sell' ? 'bg-[#FF5C5C] text-[#0A0B0D]' : 'text-[#8B92A0]'
                }`}
              >
                Vender
              </button>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="text-[#8B92A0] hover:text-[#F2F3F5] text-sm"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex gap-1 bg-[#1A1D23] rounded-lg p-0.5 w-fit" role="group" aria-label="Tipo de orden">
              {(['market', 'limit', 'stop'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrderType(t)}
                  aria-pressed={orderType === t}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    orderType === t ? 'bg-[#262A33] text-[#F2F3F5]' : 'text-[#8B92A0] hover:text-[#F2F3F5]'
                  }`}
                >
                  {t === 'market' ? 'Mercado' : t === 'limit' ? 'Límite' : 'Stop'}
                </button>
              ))}
            </div>

            <div className={`grid gap-3 items-end ${orderType === 'market' ? 'sm:grid-cols-[1fr_auto]' : 'sm:grid-cols-[1fr_1fr_auto]'}`}>
              <div>
                <label className="block text-xs text-[#8B92A0] mb-1">Monto en USD</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A0]">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    aria-label="Monto en USD"
                    className="w-full rounded-xl border border-[#1E2128] bg-[#0A0B0D] text-[#F2F3F5] pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
                  />
                </div>
              </div>

              {orderType !== 'market' && (
                <div>
                  <label className="block text-xs text-[#8B92A0] mb-1">Precio objetivo</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={asset.price.toFixed(decimals)}
                    aria-label="Precio objetivo"
                    className="w-full rounded-xl border border-[#1E2128] bg-[#0A0B0D] text-[#F2F3F5] px-3 py-2.5 text-sm focus:outline-none focus:border-[#16C784]"
                  />
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={submitting}
                className={`rounded-xl py-2.5 px-4 text-sm font-semibold text-[#0A0B0D] disabled:opacity-60 ${
                  mode === 'buy' ? 'bg-[#16C784] hover:bg-[#13B374]' : 'bg-[#FF5C5C] hover:bg-[#E84C4C]'
                }`}
              >
                {submitting
                  ? 'Procesando…'
                  : orderType === 'market'
                    ? `${mode === 'buy' ? 'Comprar' : 'Vender'} ${symbol}`
                    : 'Crear orden'}
              </button>
            </div>

            <div className="text-xs text-[#8B92A0]">
              ≈ {orderUnits.toFixed(4)} unidades · Efectivo: ${balance.toFixed(2)}
              {mode === 'sell' && ` · Posición: $${maxSellAmount.toFixed(2)}`}
              {orderType !== 'market' && targetNum > 0 && (
                <span className="block mt-0.5 text-[#5B6472]">
                  Se ejecutará cuando el precio {triggerHint(orderType, mode, targetNum, decimals)}.
                </span>
              )}
            </div>
          </div>

          {feedback && <p className="text-xs text-[#8B92A0] mt-3 text-center">{feedback}</p>}
        </div>
      )}
    </div>
  );
}
