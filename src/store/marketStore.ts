import { create } from 'zustand';
import type { Asset, Candle } from '../types';
import { SEED_ASSETS } from '../data/seedAssets';

const CANDLE_SECONDS = 60; // M1 timeframe
const HISTORY_LENGTH = 90;

function buildInitialCandles(price: number): Candle[] {
  const candles: Candle[] = [];
  let last = price;
  const now = Math.floor(Date.now() / 1000 / CANDLE_SECONDS) * CANDLE_SECONDS;
  for (let i = HISTORY_LENGTH - 1; i >= 0; i--) {
    const open = last;
    const volatility = price > 1000 ? 0.004 : price < 10 ? 0.0015 : 0.003;
    const close = Math.max(0.0001, open * (1 + (Math.random() - 0.5) * volatility * 2));
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    candles.push({ time: now - i * CANDLE_SECONDS, open, high, low, close });
    last = close;
  }
  return candles;
}

interface MarketState {
  assets: Record<string, Asset>;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  tick: () => void;
  setLivePrice: (symbol: string, price: number) => void;
  setLiveCandles: (symbol: string, candles: Candle[]) => void;
}

const initialAssets: Record<string, Asset> = {};
for (const seed of SEED_ASSETS) {
  const candles = buildInitialCandles(seed.price);
  initialAssets[seed.symbol] = {
    ...seed,
    price: candles[candles.length - 1].close,
    candles,
  };
}

export const useMarketStore = create<MarketState>((set) => ({
  assets: initialAssets,
  selectedSymbol: SEED_ASSETS[0].symbol,
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  tick: () =>
    set((state) => {
      const next: Record<string, Asset> = {};
      const nowBucket = Math.floor(Date.now() / 1000 / CANDLE_SECONDS) * CANDLE_SECONDS;

      for (const symbol in state.assets) {
        const asset = state.assets[symbol];
        if (asset.source === 'live') {
          next[symbol] = asset; // real assets are updated by the live feed, not simulated
          continue;
        }
        const volatility = asset.price > 1000 ? 0.0035 : asset.price < 10 ? 0.0012 : 0.0025;
        const change = (Math.random() - 0.5) * volatility * 2;
        const newPrice = Math.max(0.0001, asset.price * (1 + change));

        const candles = [...asset.candles];
        const lastCandle = candles[candles.length - 1];

        if (lastCandle && lastCandle.time === nowBucket) {
          candles[candles.length - 1] = {
            ...lastCandle,
            close: newPrice,
            high: Math.max(lastCandle.high, newPrice),
            low: Math.min(lastCandle.low, newPrice),
          };
        } else {
          candles.push({
            time: nowBucket,
            open: asset.price,
            high: Math.max(asset.price, newPrice),
            low: Math.min(asset.price, newPrice),
            close: newPrice,
          });
          if (candles.length > HISTORY_LENGTH) candles.shift();
        }

        next[symbol] = { ...asset, price: newPrice, candles };
      }
      return { assets: next };
    }),

  setLivePrice: (symbol, price) =>
    set((state) => {
      const asset = state.assets[symbol];
      if (!asset) return state;
      const nowBucket = Math.floor(Date.now() / 1000 / CANDLE_SECONDS) * CANDLE_SECONDS;
      const candles = [...asset.candles];
      const last = candles[candles.length - 1];
      if (last && last.time === nowBucket) {
        candles[candles.length - 1] = {
          ...last,
          close: price,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price),
        };
      } else {
        candles.push({ time: nowBucket, open: asset.price, high: Math.max(asset.price, price), low: Math.min(asset.price, price), close: price });
        if (candles.length > HISTORY_LENGTH) candles.shift();
      }
      return { assets: { ...state.assets, [symbol]: { ...asset, price, candles } } };
    }),

  setLiveCandles: (symbol, candles) =>
    set((state) => {
      const asset = state.assets[symbol];
      if (!asset || candles.length === 0) return state;
      return {
        assets: {
          ...state.assets,
          [symbol]: { ...asset, candles, price: candles[candles.length - 1].close },
        },
      };
    }),
}));
