import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { fetchCryptoCandles, fetchCrypto24h } from '../data/cryptoFeed';

interface OHLC {
  open: number;
  high: number;
  low: number;
  close: number;
}
interface Stat {
  price: number;
  changePct: number;
}

function fmtUsd(n: number, dec = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Pulls real BTC data from Binance for the hero; faux data stays as the fallback
// so the marketing page never breaks if the network/API is unavailable.
function useLiveMarket() {
  const [candles, setCandles] = useState<OHLC[] | null>(null);
  const [stats, setStats] = useState<Record<string, Stat>>({});

  useEffect(() => {
    let alive = true;
    fetchCryptoCandles('BTCUSD', 1)
      .then((c) => {
        if (alive && c.length)
          setCandles(c.map((k) => ({ open: k.open, high: k.high, low: k.low, close: k.close })));
      })
      .catch(() => {});

    const pull = () =>
      fetchCrypto24h(['BTCUSD', 'ETHUSD', 'SOLUSD'])
        .then((st) => {
          if (alive && Object.keys(st).length) setStats(st);
        })
        .catch(() => {});
    pull();
    const id = setInterval(pull, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return { candles, stats, btc: stats.BTCUSD ?? null };
}

/* ------------------------------------------------------------------ */
/*  Motion helpers                                                     */
/* ------------------------------------------------------------------ */

// Enable JS-driven scroll reveals only when motion is allowed. Content is
// visible by default (see index.css), so nothing depends on this to render.
function useJsMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const root = document.documentElement;
    root.classList.add('js-motion');
    return () => root.classList.remove('js-motion');
  }, []);
}

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reveal = () => el.classList.add('is-in');
    // Reveal immediately if already on screen at mount (covers above-the-fold
    // content and environments where IntersectionObserver never fires).
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    };
    if (inView()) {
      reveal();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            reveal();
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    // Safety net: never leave a section hidden if the observer never fires.
    const fallback = window.setTimeout(reveal, 1200);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
  return (
    <div ref={ref} data-reveal className={className} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Faux market data (marketing visuals only — not a live feed)        */
/* ------------------------------------------------------------------ */

// A believable uptrend with pullbacks: [open, high, low, close].
const CANDLES: [number, number, number, number][] = [
  [100, 103, 99, 102], [102, 104, 100, 101], [101, 106, 101, 105], [105, 108, 104, 104],
  [104, 105, 100, 101], [101, 107, 100, 106], [106, 110, 105, 109], [109, 111, 107, 108],
  [108, 109, 103, 104], [104, 108, 103, 107], [107, 113, 106, 112], [112, 115, 111, 111],
  [111, 112, 106, 107], [107, 114, 107, 113], [113, 118, 112, 117], [117, 120, 115, 116],
  [116, 117, 111, 112], [112, 119, 112, 118], [118, 124, 117, 123], [123, 126, 121, 122],
  [122, 123, 117, 119], [119, 127, 118, 126], [126, 131, 125, 130], [130, 134, 128, 133],
];

const FAUX_CANDLES: OHLC[] = CANDLES.map(([open, high, low, close]) => ({ open, high, low, close }));

function CandleChart({ candles = FAUX_CANDLES }: { candles?: OHLC[] }) {
  const W = 520;
  const H = 210;
  const padY = 14;
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;
  const step = W / candles.length;
  const bodyW = step * 0.56;
  const y = (v: number) => padY + ((max - v) / range) * (H - padY * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto strx-draw" role="img" aria-label="Gráfico de velas de BTC">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={padY + f * (H - padY * 2)} y2={padY + f * (H - padY * 2)} stroke="#15181E" strokeWidth="1" />
      ))}
      {candles.map(({ open: o, high: h, low: l, close: c }, i) => {
        const up = c >= o;
        const color = up ? '#16C784' : '#FF5C5C';
        const cx = i * step + step / 2;
        const top = y(Math.max(o, c));
        const bot = y(Math.min(o, c));
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(h)} y2={y(l)} stroke={color} strokeWidth="1.25" />
            <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(1.5, bot - top)} rx="1.5" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

const TAPE = [
  { s: 'BTC', n: 'Bitcoin', p: '67,240.10', c: '+3.12%', up: true, live: true },
  { s: 'ETH', n: 'Ethereum', p: '3,512.44', c: '+1.87%', up: true, live: true },
  { s: 'SOL', n: 'Solana', p: '178.90', c: '-0.94%', up: false, live: true },
  { s: 'AAPL', n: 'Apple', p: '224.31', c: '+0.61%', up: true, live: false },
  { s: 'TSLA', n: 'Tesla', p: '251.08', c: '-1.22%', up: false, live: false },
  { s: 'NVDA', n: 'NVIDIA', p: '128.44', c: '+2.40%', up: true, live: false },
  { s: 'XAU', n: 'Oro', p: '2,388.70', c: '+0.35%', up: true, live: false },
  { s: 'EURUSD', n: 'Euro / USD', p: '1.0842', c: '-0.08%', up: false, live: false },
];

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

function Coin({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const map: Record<string, { bg: string; fg: string; ch: string }> = {
    BTC: { bg: '#F7931A22', fg: '#F7931A', ch: '₿' },
    ETH: { bg: '#627EEA22', fg: '#8AA0F0', ch: 'Ξ' },
    SOL: { bg: '#14F1953a', fg: '#14F195', ch: 'S' },
  };
  const m = map[symbol] ?? { bg: '#16C78422', fg: '#16C784', ch: symbol[0] };
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, background: m.bg, color: m.fg, fontSize: size * 0.44 }}
    >
      {m.ch}
    </span>
  );
}

function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#1E2128] bg-[#0A0B0D]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" aria-label="Inicio de Stratex">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-[#B8BFCC] md:flex">
          <a href="#producto" className="transition hover:text-[#F2F3F5]">Producto</a>
          <a href="#como-funciona" className="transition hover:text-[#F2F3F5]">Cómo funciona</a>
          <a href="#faq" className="transition hover:text-[#F2F3F5]">Preguntas</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-[#B8BFCC] transition hover:text-[#F2F3F5]">
            Entrar
          </Link>
          <Link
            to="/login"
            state={{ mode: 'register' }}
            className="rounded-lg bg-[#16C784] px-3.5 py-2 text-sm font-semibold text-[#0A0B0D] transition hover:bg-[#13B374] sm:px-4"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero({ live }: { live: { candles: OHLC[] | null; stats: Record<string, Stat>; btc: Stat | null } }) {
  const btc = live.btc;
  const up = btc ? btc.changePct >= 0 : true;
  const priceNum = btc ? btc.price : 67240.1;
  const changePct = btc ? btc.changePct : 3.12;
  return (
    <section className="relative overflow-hidden">
      {/* Crypto scene background (real image) + scrims that hide the logo baked
          into the image's centre and keep the copy readable. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 bg-cover"
          style={{ backgroundImage: 'url(/hero-bg.jpg)', backgroundPosition: '78% center' }}
        />
        {/* Left-weighted scrim: dark under the copy, lighter over the market visuals on the right. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,11,13,0.97) 0%, rgba(10,11,13,0.93) 48%, rgba(10,11,13,0.76) 66%, rgba(10,11,13,0.46) 82%, rgba(10,11,13,0.74) 100%)',
          }}
        />
        {/* Vertical blend into the navbar (top) and the ticker tape (bottom). */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,11,13,0.82) 0%, rgba(10,11,13,0.22) 32%, rgba(10,11,13,0.32) 68%, #0A0B0D 100%)',
          }}
        />
        {/* Soft dark blob to smother the logo baked into the centre of the image. */}
        <div className="absolute left-1/2 top-1/2 h-[540px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0A0B0D]/92 blur-[80px]" />
        {/* Subtle brand glow. */}
        <div className="absolute left-1/2 top-[-12%] h-[520px] w-[880px] -translate-x-1/2 rounded-full bg-[#16C784]/10 blur-[130px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-16 pt-16 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-24">
        {/* Copy */}
        <div>
          <span
            className="strx-rise inline-flex items-center gap-2 rounded-full border border-[#262A33] bg-[#101216] px-3 py-1 text-xs font-medium text-[#B8BFCC]"
            style={{ '--rise-delay': '0ms' } as CSSProperties}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#16C784] strx-pulse" />
            Cripto, acciones y forex · Precios en tiempo real
          </span>

          <h1
            className="strx-rise mt-6 text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.03] tracking-[-0.03em] text-[#F2F3F5]"
            style={{ '--rise-delay': '80ms', textWrap: 'balance' } as CSSProperties}
          >
            Opera los mercados del mundo, en tiempo real.
          </h1>

          <p
            className="strx-rise mt-5 max-w-xl text-[17px] leading-relaxed text-[#B8BFCC]"
            style={{ '--rise-delay': '160ms' } as CSSProperties}
          >
            Cripto, acciones, forex y materias primas en una sola plataforma. Gráficos profesionales,
            órdenes avanzadas y tu portafolio en tiempo real. Abre tu cuenta y empieza con{' '}
            <span className="font-medium text-[#F2F3F5]">$10,000 en fondos de práctica</span>.
          </p>

          <div className="strx-rise mt-8 flex flex-wrap items-center gap-3" style={{ '--rise-delay': '240ms' } as CSSProperties}>
            <Link
              to="/login"
              state={{ mode: 'register' }}
              className="rounded-xl bg-[#16C784] px-5 py-3 text-sm font-semibold text-[#0A0B0D] transition hover:bg-[#13B374]"
            >
              Empezar gratis
            </Link>
            <a
              href="#producto"
              className="rounded-xl border border-[#262A33] px-5 py-3 text-sm font-semibold text-[#F2F3F5] transition hover:border-[#3a404b] hover:bg-white/[0.03]"
            >
              Ver el producto
            </a>
          </div>

          <div
            className="strx-rise mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8B92A0]"
            style={{ '--rise-delay': '300ms' } as CSSProperties}
          >
            {['Sin tarjeta de crédito', 'Gratis para siempre', 'Datos reales de mercado'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#16C784]">
                  <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </span>
            ))}
          </div>

          <dl
            className="strx-rise mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-[#1E2128] pt-6"
            style={{ '--rise-delay': '320ms' } as CSSProperties}
          >
            {[
              ['40+', 'mercados disponibles'],
              ['Tiempo real', 'datos de mercado'],
              ['0%', 'comisiones'],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-mono text-xl font-semibold text-[#F2F3F5]">{v}</dt>
                <dd className="mt-0.5 text-xs text-[#8B92A0]">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Product mock — live trading terminal */}
        <div className="strx-rise relative" style={{ '--rise-delay': '200ms' } as CSSProperties}>
          <TradingTerminal candles={live.candles} price={priceNum} changePct={changePct} up={up} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Live trading terminal (hero mock)                                  */
/* ------------------------------------------------------------------ */

function fmt(n: number, dec = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Tiny deterministic PRNG so the order book is stable across renders (seeded by
// the integer price) but shifts as the live price moves — reads as real depth.
function seeded(seed: number, i: number) {
  const x = Math.sin(seed * 0.017 + i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Background flash when the tracked value ticks up or down.
function useTickFlash(value: number) {
  const prev = useRef(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    const p = prev.current;
    prev.current = value;
    if (value === p) return;
    setDir(value > p ? 'up' : 'down');
    const t = window.setTimeout(() => setDir(null), 600);
    return () => window.clearTimeout(t);
  }, [value]);
  return dir;
}

const TF = ['15m', '1H', '4H', '1D', '1S'];
const TERMINAL_TABS = [
  { s: 'BTC', pair: 'BTC/USDT' },
  { s: 'ETH', pair: 'ETH/USDT' },
  { s: 'SOL', pair: 'SOL/USDT' },
];

function TradingTerminal({
  candles,
  price,
  changePct,
  up,
}: {
  candles: OHLC[] | null;
  price: number;
  changePct: number;
  up: boolean;
}) {
  const flash = useTickFlash(price);
  const dir = up ? '#16C784' : '#FF5C5C';
  const high = price * 1.028;
  const low = price * 0.981;
  const vol = price * 18.4; // BTC-notional 24h volume, plausible mock

  return (
    <div className="overflow-hidden rounded-2xl border border-[#1E2128] bg-[#0D0F13] shadow-[0_30px_80px_-30px_#000]">
      {/* window bar with symbol tabs */}
      <div className="flex items-center gap-3 border-b border-[#1E2128] bg-[#0F1115] px-3 py-2">
        <div className="flex items-center gap-1.5 pr-1">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5C5C]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#E8B339]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#16C784]/70" />
        </div>
        <div className="flex items-center gap-1">
          {TERMINAL_TABS.map((t, i) => (
            <span
              key={t.s}
              className={`rounded-md px-2 py-1 font-mono text-[11px] ${
                i === 0 ? 'bg-[#16181C] text-[#F2F3F5]' : 'text-[#5B6472]'
              }`}
            >
              {t.pair}
            </span>
          ))}
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded bg-[#16C784]/12 px-1.5 py-0.5 text-[9px] font-semibold text-[#16C784]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16C784] strx-pulse" />
          EN VIVO
        </span>
      </div>

      {/* instrument header: price + 24h stats */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-[#1E2128] px-4 py-3">
        <div className="flex items-center gap-3">
          <Coin symbol="BTC" size={34} />
          <div>
            <div className="text-sm font-medium text-[#F2F3F5]">BTC/USDT</div>
            <div className="text-[11px] text-[#8B92A0]">Bitcoin · Spot</div>
          </div>
        </div>
        <div>
          <div
            className={`rounded px-1 font-mono text-2xl font-semibold tabular-nums ${flash === 'up' ? 'strx-flash-up' : flash === 'down' ? 'strx-flash-down' : ''}`}
            style={{ color: dir }}
          >
            {fmt(price)}
          </div>
          <div className="font-mono text-xs font-medium" style={{ color: dir }}>
            {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% · 24h
          </div>
        </div>
        <div className="ml-auto hidden grid-cols-3 gap-x-5 sm:grid">
          <Stat label="Máx 24h" value={fmt(high)} />
          <Stat label="Mín 24h" value={fmt(low)} />
          <Stat label="Vol 24h" value={`${fmt(vol / 1000, 1)}K`} />
        </div>
      </div>

      {/* body: chart + order book */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_150px]">
        <div className="border-b border-[#1E2128] p-3 md:border-b-0 md:border-r">
          <div className="mb-2 flex items-center gap-1">
            {TF.map((t, i) => (
              <span
                key={t}
                className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${
                  i === 3 ? 'bg-[#16C784]/15 text-[#16C784]' : 'text-[#5B6472]'
                }`}
              >
                {t}
              </span>
            ))}
            <span className="ml-auto font-mono text-[10px] text-[#5B6472]">O 67.1K · H 68.2K · L 66.9K</span>
          </div>
          <CandleChart candles={candles ?? undefined} />
        </div>
        <OrderBook mid={price} />
      </div>

      {/* trade panel */}
      <div className="flex items-center gap-2 border-t border-[#1E2128] px-3 py-3">
        <div className="flex flex-1 rounded-lg bg-[#0A0B0D] p-1 text-center text-xs font-semibold">
          <span className="flex-1 rounded-md bg-[#16C784] py-1.5 text-[#0A0B0D]">Comprar</span>
          <span className="flex-1 py-1.5 text-[#8B92A0]">Vender</span>
        </div>
        <div className="flex items-center rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 font-mono text-sm">
          <span className="mr-1 text-[#5B6472]">$</span>
          <span className="text-[#F2F3F5]">500.00</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-[#5B6472]">{label}</div>
      <div className="font-mono text-xs font-medium text-[#B8BFCC] tabular-nums">{value}</div>
    </div>
  );
}

function OrderBook({ mid }: { mid: number }) {
  const rows = 6;
  const step = mid * 0.00045;
  const seed = Math.floor(mid);
  // nearest → farthest
  const asks = Array.from({ length: rows }, (_, i) => ({
    price: mid + step * (i + 1),
    size: 0.04 + seeded(seed, i + 1) * 1.15,
  }));
  const bids = Array.from({ length: rows }, (_, i) => ({
    price: mid - step * (i + 1),
    size: 0.04 + seeded(seed, i + 40) * 1.15,
  }));
  const maxSize = Math.max(...asks.map((r) => r.size), ...bids.map((r) => r.size));

  const Row = ({ price, size, side }: { price: number; size: number; side: 'ask' | 'bid' }) => {
    const color = side === 'ask' ? '#FF5C5C' : '#16C784';
    return (
      <div className="relative grid grid-cols-2 px-2.5 py-[3px] font-mono text-[10px] tabular-nums">
        <div
          className="absolute inset-y-0 right-0"
          style={{ width: `${(size / maxSize) * 100}%`, background: `${color}14` }}
        />
        <span className="relative" style={{ color }}>
          {fmt(price, 1)}
        </span>
        <span className="relative text-right text-[#8B92A0]">{size.toFixed(3)}</span>
      </div>
    );
  };

  return (
    <div className="hidden flex-col py-2 md:flex">
      <div className="flex justify-between px-2.5 pb-1 font-mono text-[9px] uppercase tracking-wide text-[#5B6472]">
        <span>Precio</span>
        <span>Tamaño</span>
      </div>
      {[...asks].reverse().map((r, i) => (
        <Row key={`a${i}`} {...r} side="ask" />
      ))}
      <div className="my-1 px-2.5 font-mono text-xs font-semibold tabular-nums" style={{ color: '#16C784' }}>
        {fmt(mid, 1)}
        <span className="ml-1 text-[9px] font-normal text-[#5B6472]">≈ spread 0.02%</span>
      </div>
      {bids.map((r, i) => (
        <Row key={`b${i}`} {...r} side="bid" />
      ))}
    </div>
  );
}

function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#1E2128] bg-[#101216] shadow-[0_30px_80px_-30px_#000]">
      <div className="flex items-center gap-2 border-b border-[#1E2128] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#FF5C5C]/70" />
        <span className="h-3 w-3 rounded-full bg-[#E8B339]/70" />
        <span className="h-3 w-3 rounded-full bg-[#16C784]/70" />
        <div className="ml-3 flex-1 truncate rounded-md bg-[#0A0B0D] px-3 py-1 text-center font-mono text-[11px] text-[#8B92A0]">
          {url}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ticker tape                                                        */
/* ------------------------------------------------------------------ */

const TAPE_KEY: Record<string, string> = { BTC: 'BTCUSD', ETH: 'ETHUSD', SOL: 'SOLUSD' };

function Tape({ live }: { live: Record<string, Stat> }) {
  const merged = TAPE.map((t) => {
    const st = TAPE_KEY[t.s] ? live[TAPE_KEY[t.s]] : undefined;
    if (!st) return t;
    return { ...t, p: fmtUsd(st.price), c: `${st.changePct >= 0 ? '+' : ''}${st.changePct.toFixed(2)}%`, up: st.changePct >= 0 };
  });
  const items = [...merged, ...merged];
  return (
    <div className="relative overflow-hidden border-y border-[#1E2128] bg-[#0F1115] py-3">
      <div className="strx-marquee flex w-max gap-8" style={{ '--marquee-dur': '46s' } as CSSProperties}>
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5 whitespace-nowrap px-1">
            <span className="text-sm font-medium text-[#F2F3F5]">{t.s}</span>
            {t.live && <span className="h-1.5 w-1.5 rounded-full bg-[#16C784] strx-pulse" />}
            <span className="font-mono text-sm text-[#B8BFCC]">{t.p}</span>
            <span className={`font-mono text-xs font-medium ${t.up ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}>{t.c}</span>
            <span className="ml-2 h-4 w-px bg-[#1E2128]" />
          </div>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0F1115] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0F1115] to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Features (bento, varied sizes)                                     */
/* ------------------------------------------------------------------ */

function Features() {
  return (
    <section id="producto" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <h2 className="max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]" style={{ textWrap: 'balance' }}>
          Todo lo que necesitas para operar.
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#B8BFCC]">
          Gráficos en tiempo real, órdenes avanzadas y control total de tu portafolio. Una plataforma
          pensada para operar en serio.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {/* Big tile: live chart */}
        <Reveal className="md:col-span-2" delay={0}>
          <div className="flex h-full flex-col justify-between rounded-2xl border border-[#1E2128] bg-[#101216] p-6 sm:p-7">
            <div>
              <h3 className="text-lg font-semibold text-[#F2F3F5]">Datos de mercado en tiempo real</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-[#B8BFCC]">
                BTC, ETH y SOL con precios en vivo desde Binance, más acciones, forex y materias
                primas. El pulso del mercado, al instante y en un solo lugar.
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-[#1E2128] bg-[#0A0B0D] p-4">
              <CandleChart />
            </div>
          </div>
        </Reveal>

        {/* Tall tile: orders */}
        <Reveal delay={80}>
          <div className="flex h-full flex-col rounded-2xl border border-[#1E2128] bg-[#101216] p-6 sm:p-7">
            <h3 className="text-lg font-semibold text-[#F2F3F5]">Órdenes reales</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#B8BFCC]">
              Mercado, límite y stop. Programa un precio objetivo y la orden se ejecuta sola cuando el
              mercado lo alcanza.
            </p>
            <div className="mt-5 space-y-2">
              {[
                ['Límite · Compra', 'BTC a 64,000', '#16C784'],
                ['Stop · Venta', 'ETH a 3,200', '#FF5C5C'],
                ['Mercado · Compra', 'SOL a 178.90', '#16C784'],
              ].map(([label, detail, color]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2.5">
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                  <span className="font-mono text-xs text-[#8B92A0]">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Three even tiles */}
        {[
          {
            t: 'Portafolio en tiempo real',
            d: 'Tu patrimonio, efectivo y rendimiento (P&L) se actualizan con cada movimiento del mercado.',
          },
          {
            t: 'Gráficos profesionales',
            d: 'Velas japonesas con herramientas de dibujo ancladas a precio y tiempo, como en las plataformas reales.',
          },
          {
            t: 'Acceso seguro',
            d: 'Sesión protegida y tus operaciones siempre sincronizadas. Entra desde el navegador, en cualquier dispositivo.',
          },
        ].map((f, i) => (
          <Reveal key={f.t} delay={i * 80}>
            <div className="h-full rounded-2xl border border-[#1E2128] bg-[#101216] p-6">
              <h3 className="text-base font-semibold text-[#F2F3F5]">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#B8BFCC]">{f.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  How it works                                                       */
/* ------------------------------------------------------------------ */

function Steps() {
  const steps = [
    { n: '01', t: 'Crea tu cuenta', d: 'Solo un correo y una contraseña. Sin tarjeta, gratis, en segundos.' },
    { n: '02', t: 'Empieza con $10,000', d: 'Recibes fondos de práctica para operar desde el primer minuto. Reiníciralos cuando quieras.' },
    { n: '03', t: 'Opera en los mercados', d: 'Compra, vende, coloca órdenes límite y stop, y sigue tu rendimiento en tiempo real.' },
  ];
  return (
    <section id="como-funciona" className="border-y border-[#1E2128] bg-[#0F1115]">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]">
            Estás operando en un minuto.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="relative">
                <span className="font-mono text-sm font-semibold text-[#16C784]">{s.n}</span>
                <div className="mt-3 h-px w-full bg-[#1E2128]" />
                <h3 className="mt-4 text-xl font-semibold text-[#F2F3F5]">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#B8BFCC]">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Honesty band                                                       */
/* ------------------------------------------------------------------ */

interface BoardRow {
  cat: string;
  sym: string;
  name: string;
  liveKey?: string;
  price: number;
  chg: number;
  dec: number;
}
const BOARD: BoardRow[] = [
  { cat: 'Cripto', sym: 'BTC', name: 'Bitcoin', liveKey: 'BTCUSD', price: 67240.1, chg: 3.12, dec: 2 },
  { cat: 'Cripto', sym: 'ETH', name: 'Ethereum', liveKey: 'ETHUSD', price: 3512.44, chg: 1.87, dec: 2 },
  { cat: 'Cripto', sym: 'SOL', name: 'Solana', liveKey: 'SOLUSD', price: 178.9, chg: 2.44, dec: 2 },
  { cat: 'Acciones', sym: 'AAPL', name: 'Apple', price: 224.31, chg: 0.61, dec: 2 },
  { cat: 'Acciones', sym: 'TSLA', name: 'Tesla', price: 251.08, chg: -1.22, dec: 2 },
  { cat: 'Acciones', sym: 'NVDA', name: 'NVIDIA', price: 128.44, chg: 2.4, dec: 2 },
  { cat: 'Forex', sym: 'EUR/USD', name: 'Euro · Dólar', price: 1.0842, chg: -0.08, dec: 4 },
  { cat: 'Forex', sym: 'GBP/USD', name: 'Libra · Dólar', price: 1.2618, chg: 0.12, dec: 4 },
  { cat: 'Materias', sym: 'XAU', name: 'Oro', price: 2388.7, chg: 0.35, dec: 2 },
  { cat: 'Materias', sym: 'WTI', name: 'Petróleo', price: 78.42, chg: -0.54, dec: 2 },
];

// Deterministic sparkline per symbol (stable across renders; biased to match the trend).
function sparkPoints(seed: string, up: boolean, W = 76, H = 26, n = 26): string {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    a ^= seed.charCodeAt(i);
    a = Math.imul(a, 16777619);
  }
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  const vals: number[] = [];
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.5) * 0.2 + (up ? 0.012 : -0.012);
    v = Math.max(0.1, Math.min(0.9, v));
    vals.push(v);
  }
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const rng = max - min || 1;
  return vals.map((x, i) => `${((i / (n - 1)) * W).toFixed(1)},${(H - ((x - min) / rng) * H).toFixed(1)}`).join(' ');
}

function BoardRowView({ r, live }: { r: BoardRow; live?: Stat }) {
  const price = live ? live.price : r.price;
  const chg = live ? live.changePct : r.chg;
  const up = chg >= 0;
  const color = up ? '#16C784' : '#FF5C5C';
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] sm:grid-cols-[1.4fr_auto_88px_92px]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#16C784]/10 font-mono text-xs font-semibold text-[#16C784]">
          {r.sym.slice(0, 2)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#F2F3F5]">{r.sym}</span>
            {live && (
              <span className="h-1.5 w-1.5 rounded-full bg-[#16C784] strx-pulse" title="En vivo" />
            )}
          </div>
          <div className="truncate text-xs text-[#8B92A0]">{r.name}</div>
        </div>
      </div>
      <svg viewBox="0 0 76 26" className="hidden h-6 w-[76px] sm:block" aria-hidden preserveAspectRatio="none">
        <polyline points={sparkPoints(r.sym, up)} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      </svg>
      <div className="hidden text-right font-mono text-sm text-[#F2F3F5] sm:block">
        {price.toLocaleString('en-US', { minimumFractionDigits: r.dec, maximumFractionDigits: r.dec })}
      </div>
      <div className="text-right font-mono text-sm font-medium" style={{ color }}>
        {up ? '+' : ''}
        {chg.toFixed(2)}%
      </div>
    </div>
  );
}

function Markets({ live }: { live: Record<string, Stat> }) {
  const cats = ['Cripto', 'Acciones', 'Forex', 'Materias'];
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]" style={{ textWrap: 'balance' }}>
            Todos los mercados, en un solo lugar.
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-[#8B92A0]">
            Cripto, acciones, forex y materias primas — diversifica sin cambiar de plataforma.
          </p>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-10 overflow-hidden rounded-2xl border border-[#1E2128] bg-[#101216]">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#1E2128] px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-[#5B6472] sm:grid-cols-[1.4fr_auto_88px_92px]">
            <span>Instrumento</span>
            <span className="hidden text-right sm:block">Tendencia</span>
            <span className="hidden text-right sm:block">Precio</span>
            <span className="text-right">24h</span>
          </div>
          {cats.map((cat) => (
            <div key={cat}>
              <div className="border-b border-[#15181E] bg-[#0D0F13] px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[#5B6472]">
                {cat === 'Materias' ? 'Materias primas' : cat}
                {cat === 'Cripto' && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-semibold text-[#16C784]">
                    <span className="h-1 w-1 rounded-full bg-[#16C784] strx-pulse" /> en vivo
                  </span>
                )}
              </div>
              {BOARD.filter((r) => r.cat === cat).map((r) => (
                <div key={r.sym} className="border-b border-[#15181E] last:border-0">
                  <BoardRowView r={r} live={r.liveKey ? live[r.liveKey] : undefined} />
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-[#5B6472]">
            <span><span className="font-mono text-[#8B92A0]">40+</span> instrumentos disponibles</span>
            <span>Cripto con precios reales desde Binance</span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ                                                                */
/* ------------------------------------------------------------------ */

const FAQS = [
  ['¿Qué puedo operar en Stratex?', 'Criptomonedas con precios en vivo (BTC, ETH, SOL), además de acciones, forex y materias primas — todo desde una sola cuenta.'],
  ['¿Necesito depositar dinero para empezar?', 'No. Abres tu cuenta y empiezas con $10,000 en fondos de práctica para operar desde el primer minuto.'],
  ['¿Los precios del mercado son reales?', 'Sí. Las criptomonedas usan precios en tiempo real desde Binance. El resto de mercados se mueve con un modelo de precios en vivo.'],
  ['¿Qué tipos de órdenes puedo usar?', 'Órdenes de mercado, límite y stop. Programa un precio objetivo y tu orden se ejecuta automáticamente al alcanzarlo.'],
  ['¿Tiene comisiones?', 'No. Operar en Stratex no tiene comisiones ni costos ocultos.'],
  ['¿Puedo usarla desde el móvil?', 'Sí. Stratex funciona en el navegador y se adapta a cualquier dispositivo, con tu cuenta siempre sincronizada.'],
];

function Faq() {
  return (
    <section id="faq" className="border-t border-[#1E2128]">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-24">
        <Reveal>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]">Preguntas frecuentes</h2>
        </Reveal>
        <div className="mt-10 divide-y divide-[#1E2128] border-y border-[#1E2128]">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-medium text-[#F2F3F5] marker:hidden">
                {q}
                <span className="text-[#8B92A0] transition-transform duration-200 group-open:rotate-45" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#B8BFCC]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Product showcase (portfolio dashboard mock)                        */
/* ------------------------------------------------------------------ */

function AreaMini() {
  const closes = FAUX_CANDLES.map((c) => c.close);
  const W = 560;
  const H = 150;
  const max = Math.max(...closes);
  const min = Math.min(...closes);
  const rng = max - min || 1;
  const pts = closes.map((v, i) => `${((i / (closes.length - 1)) * W).toFixed(1)},${(H - ((v - min) / rng) * (H - 12) - 6).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16C784" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#16C784" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill="url(#eqfill)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#16C784" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Showcase() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <Reveal>
          <h2 className="max-w-md text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]" style={{ textWrap: 'balance' }}>
            Tu portafolio, vivo a cada segundo.
          </h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#B8BFCC]">
            Patrimonio, efectivo, rendimiento y posiciones se recalculan con cada movimiento del
            mercado. Sabes exactamente cómo vas, siempre.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'P&L en tiempo real por posición y total',
              'Historial completo de operaciones y órdenes',
              'Curva de patrimonio para seguir tu progreso',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-[#B8BFCC]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-[#16C784]">
                  <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={100}>
          <BrowserFrame url="stratex.app/app">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-[#8B92A0]">Tu patrimonio</div>
                <div className="mt-1 font-mono text-3xl font-semibold text-[#F2F3F5]">$12,480.34</div>
                <div className="font-mono text-sm font-medium text-[#16C784]">+$2,480.34 (24.8%)</div>
              </div>
              <div className="hidden gap-1 sm:flex">
                {['1D', '1S', '1M', '1A'].map((r, i) => (
                  <span key={r} className={`rounded-md px-2 py-1 text-[11px] font-medium ${i === 2 ? 'bg-[#16C784]/15 text-[#16C784]' : 'text-[#8B92A0]'}`}>{r}</span>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <AreaMini />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ['Efectivo', '$7,519.66'],
                ['Invertido', '$4,960.68'],
                ['Hoy', '+$312.40'],
              ].map(([l, v], i) => (
                <div key={l} className="rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-[#5B6472]">{l}</div>
                  <div className={`mt-0.5 font-mono text-sm font-medium ${i === 2 ? 'text-[#16C784]' : 'text-[#F2F3F5]'}`}>{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t border-[#1E2128] pt-4">
              {[
                ['BTC', 'Bitcoin', '0.05', '+12.4%', true],
                ['AAPL', 'Apple', '18', '+3.1%', true],
                ['ETH', 'Ethereum', '1.2', '-1.8%', false],
              ].map(([sym, name, qty, pnl, up]) => (
                <div key={sym as string} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <Coin symbol={sym as string} size={28} />
                    <div>
                      <div className="text-xs font-medium text-[#F2F3F5]">{sym}</div>
                      <div className="text-[10px] text-[#8B92A0]">{name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs text-[#B8BFCC]">{qty} u.</div>
                    <div className={`font-mono text-xs font-medium ${up ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}>{pnl}</div>
                  </div>
                </div>
              ))}
            </div>
          </BrowserFrame>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Trust / value band                                                 */
/* ------------------------------------------------------------------ */

const VALUES: [string, string][] = [
  ['Datos reales de mercado', 'Criptomonedas en vivo desde Binance; acciones, forex y materias primas en movimiento continuo.'],
  ['Órdenes profesionales', 'Mercado, límite y stop, con ejecución automática al alcanzar tu precio objetivo.'],
  ['Gráficos de nivel pro', 'Velas japonesas con herramientas de dibujo ancladas a precio y tiempo, como en las plataformas reales.'],
  ['100% saldo virtual', 'Empiezas con $10,000 de práctica. Sin depósitos, sin comisiones y sin arriesgar dinero real.'],
];

function TrustBand() {
  return (
    <section className="border-y border-[#1E2128] bg-[#0F1115]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <Reveal>
          <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]" style={{ textWrap: 'balance' }}>
            Practica como en el mercado real.
          </h2>
          <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-[#B8BFCC]">
            Las mismas herramientas que usa un operador profesional, sin poner en riesgo tu dinero.
            Aprendes haciendo, con datos reales.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <div className="divide-y divide-[#1E2128] border-y border-[#1E2128]">
            {VALUES.map(([t, d], i) => (
              <div key={t} className="flex gap-4 py-5">
                <span className="mt-0.5 font-mono text-sm font-semibold text-[#16C784]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#F2F3F5]">{t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#8B92A0]">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Final CTA + footer                                                 */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-[#1E2128]">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#16C784]/10 blur-[120px]" />
      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
        <Reveal>
          <h2 className="text-[clamp(2rem,5vw,3.25rem)] font-semibold tracking-[-0.025em] text-[#F2F3F5]" style={{ textWrap: 'balance' }}>
            Los mercados te esperan.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[#B8BFCC]">
            Crea tu cuenta, empieza con $10,000 en fondos de práctica y da tu primera orden en menos
            de un minuto.
          </p>
          <Link
            to="/login"
            state={{ mode: 'register' }}
            className="mt-8 inline-flex rounded-xl bg-[#16C784] px-6 py-3.5 text-sm font-semibold text-[#0A0B0D] transition hover:bg-[#13B374]"
          >
            Crear cuenta gratis
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER_COLS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Producto',
    links: [
      ['Portafolio', '/login'],
      ['Invertir', '/login'],
      ['Terminal', '/login'],
      ['Órdenes', '/login'],
    ],
  },
  {
    title: 'Plataforma',
    links: [
      ['Cómo funciona', '#como-funciona'],
      ['Mercados', '#producto'],
      ['Preguntas', '#faq'],
      ['Crear cuenta', '/login'],
    ],
  },
  {
    title: 'Mercados',
    links: [
      ['Criptomonedas', '#producto'],
      ['Acciones', '#producto'],
      ['Forex', '#producto'],
      ['Materias primas', '#producto'],
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-[#1E2128] bg-[#0F1115]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#8B92A0]">
            Aprende a operar en cripto, acciones, forex y materias primas con datos reales y $10,000
            en fondos de práctica. Sin comisiones, sin riesgo.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-1.5 text-xs text-[#8B92A0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16C784] strx-pulse" />
            Datos cripto en vivo · Binance
          </div>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#5B6472]">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('#') ? (
                    <a href={href} className="text-sm text-[#B8BFCC] transition hover:text-[#F2F3F5]">{label}</a>
                  ) : (
                    <Link to={href} className="text-sm text-[#B8BFCC] transition hover:text-[#F2F3F5]">{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[#1E2128] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#5B6472]">© 2026 Stratex · Simulador educativo</p>
          <p className="max-w-xl text-xs leading-relaxed text-[#5B6472]">
            Las operaciones se realizan con fondos de práctica (virtuales). Stratex no constituye
            asesoría de inversión; invertir en los mercados reales conlleva riesgos.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Virtual funds — animated odometer band                             */
/* ------------------------------------------------------------------ */

// One rolling digit reel: a 0-9 strip repeated (spins+1) times that translates
// up to land on `target` after `spins` full loops — the slot-machine settle.
function Reel({ target, spins, go, reduce }: { target: number; spins: number; go: boolean; reduce: boolean }) {
  const strip = Array.from({ length: (spins + 1) * 10 }, (_, i) => i % 10);
  const finalIndex = spins * 10 + target;
  const y = go ? finalIndex : 0;
  return (
    <span className="relative inline-block overflow-hidden align-top" style={{ height: '1em', width: '0.62em' }}>
      <span
        className="absolute left-0 top-0 flex flex-col items-center"
        style={{
          transform: `translateY(-${y}em)`,
          transition: go && !reduce ? `transform ${1.15 + spins * 0.13}s cubic-bezier(0.16, 1, 0.3, 1)` : 'none',
        }}
      >
        {strip.map((d, i) => (
          <span key={i} style={{ height: '1em', lineHeight: '1em' }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

// $10,000 with each digit on its own reel; the rightmost reels spin longer so
// the number "settles" left-to-right like a real odometer.
function Odometer() {
  const [go, setGo] = useState(false);
  const [reduce, setReduce] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setReduce(r);
    const el = ref.current;
    if (!el) return;
    if (r) {
      setGo(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (setGo(true), io.disconnect())),
      { threshold: 0.4 }
    );
    io.observe(el);
    const fallback = window.setTimeout(() => setGo(true), 1400);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-label="$10,000"
      className="mt-8 flex items-center justify-center font-mono font-semibold leading-none tracking-tight text-[#16C784] tabular-nums"
      style={{ fontSize: 'clamp(3.25rem, 12vw, 7.5rem)', textShadow: '0 0 60px rgba(22,199,132,0.35)' }}
    >
      <span aria-hidden className="mr-[0.06em] text-[#8FE9C4]">$</span>
      <Reel target={1} spins={2} go={go} reduce={reduce} />
      <Reel target={0} spins={3} go={go} reduce={reduce} />
      <span aria-hidden className="mx-[0.02em] text-[#8FE9C4]">,</span>
      <Reel target={0} spins={4} go={go} reduce={reduce} />
      <Reel target={0} spins={5} go={go} reduce={reduce} />
      <Reel target={0} spins={6} go={go} reduce={reduce} />
    </div>
  );
}

function VirtualFunds() {
  return (
    <section className="relative overflow-hidden border-y border-[#1E2128] bg-[#0F1115]">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#16C784]/10 blur-[120px]" />
      <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 sm:py-28">
        <Reveal>
          <h2
            className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]"
            style={{ textWrap: 'balance' }}
          >
            Opera con fondos de práctica, no con tu dinero.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-[#B8BFCC]">
            Tu cuenta arranca con saldo virtual precargado. Practica en mercados reales sin arriesgar
            nada y reinícialo cuando quieras.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <Odometer />
          <div className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-[#5B6472]">
            en saldo de práctica
          </div>
        </Reveal>

        <Reveal delay={220}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[#8B92A0]">
            {['100% virtual', 'Sin depósitos', 'Reinícialo cuando quieras'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-[#16C784]">
                  <path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </span>
            ))}
          </div>
          <Link
            to="/login"
            state={{ mode: 'register' }}
            className="mt-8 inline-flex rounded-xl bg-[#16C784] px-6 py-3 text-sm font-semibold text-[#0A0B0D] transition hover:bg-[#13B374]"
          >
            Reclamar mis $10,000
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  useJsMotion();
  const live = useLiveMarket();
  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#F2F3F5]">
      <NavBar />
      <main>
        <Hero live={live} />
        <Tape live={live.stats} />
        <Features />
        <VirtualFunds />
        <Showcase />
        <Markets live={live.stats} />
        <Steps />
        <TrustBand />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
