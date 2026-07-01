export type Visual =
  | { kind: 'logo'; url: string; bg: string }
  | { kind: 'pair'; flags: [string, string] }
  | { kind: 'badge'; label: string; color: string; bg: string };

const flag = (code: string) => `https://flagcdn.com/w80/${code}.png`;
const crypto = (sym: string) =>
  `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${sym}.svg`;
const stock = (ticker: string) =>
  `https://cdn.jsdelivr.net/gh/nvstly/icons/ticker_icons/${ticker}.png`;

const MAP: Record<string, Visual> = {
  AAPL: { kind: 'logo', url: stock('AAPL'), bg: '#FFFFFF' },
  TSLA: { kind: 'logo', url: stock('TSLA'), bg: '#FFFFFF' },
  NVDA: { kind: 'logo', url: stock('NVDA'), bg: '#FFFFFF' },
  BTCUSD: { kind: 'logo', url: crypto('btc'), bg: '#1A1D23' },
  ETHUSD: { kind: 'logo', url: crypto('eth'), bg: '#1A1D23' },
  SOLUSD: { kind: 'logo', url: crypto('sol'), bg: '#1A1D23' },
  EURUSD: { kind: 'pair', flags: ['eu', 'us'] },
  GBPUSD: { kind: 'pair', flags: ['gb', 'us'] },
  USDJPY: { kind: 'pair', flags: ['us', 'jp'] },
  XAUUSD: { kind: 'badge', label: 'Au', color: '#0A0B0D', bg: '#E8B339' },
};

export function assetVisual(symbol: string): Visual {
  return (
    MAP[symbol] ?? {
      kind: 'badge',
      label: symbol.slice(0, 2),
      color: '#16C784',
      bg: 'rgba(22,199,132,0.15)',
    }
  );
}

export { flag };
