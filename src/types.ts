export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Asset {
  symbol: string;
  name: string;
  price: number;
  spreadPct: number;
  candles: Candle[];
  source: 'sim' | 'live';
  coinId?: string; // CoinGecko id for live assets
}

export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
}

export interface Transaction {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: number;
}

export interface PendingOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'limit' | 'stop';
  quantity: number;
  targetPrice: number;
  createdAt: number;
}

export interface User {
  email: string;
  name: string;
}
