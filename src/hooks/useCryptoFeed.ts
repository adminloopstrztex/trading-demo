import { useEffect } from 'react';
import { useMarketStore } from '../store/marketStore';
import { fetchCryptoPrices, fetchCryptoCandles } from '../data/cryptoFeed';

// Polls real crypto prices from CoinGecko. Free tier is rate-limited, so we
// poll gently (every 20s) and let the simulator handle the other assets.
export function useCryptoFeed(intervalMs = 20000) {
  const assets = useMarketStore((s) => s.assets);
  const setLivePrice = useMarketStore((s) => s.setLivePrice);
  const setLiveCandles = useMarketStore((s) => s.setLiveCandles);

  useEffect(() => {
    const liveSymbols = Object.values(assets)
      .filter((a) => a.source === 'live')
      .map((a) => a.symbol);
    if (liveSymbols.length === 0) return;

    let cancelled = false;

    async function poll() {
      try {
        const prices = await fetchCryptoPrices(liveSymbols);
        if (cancelled) return;
        for (const symbol in prices) setLivePrice(symbol, prices[symbol]);
      } catch {
        // network/rate-limit error: keep last known prices, retry next interval
      }
    }

    async function loadInitialCandles() {
      for (const symbol of liveSymbols) {
        try {
          const candles = await fetchCryptoCandles(symbol, 1);
          if (cancelled) return;
          setLiveCandles(symbol, candles);
        } catch {
          // keep placeholder candles on failure
        }
      }
    }

    loadInitialCandles();
    poll();
    const handle = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
    // run once on mount; asset symbols are static
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, setLivePrice, setLiveCandles]);
}
