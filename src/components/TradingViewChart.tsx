import { useEffect, useRef } from 'react';

// Minimal typing for the global injected by tv.js
declare global {
  interface Window {
    TradingView?: { widget: new (config: Record<string, unknown>) => unknown };
  }
}

const TV_SRC = 'https://s3.tradingview.com/tv.js';
let loadingPromise: Promise<void> | null = null;

function loadTradingView(): Promise<void> {
  if (window.TradingView) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TV_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('No se pudo cargar TradingView'));
    document.head.appendChild(s);
  });
  return loadingPromise;
}

// Full TradingView advanced chart (drawing toolbar, indicators, timeframes, etc.).
// Note: shows TradingView's own market data for the symbol — it's a display widget,
// separate from the simulator's own prices and orders.
export default function TradingViewChart({ symbol, interval = 'D' }: { symbol: string; interval?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`tv_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;
    loadTradingView()
      .then(() => {
        if (cancelled || !ref.current || !window.TradingView) return;
        ref.current.innerHTML = '';
        new window.TradingView.widget({
          autosize: true,
          symbol,
          interval,
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'es',
          toolbar_bg: '#0F1115',
          backgroundColor: '#0F1115',
          gridColor: 'rgba(30,33,40,0.6)',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: false,
          withdateranges: true,
          studies: ['Volume@tv-basicstudies'],
          container_id: idRef.current,
        });
      })
      .catch(() => {
        if (ref.current)
          ref.current.innerHTML =
            '<div style="color:#8B92A0;font-size:13px;padding:16px">No se pudo cargar el gráfico de TradingView. Revisa tu conexión.</div>';
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  return <div id={idRef.current} ref={ref} className="w-full h-full" />;
}
