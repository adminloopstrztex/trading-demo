import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarketStore } from '../store/marketStore';
import MiniSparkline from '../components/MiniSparkline';
import AssetLogo from '../components/AssetLogo';
import Price from '../components/Price';

export default function Invest() {
  const assets = useMarketStore((s) => s.assets);
  const [query, setQuery] = useState('');

  const list = Object.values(assets).filter(
    (a) =>
      a.symbol.toLowerCase().includes(query.toLowerCase()) ||
      a.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-[#F2F3F5] mb-4">Invertir</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar acciones, ETFs, cripto…"
          className="w-full rounded-xl border border-[#1E2128] bg-[#101216] px-4 py-2.5 text-sm text-[#F2F3F5] focus:outline-none focus:border-[#16C784] placeholder:text-[#8B92A0]"
        />
      </div>

      <div className="bg-[#101216] rounded-2xl border border-[#1E2128] divide-y divide-[#1E2128]">
        {list.map((asset) => {
          const closes = asset.candles.map((c) => c.close);
          const first = closes[0];
          const positive = asset.price >= first;
          const changePct = ((asset.price - first) / first) * 100;
          const decimals = asset.price > 1000 ? 2 : asset.price < 10 ? 5 : 2;

          return (
            <Link
              key={asset.symbol}
              to={`/app/invest/${asset.symbol}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <AssetLogo symbol={asset.symbol} size={36} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[#F2F3F5]">{asset.symbol}</span>
                    {asset.source === 'live' && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold text-[#16C784] bg-[#16C784]/12 rounded px-1 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16C784] animate-pulse" />
                        EN VIVO
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8B92A0]">{asset.name}</div>
                </div>
              </div>
              <MiniSparkline values={closes} positive={positive} />
              <div className="text-right w-24">
                <Price
                  value={asset.price}
                  format={(v) => v.toFixed(decimals)}
                  className="font-medium text-[#F2F3F5] inline-block"
                />
                <div className={`text-xs font-medium ${positive ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}>
                  {positive ? '+' : ''}
                  {changePct.toFixed(2)}%
                </div>
              </div>
            </Link>
          );
        })}
        {list.length === 0 && (
          <p className="text-sm text-[#8B92A0] px-5 py-6 text-center">Sin resultados.</p>
        )}
      </div>
    </div>
  );
}
