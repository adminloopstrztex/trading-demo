import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  AreaSeries,
  CandlestickSeries,
} from 'lightweight-charts';
import type { Candle } from '../types';

interface LinePoint {
  time: number;
  value: number;
}

type Tool = 'cursor' | 'trend' | 'horizontal' | 'vertical' | 'rect';

interface Anchor {
  time: number;
  price: number;
}

type Drawing =
  | { id: string; type: 'trend'; a: Anchor; b: Anchor }
  | { id: string; type: 'rect'; a: Anchor; b: Anchor }
  | { id: string; type: 'horizontal'; price: number }
  | { id: string; type: 'vertical'; time: number };

const TOOLS: { key: Tool; title: string; path: ReactNode }[] = [
  {
    key: 'cursor',
    title: 'Seleccionar / mover',
    path: <path d="M5 3l14 7-6 2-2 6-6-15z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" fill="none" />,
  },
  {
    key: 'trend',
    title: 'Línea de tendencia',
    path: (
      <>
        <path d="M5 18L19 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="5" cy="18" r="2" fill="currentColor" />
        <circle cx="19" cy="6" r="2" fill="currentColor" />
      </>
    ),
  },
  { key: 'horizontal', title: 'Línea horizontal', path: <path d="M3 12h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /> },
  { key: 'vertical', title: 'Línea vertical', path: <path d="M12 3v18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /> },
  { key: 'rect', title: 'Rectángulo', path: <rect x="4" y="6" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.7" fill="none" /> },
];

const HIT_TOL = 7;
const LINE_COLOR = '#3B82F6';
const SEL_COLOR = '#60A5FA';

export default function TradingChart({
  type,
  line,
  candles,
  positive,
  chartKey,
  decimals = 2,
}: {
  type: 'area' | 'candles';
  line?: LinePoint[];
  candles?: Candle[];
  positive: boolean;
  chartKey: string;
  decimals?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | ISeriesApi<'Candlestick'> | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const timesRef = useRef<number[]>([]);
  const prevKeyRef = useRef<string>('');

  const drawingsRef = useRef<Drawing[]>([]);
  const draftRef = useRef<Drawing | null>(null);
  const selectedRef = useRef<string | null>(null);
  const dragRef = useRef<{ lastTime: number; lastPrice: number } | null>(null);
  const creatingRef = useRef(false);

  const [tool, setToolState] = useState<Tool | null>(null);
  const toolRef = useRef<Tool | null>(null);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [legend, setLegend] = useState<string>('');

  const setTool = (next: Tool | null | ((cur: Tool | null) => Tool | null)) => {
    const resolved = typeof next === 'function' ? next(toolRef.current) : next;
    toolRef.current = resolved;
    setToolState(resolved);
  };

  // ---- time <-> logical interpolation (keeps drawings anchored as data shifts) ----
  function avgStep() {
    const t = timesRef.current;
    if (t.length < 2) return 60;
    return (t[t.length - 1] - t[0]) / (t.length - 1);
  }
  function timeToLogical(time: number) {
    const t = timesRef.current;
    const n = t.length;
    if (n === 0) return 0;
    const step = avgStep();
    if (time <= t[0]) return (time - t[0]) / step;
    if (time >= t[n - 1]) return n - 1 + (time - t[n - 1]) / step;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid] <= time) lo = mid;
      else hi = mid;
    }
    return lo + (time - t[lo]) / (t[lo + 1] - t[lo]);
  }
  function logicalToTime(logical: number) {
    const t = timesRef.current;
    const n = t.length;
    if (n === 0) return 0;
    const step = avgStep();
    if (logical <= 0) return t[0] + logical * step;
    if (logical >= n - 1) return t[n - 1] + (logical - (n - 1)) * step;
    const k = Math.floor(logical);
    return t[k] + (logical - k) * (t[k + 1] - t[k]);
  }

  const toX = (time: number) => {
    const c = chartRef.current?.timeScale().logicalToCoordinate(timeToLogical(time) as never);
    return c ?? null;
  };
  const toY = (price: number) => seriesRef.current?.priceToCoordinate(price) ?? null;
  const fromX = (x: number) => {
    const lg = chartRef.current?.timeScale().coordinateToLogical(x) as number | null;
    return lg == null ? null : logicalToTime(lg);
  };
  const fromY = (y: number) => seriesRef.current?.coordinateToPrice(y) ?? null;

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { color: 'transparent' }, textColor: '#787E8C', attributionLogo: false, fontSize: 11 },
      grid: { vertLines: { color: '#15181E' }, horzLines: { color: '#15181E' } },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      timeScale: { borderColor: '#1E2128', timeVisible: true, secondsVisible: false, rightOffset: 4 },
      rightPriceScale: { borderColor: '#1E2128', scaleMargins: { top: 0.12, bottom: 0.12 } },
      crosshair: {
        mode: 1,
        vertLine: { color: '#4B5563', width: 1, style: 2, labelBackgroundColor: '#2A2F3A' },
        horzLine: { color: '#4B5563', width: 1, style: 2, labelBackgroundColor: '#2A2F3A' },
      },
      handleScroll: false,
      handleScale: false,
    });

    let series: ISeriesApi<'Area'> | ISeriesApi<'Candlestick'>;
    if (type === 'candles') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#16C784',
        downColor: '#FF5C5C',
        borderUpColor: '#16C784',
        borderDownColor: '#FF5C5C',
        wickUpColor: '#16C784',
        wickDownColor: '#FF5C5C',
        priceLineColor: '#4B5563',
      });
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: positive ? '#16C784' : '#FF5C5C',
        topColor: positive ? 'rgba(22,199,132,0.22)' : 'rgba(255,92,92,0.18)',
        bottomColor: 'rgba(0,0,0,0)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }

    chartRef.current = chart;
    seriesRef.current = series;

    if (prevKeyRef.current !== chartKey) {
      drawingsRef.current = [];
      selectedRef.current = null;
      prevKeyRef.current = chartKey;
    }
    draftRef.current = null;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      sizeRef.current = { w, h };
      chart.applyOptions({ width: w, height: h });
      const canvas = canvasRef.current;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      requestAnimationFrame(redraw);
    };
    window.addEventListener('resize', resize);
    resize();

    const onRange = () => requestAnimationFrame(redraw);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

    const onCross = (param: { seriesData: Map<unknown, unknown> }) => {
      const d = param.seriesData.get(series) as
        | { open: number; high: number; low: number; close: number }
        | { value: number }
        | undefined;
      if (!d) {
        setLegend('');
        return;
      }
      if ('open' in d) {
        setLegend(
          `A ${d.open.toFixed(decimals)}  M ${d.high.toFixed(decimals)}  m ${d.low.toFixed(
            decimals
          )}  C ${d.close.toFixed(decimals)}`
        );
      } else {
        setLegend(d.value.toFixed(decimals));
      }
    };
    chart.subscribeCrosshairMove(onCross);

    requestAnimationFrame(redraw);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      chart.unsubscribeCrosshairMove(onCross);
      window.removeEventListener('resize', resize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartKey, type]);

  useEffect(() => {
    if (type === 'area') {
      (seriesRef.current as ISeriesApi<'Area'> | null)?.applyOptions({
        lineColor: positive ? '#16C784' : '#FF5C5C',
        topColor: positive ? 'rgba(22,199,132,0.22)' : 'rgba(255,92,92,0.18)',
      });
    }
  }, [positive, type]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (type === 'candles' && candles) {
      timesRef.current = candles.map((c) => c.time);
      (series as ISeriesApi<'Candlestick'>).setData(
        candles.map((c) => ({ time: c.time as never, open: c.open, high: c.high, low: c.low, close: c.close }))
      );
    } else if (type === 'area' && line) {
      timesRef.current = line.map((p) => p.time);
      (series as ISeriesApi<'Area'>).setData(line.map((p) => ({ time: p.time as never, value: p.value })));
    }
    chartRef.current?.timeScale().fitContent();
    requestAnimationFrame(redraw);
  }, [line, candles, type]);

  function drawSeg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function handle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#0A0B0D';
    ctx.strokeStyle = SEL_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function renderDrawing(ctx: CanvasRenderingContext2D, d: Drawing, sel: boolean) {
    const { w, h } = sizeRef.current;
    ctx.strokeStyle = sel ? SEL_COLOR : LINE_COLOR;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([]);
    if (d.type === 'trend') {
      const x1 = toX(d.a.time), y1 = toY(d.a.price), x2 = toX(d.b.time), y2 = toY(d.b.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      drawSeg(ctx, x1, y1, x2, y2);
      if (sel) { handle(ctx, x1, y1); handle(ctx, x2, y2); }
    } else if (d.type === 'rect') {
      const x1 = toX(d.a.time), y1 = toY(d.a.price), x2 = toX(d.b.time), y2 = toY(d.b.price);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      const rx = Math.min(x1, x2), ry = Math.min(y1, y2), rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
      ctx.fillStyle = sel ? 'rgba(96,165,250,0.10)' : 'rgba(59,130,246,0.10)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      if (sel) { handle(ctx, x1, y1); handle(ctx, x2, y2); }
    } else if (d.type === 'horizontal') {
      const y = toY(d.price);
      if (y == null) return;
      drawSeg(ctx, 0, y, w, y);
      ctx.fillStyle = sel ? SEL_COLOR : LINE_COLOR;
      ctx.font = '10px system-ui';
      ctx.fillText(d.price.toFixed(decimals), 4, y - 4);
      if (sel) handle(ctx, w / 2, y);
    } else if (d.type === 'vertical') {
      const x = toX(d.time);
      if (x == null) return;
      drawSeg(ctx, x, 0, x, h);
      if (sel) handle(ctx, x, h / 2);
    }
  }

  function redraw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { w, h } = sizeRef.current;
    ctx.clearRect(0, 0, w, h);
    for (const d of drawingsRef.current) renderDrawing(ctx, d, d.id === selectedRef.current);
    if (draftRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      renderDrawing(ctx, draftRef.current, false);
      ctx.restore();
    }
  }

  function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function hitTest(px: number, py: number): Drawing | null {
    for (let i = drawingsRef.current.length - 1; i >= 0; i--) {
      const d = drawingsRef.current[i];
      if (d.type === 'trend') {
        const x1 = toX(d.a.time), y1 = toY(d.a.price), x2 = toX(d.b.time), y2 = toY(d.b.price);
        if (x1 != null && y1 != null && x2 != null && y2 != null && distToSeg(px, py, x1, y1, x2, y2) < HIT_TOL) return d;
      } else if (d.type === 'rect') {
        const x1 = toX(d.a.time), y1 = toY(d.a.price), x2 = toX(d.b.time), y2 = toY(d.b.price);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
        const e = [[x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1]];
        if (e.some((s) => distToSeg(px, py, s[0], s[1], s[2], s[3]) < HIT_TOL)) return d;
      } else if (d.type === 'horizontal') {
        const y = toY(d.price);
        if (y != null && Math.abs(py - y) < HIT_TOL) return d;
      } else if (d.type === 'vertical') {
        const x = toX(d.time);
        if (x != null && Math.abs(px - x) < HIT_TOL) return d;
      }
    }
    return null;
  }

  function getPos(e: React.PointerEvent) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const t = toolRef.current;
    if (!t) return;
    const { x, y } = getPos(e);
    const time = fromX(x), price = fromY(y);
    if (time == null || price == null) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    if (t === 'cursor') {
      const hit = hitTest(x, y);
      selectedRef.current = hit ? hit.id : null;
      dragRef.current = hit ? { lastTime: time, lastPrice: price } : null;
      rerender();
      redraw();
      return;
    }
    const id = crypto.randomUUID();
    if (t === 'horizontal') {
      drawingsRef.current.push({ id, type: 'horizontal', price });
      selectedRef.current = id;
      setTool('cursor');
      redraw();
      return;
    }
    if (t === 'vertical') {
      drawingsRef.current.push({ id, type: 'vertical', time });
      selectedRef.current = id;
      setTool('cursor');
      redraw();
      return;
    }
    creatingRef.current = true;
    draftRef.current = { id, type: t, a: { time, price }, b: { time, price } };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const t = toolRef.current;
    if (!t) return;
    const { x, y } = getPos(e);
    const time = fromX(x), price = fromY(y);
    if (time == null || price == null) return;

    if (creatingRef.current && draftRef.current && (draftRef.current.type === 'trend' || draftRef.current.type === 'rect')) {
      draftRef.current.b = { time, price };
      redraw();
      return;
    }
    if (t === 'cursor' && dragRef.current && selectedRef.current) {
      const dt = time - dragRef.current.lastTime;
      const dp = price - dragRef.current.lastPrice;
      const d = drawingsRef.current.find((z) => z.id === selectedRef.current);
      if (d) {
        if (d.type === 'trend' || d.type === 'rect') {
          d.a = { time: d.a.time + dt, price: d.a.price + dp };
          d.b = { time: d.b.time + dt, price: d.b.price + dp };
        } else if (d.type === 'horizontal') d.price += dp;
        else if (d.type === 'vertical') d.time += dt;
      }
      dragRef.current = { lastTime: time, lastPrice: price };
      redraw();
    }
  }

  function onPointerUp() {
    if (creatingRef.current && draftRef.current) {
      const d = draftRef.current;
      if (d.type === 'trend' || d.type === 'rect') {
        const x1 = toX(d.a.time), x2 = toX(d.b.time), y1 = toY(d.a.price), y2 = toY(d.b.price);
        if (x1 != null && x2 != null && y1 != null && y2 != null && Math.hypot(x2 - x1, y2 - y1) > 4) {
          drawingsRef.current.push(d);
          selectedRef.current = d.id;
          setTool('cursor');
        }
      }
      draftRef.current = null;
      creatingRef.current = false;
    }
    dragRef.current = null;
    redraw();
  }

  function deleteSelected() {
    if (selectedRef.current) {
      drawingsRef.current = drawingsRef.current.filter((d) => d.id !== selectedRef.current);
      selectedRef.current = null;
    } else {
      drawingsRef.current = [];
    }
    rerender();
    redraw();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'Escape') {
        setTool(null);
        selectedRef.current = null;
        draftRef.current = null;
        creatingRef.current = false;
        rerender();
        redraw();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = tool !== null;
  const cursorClass = tool === null ? '' : tool === 'cursor' ? 'cursor-default' : 'cursor-crosshair';

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${cursorClass} ${active ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {legend && (
        <div className="absolute top-2 left-14 z-10 text-[11px] font-mono text-[#B8BFCC] bg-[#0F1115]/80 border border-[#1E2128] rounded px-2 py-0.5 pointer-events-none">
          {legend}
        </div>
      )}

      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 bg-[#0F1115]/90 backdrop-blur border border-[#1E2128] rounded-xl p-1">
        {TOOLS.map((tl) => (
          <button
            key={tl.key}
            title={tl.title}
            onClick={() => {
              setTool((cur) => (cur === tl.key ? null : tl.key));
              if (tl.key !== 'cursor') {
                selectedRef.current = null;
                rerender();
              }
              redraw();
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              tool === tl.key ? 'bg-[#3B82F6] text-white' : 'text-[#8B92A0] hover:bg-white/5'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              {tl.path}
            </svg>
          </button>
        ))}
        <div className="h-px bg-[#1E2128] my-0.5" />
        <button
          title="Borrar (selección o todo)"
          onClick={deleteSelected}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B92A0] hover:bg-[#FF5C5C]/15 hover:text-[#FF5C5C]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M5 7h14M10 7V5h4v2M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {active && (
        <div className="absolute top-2 right-3 z-10 text-[11px] text-[#8B92A0] bg-[#0F1115]/90 border border-[#1E2128] rounded-lg px-2 py-1">
          {tool === 'cursor' ? 'Clic para seleccionar · arrastra para mover · Supr para borrar' : 'Arrastra sobre el gráfico · Esc para salir'}
        </div>
      )}
    </div>
  );
}
