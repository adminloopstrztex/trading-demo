import type { Asset } from '../types';

type Seed = Pick<Asset, 'symbol' | 'name' | 'price' | 'spreadPct' | 'category' | 'source' | 'coinId'>;

export const SEED_ASSETS: Seed[] = [
  // crypto (precio real vía Binance)
  { symbol: 'BTCUSD', name: 'Bitcoin vs US Dollar', price: 67500, spreadPct: 0.0006, category: 'crypto', source: 'live', coinId: 'bitcoin' },
  { symbol: 'ETHUSD', name: 'Ethereum vs US Dollar', price: 3550, spreadPct: 0.0008, category: 'crypto', source: 'live', coinId: 'ethereum' },
  { symbol: 'SOLUSD', name: 'Solana vs US Dollar', price: 150, spreadPct: 0.001, category: 'crypto', source: 'live', coinId: 'solana' },
  // forex (simulado)
  { symbol: 'EURUSD', name: 'Euro vs US Dollar', price: 1.0852, spreadPct: 0.0004, category: 'forex', source: 'sim' },
  { symbol: 'GBPUSD', name: 'British Pound vs USD', price: 1.2674, spreadPct: 0.0005, category: 'forex', source: 'sim' },
  { symbol: 'USDJPY', name: 'US Dollar vs Yen', price: 156.32, spreadPct: 0.0004, category: 'forex', source: 'sim' },
  { symbol: 'USDCHF', name: 'US Dollar vs Swiss Franc', price: 0.8106, spreadPct: 0.0005, category: 'forex', source: 'sim' },
  { symbol: 'USDCAD', name: 'US Dollar vs Canadian Dollar', price: 1.4172, spreadPct: 0.0005, category: 'forex', source: 'sim' },
  { symbol: 'AUDUSD', name: 'Australian Dollar vs USD', price: 0.6931, spreadPct: 0.0005, category: 'forex', source: 'sim' },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar vs USD', price: 0.5753, spreadPct: 0.0006, category: 'forex', source: 'sim' },
  { symbol: 'EURGBP', name: 'Euro vs British Pound', price: 0.8515, spreadPct: 0.0005, category: 'forex', source: 'sim' },
  { symbol: 'EURJPY', name: 'Euro vs Yen', price: 184.54, spreadPct: 0.0005, category: 'forex', source: 'sim' },
  { symbol: 'GBPJPY', name: 'British Pound vs Yen', price: 216.67, spreadPct: 0.0006, category: 'forex', source: 'sim' },
  // acciones (simulado)
  { symbol: 'AAPL', name: 'Apple Inc.', price: 195.3, spreadPct: 0.0008, category: 'stock', source: 'sim' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.6, spreadPct: 0.0012, category: 'stock', source: 'sim' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 132.7, spreadPct: 0.001, category: 'stock', source: 'sim' },
  // metales (simulado)
  { symbol: 'XAUUSD', name: 'Gold vs US Dollar', price: 2345.5, spreadPct: 0.0003, category: 'metal', source: 'sim' },
];
