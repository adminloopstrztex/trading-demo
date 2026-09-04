import type { Candle } from '../types';

// Binance public API: real-time crypto data, no API key, CORS-enabled.
const BASE = 'https://api.binance.com/api/v3';

// Maps our symbols to Binance trading pairs (USDT is the de-facto USD pair).
const PAIR: Record<string, string> = {
  BTCUSD: 'BTCUSDT',
  ETHUSD: 'ETHUSDT',
  SOLUSD: 'SOLUSDT',
};

const RANGE_TO_INTERVAL: Record<number, { interval: string; limit: number }> = {
  1: { interval: '15m', limit: 96 }, // ~1 day
  7: { interval: '2h', limit: 84 }, // ~1 week
  30: { interval: '8h', limit: 90 }, // ~1 month
};

export function binancePair(symbol: string): string | undefined {
  return PAIR[symbol];
}

export async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  const pairs = symbols.map((s) => PAIR[s]).filter(Boolean);
  if (pairs.length === 0) return {};
  const param = encodeURIComponent(JSON.stringify(pairs));
  const res = await fetch(`${BASE}/ticker/price?symbols=${param}`);
  if (!res.ok) throw new Error(`Binance price ${res.status}`);
  const json = (await res.json()) as { symbol: string; price: string }[];
  const pairToSymbol: Record<string, string> = {};
  for (const s of symbols) if (PAIR[s]) pairToSymbol[PAIR[s]] = s;
  const out: Record<string, number> = {};
  for (const row of json) {
    const sym = pairToSymbol[row.symbol];
    if (sym) out[sym] = parseFloat(row.price);
  }
  return out;
}

// 24h price + change % per symbol (Binance /ticker/24hr).
export async function fetchCrypto24h(
  symbols: string[]
): Promise<Record<string, { price: number; changePct: number }>> {
  const pairs = symbols.map((s) => PAIR[s]).filter(Boolean);
  if (pairs.length === 0) return {};
  const param = encodeURIComponent(JSON.stringify(pairs));
  const res = await fetch(`${BASE}/ticker/24hr?symbols=${param}`);
  if (!res.ok) throw new Error(`Binance 24hr ${res.status}`);
  const json = (await res.json()) as { symbol: string; lastPrice: string; priceChangePercent: string }[];
  const pairToSymbol: Record<string, string> = {};
  for (const s of symbols) if (PAIR[s]) pairToSymbol[PAIR[s]] = s;
  const out: Record<string, { price: number; changePct: number }> = {};
  for (const row of json) {
    const sym = pairToSymbol[row.symbol];
    if (sym) out[sym] = { price: parseFloat(row.lastPrice), changePct: parseFloat(row.priceChangePercent) };
  }
  return out;
}

export async function fetchCryptoCandles(symbol: string, days: number): Promise<Candle[]> {
  const pair = PAIR[symbol];
  if (!pair) return [];
  const { interval, limit } = RANGE_TO_INTERVAL[days] ?? RANGE_TO_INTERVAL[1];
  const res = await fetch(`${BASE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const json = (await res.json()) as [number, string, string, string, string, ...unknown[]][];
  return json.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));
}
