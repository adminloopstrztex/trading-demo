import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

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

function CandleChart() {
  const W = 520;
  const H = 210;
  const padY = 14;
  const highs = CANDLES.map((c) => c[1]);
  const lows = CANDLES.map((c) => c[2]);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const step = W / CANDLES.length;
  const bodyW = step * 0.56;
  const y = (v: number) => padY + ((max - v) / (max - min)) * (H - padY * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto strx-draw" role="img" aria-label="Gráfico de velas de BTC con tendencia alcista">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={padY + f * (H - padY * 2)} y2={padY + f * (H - padY * 2)} stroke="#15181E" strokeWidth="1" />
      ))}
      {CANDLES.map(([o, h, l, c], i) => {
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

// Small closing-price area line, used inside the floating portfolio chip.
function Sparkline() {
  const pts = CANDLES.map((c) => c[3]);
  const W = 120;
  const H = 40;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const d = pts
    .map((v, i) => `${(i / (pts.length - 1)) * W},${H - ((v - min) / (max - min)) * H}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
      <polyline points={d} fill="none" stroke="#16C784" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
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

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient glow + grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[880px] -translate-x-1/2 rounded-full bg-[#16C784]/10 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 100%)',
          }}
        />
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

        {/* Product mock */}
        <div className="strx-rise relative" style={{ '--rise-delay': '200ms' } as CSSProperties}>
          <BrowserFrame url="stratex.app/invertir/BTC">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Coin symbol="BTC" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#F2F3F5]">BTC</span>
                    <span className="inline-flex items-center gap-1 rounded bg-[#16C784]/12 px-1.5 py-0.5 text-[9px] font-semibold text-[#16C784]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16C784] strx-pulse" />
                      EN VIVO
                    </span>
                  </div>
                  <div className="text-xs text-[#8B92A0]">Bitcoin</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold text-[#F2F3F5]">$67,240.10</div>
                <div className="font-mono text-xs font-medium text-[#16C784]">+3.12% hoy</div>
              </div>
            </div>

            <div className="mt-4">
              <CandleChart />
            </div>

            <div className="mt-3 flex gap-1">
              {['1D', '1S', '1M', '1A', 'Máx'].map((r, i) => (
                <span
                  key={r}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                    i === 2 ? 'bg-[#16C784]/15 text-[#16C784]' : 'text-[#8B92A0]'
                  }`}
                >
                  {r}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-[#1E2128] pt-4">
              <div className="flex flex-1 rounded-lg bg-[#0A0B0D] p-1 text-center text-xs font-medium">
                <span className="flex-1 rounded-md bg-[#16C784] py-1.5 text-[#0A0B0D]">Comprar</span>
                <span className="flex-1 py-1.5 text-[#8B92A0]">Vender</span>
              </div>
              <div className="rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 font-mono text-sm text-[#F2F3F5]">
                $500.00
              </div>
            </div>
          </BrowserFrame>

          {/* Floating portfolio chip */}
          <div className="strx-float absolute -bottom-6 -left-4 w-52 rounded-2xl border border-[#1E2128] bg-[#101216] p-4 shadow-[0_16px_40px_-12px_#000] sm:-left-8">
            <div className="text-xs text-[#8B92A0]">Tu patrimonio</div>
            <div className="mt-0.5 font-mono text-xl font-semibold text-[#F2F3F5]">$12,480.34</div>
            <div className="font-mono text-xs font-medium text-[#16C784]">+$2,480.34 (24.8%)</div>
            <div className="mt-2">
              <Sparkline />
            </div>
          </div>
        </div>
      </div>
    </section>
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

function Tape() {
  const items = [...TAPE, ...TAPE];
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

const MARKETS = [
  { t: 'Criptomonedas', list: 'BTC · ETH · SOL', d: 'Precios en vivo desde Binance', live: true },
  { t: 'Acciones', list: 'AAPL · TSLA · NVDA', d: 'Las grandes del mercado' },
  { t: 'Forex', list: 'EUR/USD · GBP/USD', d: 'Los pares más operados' },
  { t: 'Materias primas', list: 'Oro · Plata · Petróleo', d: 'Cobertura de mercados globales' },
];

function Markets() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="max-w-2xl text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em] text-[#F2F3F5]" style={{ textWrap: 'balance' }}>
            Todos los mercados, en un solo lugar.
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-[#8B92A0]">
            Diversifica entre clases de activos sin cambiar de plataforma.
          </p>
        </div>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MARKETS.map((m, i) => (
          <Reveal key={m.t} delay={i * 70}>
            <div className="group h-full rounded-2xl border border-[#1E2128] bg-[#101216] p-6 transition hover:border-[#262A33]">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#F2F3F5]">{m.t}</h3>
                {m.live && (
                  <span className="inline-flex items-center gap-1 rounded bg-[#16C784]/12 px-1.5 py-0.5 text-[9px] font-semibold text-[#16C784]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16C784] strx-pulse" />
                    EN VIVO
                  </span>
                )}
              </div>
              <p className="mt-3 font-mono text-sm text-[#B8BFCC]">{m.list}</p>
              <p className="mt-1.5 text-xs text-[#8B92A0]">{m.d}</p>
            </div>
          </Reveal>
        ))}
      </div>
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

function Footer() {
  return (
    <footer className="border-t border-[#1E2128] bg-[#0F1115]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-[#8B92A0]">
            Opera cripto, acciones, forex y materias primas en tiempo real. Órdenes avanzadas, fondos
            de práctica y sin comisiones.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-[#8B92A0]">
          <a href="#producto" className="transition hover:text-[#F2F3F5]">Producto</a>
          <a href="#como-funciona" className="transition hover:text-[#F2F3F5]">Cómo funciona</a>
          <a href="#faq" className="transition hover:text-[#F2F3F5]">Preguntas</a>
          <Link to="/login" className="transition hover:text-[#F2F3F5]">Entrar</Link>
        </div>
      </div>
      <div className="border-t border-[#1E2128] px-5 py-5 sm:px-8">
        <p className="mx-auto max-w-6xl text-xs leading-relaxed text-[#5B6472]">
          © 2026 Stratex. Las operaciones se realizan con fondos de práctica (virtuales). Stratex no
          constituye asesoría de inversión; invertir en los mercados conlleva riesgos.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

export default function Landing() {
  useJsMotion();
  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#F2F3F5]">
      <NavBar />
      <main>
        <Hero />
        <Tape />
        <Features />
        <Markets />
        <Steps />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
