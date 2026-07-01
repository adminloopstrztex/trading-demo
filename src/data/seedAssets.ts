import type { Asset } from '../types';

type Seed = Pick<Asset, 'symbol' | 'name' | 'price' | 'spreadPct' | 'source' | 'coinId'>;

export const SEED_ASSETS: Seed[] = [
  { symbol: 'BTCUSD', name: 'Bitcoin vs US Dollar', price: 67500, spreadPct: 0.0006, source: 'live', coinId: 'bitcoin' },
  { symbol: 'ETHUSD', name: 'Ethereum vs US Dollar', price: 3550, spreadPct: 0.0008, source: 'live', coinId: 'ethereum' },
  { symbol: 'SOLUSD', name: 'Solana vs US Dollar', price: 150, spreadPct: 0.001, source: 'live', coinId: 'solana' },
  { symbol: 'EURUSD', name: 'Euro vs US Dollar', price: 1.0852, spreadPct: 0.0004, source: 'sim' },
  { symbol: 'GBPUSD', name: 'Britsh Pound vs USD', price: 1.2674, spreadPct: 0.0005, source: 'sim' },
  { symbol: 'USDJPY', name: 'US Dollar vs Yen', price: 156.32, spreadPct: 0.0004, source: 'sim' },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 195.3, spreadPct: 0.0008, source: 'sim' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.6, spreadPct: 0.0012, source: 'sim' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 132.7, spreadPct: 0.001, source: 'sim' },
  { symbol: 'XAUUSD', name: 'Gold vs US Dollar', price: 2345.5, spreadPct: 0.0003, source: 'sim' },
];
