import { useEffect } from 'react';
import { useMarketStore } from '../store/marketStore';

export function useMarketTicker(intervalMs = 1500) {
  const tick = useMarketStore((s) => s.tick);
  useEffect(() => {
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [tick, intervalMs]);
}
