// Server-side knowledge of tradable symbols. Used to validate trades so the
// client cannot invent symbols or (for crypto) prices.

export const SYMBOLS = {
  BTCUSD: { live: true, pair: 'BTCUSDT' },
  ETHUSD: { live: true, pair: 'ETHUSDT' },
  SOLUSD: { live: true, pair: 'SOLUSDT' },
  EURUSD: { live: false },
  GBPUSD: { live: false },
  USDJPY: { live: false },
  AAPL: { live: false },
  TSLA: { live: false },
  NVDA: { live: false },
  XAUUSD: { live: false },
};

export function isValidSymbol(symbol) {
  return Object.prototype.hasOwnProperty.call(SYMBOLS, symbol);
}

// Fetches the authoritative price for a live (crypto) symbol from Binance.
// Returns null on any failure so the caller can decide how to proceed.
export async function fetchLivePrice(symbol) {
  const meta = SYMBOLS[symbol];
  if (!meta || !meta.live) return null;
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${meta.pair}`);
    if (!res.ok) return null;
    const json = await res.json();
    const price = parseFloat(json.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
