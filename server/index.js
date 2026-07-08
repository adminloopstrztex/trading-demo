import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'node:crypto';
import { load, addUser, saveUser, findUserByEmail, findUserById, getDb } from './store.js';
import { isValidSymbol, fetchLivePrice, SYMBOLS } from './market.js';

const PORT = Number(process.env.PORT) || 4000;
const STARTING_BALANCE = 10000;
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5180';

// JWT secret: required in production; in dev, generate an ephemeral random one
// (never a hardcoded constant, which would let anyone forge admin tokens).
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SimTrade] JWT_SECRET es obligatorio en producción. Abortando.');
    process.exit(1);
  }
  SECRET = randomBytes(48).toString('hex');
  console.warn(
    '[SimTrade] JWT_SECRET no definido: usando un secreto aleatorio de desarrollo ' +
      '(las sesiones se invalidan al reiniciar). Define JWT_SECRET para producción.'
  );
}

load();

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '64kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos.' },
});

// ---- helpers ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}
function accountSnapshot(u) {
  return {
    virtualBalance: u.virtualBalance,
    holdings: u.holdings,
    transactions: u.transactions,
    pendingOrders: u.pendingOrders || [],
  };
}

// Trigger rules for pending orders:
//  buy limit  → price fell to/below target;  sell limit → price rose to/above target
//  buy stop   → price rose to/above target;  sell stop  → price fell to/below target
function orderTriggered(order, price) {
  if (order.type === 'limit') {
    return order.side === 'buy' ? price <= order.targetPrice : price >= order.targetPrice;
  }
  return order.side === 'buy' ? price >= order.targetPrice : price <= order.targetPrice;
}

// executes a market fill against a user (server-authoritative math + checks).
// Returns { ok } or { error }.
function fillOrder(user, symbol, side, quantity, price) {
  if (side === 'buy') {
    const cost = quantity * price;
    if (cost > user.virtualBalance) return { error: 'Saldo insuficiente' };
    const existing = user.holdings.find((h) => h.symbol === symbol);
    if (existing) {
      const totalQty = existing.quantity + quantity;
      existing.avgPrice = (existing.avgPrice * existing.quantity + price * quantity) / totalQty;
      existing.quantity = totalQty;
    } else {
      user.holdings.push({ symbol, quantity, avgPrice: price });
    }
    user.virtualBalance -= cost;
  } else {
    const existing = user.holdings.find((h) => h.symbol === symbol);
    if (!existing || existing.quantity < quantity) return { error: 'Posición insuficiente' };
    existing.quantity -= quantity;
    if (existing.quantity <= 1e-9) user.holdings = user.holdings.filter((h) => h.symbol !== symbol);
    user.virtualBalance += quantity * price;
  }
  user.transactions = [
    { id: randomUUID(), symbol, side, quantity, price, timestamp: Date.now() },
    ...user.transactions,
  ].slice(0, 500);
  return { ok: true };
}
function crmUser(u) {
  const invested = u.holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0);
  const volume = u.transactions.reduce((s, t) => s + t.quantity * t.price, 0);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    kycStatus: u.kycStatus,
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt,
    virtualBalance: u.virtualBalance,
    invested,
    volume,
    holdingsCount: u.holdings.length,
    tradesCount: u.transactions.length,
    tags: u.tags || [],
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = findUserById(payload.id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Cuenta suspendida' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Requiere rol admin' });
  next();
}
function touch(user) {
  user.lastActiveAt = Date.now();
}
// wraps async handlers so rejected promises become 500s instead of crashes
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- auth ----
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Datos inválidos' });
  if (name.trim().length < 2) return res.status(400).json({ error: 'Nombre demasiado corto' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'Ese email ya está registrado' });

  const user = {
    id: randomUUID(),
    name: name.trim().slice(0, 60),
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user',
    status: 'active',
    kycStatus: 'none',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    virtualBalance: STARTING_BALANCE,
    holdings: [],
    transactions: [],
    tags: ['lead'],
    notes: [],
  };
  addUser(user);
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user), account: accountSnapshot(user) });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Datos inválidos' });
  const user = findUserByEmail(email);
  // constant-ish response: always run a compare to reduce user-enumeration timing
  const ok = user ? bcrypt.compareSync(password, user.passwordHash) : bcrypt.compareSync(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidin');
  if (!user || !ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'Cuenta suspendida' });
  touch(user);
  saveUser(user);
  const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user), account: accountSnapshot(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user), account: accountSnapshot(req.user) });
});

// ---- trading: server is authoritative for balance & positions ----
app.post(
  '/api/account/trade',
  auth,
  wrap(async (req, res) => {
    const { symbol, side } = req.body || {};
    const quantity = Number(req.body?.quantity);
    let price = Number(req.body?.price);

    if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Símbolo desconocido' });
    if (side !== 'buy' && side !== 'sell')
      return res.status(400).json({ error: 'Operación inválida' });
    if (!Number.isFinite(quantity) || quantity <= 0)
      return res.status(400).json({ error: 'Cantidad inválida' });

    // For live (crypto) symbols the server fetches the real price and ignores
    // whatever the client sent, so a client cannot execute at a fake price.
    if (SYMBOLS[symbol].live) {
      const livePrice = await fetchLivePrice(symbol);
      if (livePrice) price = livePrice;
    }
    if (!Number.isFinite(price) || price <= 0 || price > 1e9)
      return res.status(400).json({ error: 'Precio inválido' });

    const user = req.user;
    const result = fillOrder(user, symbol, side, quantity, price);
    if (result.error) return res.status(400).json({ error: result.error });
    touch(user);
    saveUser(user);
    res.json({ account: accountSnapshot(user), executedPrice: price });
  })
);

// ---- pending orders (limit / stop) ----
app.post(
  '/api/account/orders',
  auth,
  wrap(async (req, res) => {
    const { symbol, side, type } = req.body || {};
    const quantity = Number(req.body?.quantity);
    const targetPrice = Number(req.body?.targetPrice);
    if (!isValidSymbol(symbol)) return res.status(400).json({ error: 'Símbolo desconocido' });
    if (side !== 'buy' && side !== 'sell') return res.status(400).json({ error: 'Operación inválida' });
    if (type !== 'limit' && type !== 'stop') return res.status(400).json({ error: 'Tipo de orden inválido' });
    if (!Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ error: 'Cantidad inválida' });
    if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 1e9)
      return res.status(400).json({ error: 'Precio objetivo inválido' });

    const user = req.user;
    user.pendingOrders = user.pendingOrders || [];
    if (user.pendingOrders.length >= 50) return res.status(400).json({ error: 'Demasiadas órdenes pendientes' });
    const order = { id: randomUUID(), symbol, side, type, quantity, targetPrice, createdAt: Date.now() };
    user.pendingOrders = [order, ...user.pendingOrders];
    touch(user);
    saveUser(user);
    res.json({ order, account: accountSnapshot(user) });
  })
);

app.delete('/api/account/orders/:id', auth, (req, res) => {
  const user = req.user;
  user.pendingOrders = (user.pendingOrders || []).filter((o) => o.id !== req.params.id);
  saveUser(user);
  res.json({ account: accountSnapshot(user) });
});

// Called by the client's price watcher when a pending order's trigger condition
// is met. The server re-validates: for live symbols it re-checks against the real
// price, and executes at the authoritative price. Prevents fake-price fills.
app.post(
  '/api/account/orders/:id/execute',
  auth,
  wrap(async (req, res) => {
    const user = req.user;
    const order = (user.pendingOrders || []).find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Orden no encontrada' });

    let price = Number(req.body?.price);
    if (SYMBOLS[order.symbol]?.live) {
      const live = await fetchLivePrice(order.symbol);
      if (live) price = live;
    }
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'Precio inválido' });

    // verify the trigger actually holds at the authoritative price
    const triggered = orderTriggered(order, price);
    if (!triggered) return res.status(409).json({ error: 'La condición aún no se cumple', account: accountSnapshot(user) });

    const result = fillOrder(user, order.symbol, order.side, order.quantity, price);
    if (result.error) {
      // e.g. insufficient funds when it triggers: drop the order so it doesn't loop
      user.pendingOrders = user.pendingOrders.filter((o) => o.id !== order.id);
      saveUser(user);
      return res.status(400).json({ error: result.error, account: accountSnapshot(user) });
    }
    user.pendingOrders = user.pendingOrders.filter((o) => o.id !== order.id);
    touch(user);
    saveUser(user);
    res.json({ account: accountSnapshot(user), executedPrice: price });
  })
);

// ---- CRM (admin) ----
// period-over-period % change: current window (last `win` ms) vs the window before it
function deltaPct(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

app.get('/api/admin/metrics', auth, adminOnly, (_req, res) => {
  const users = getDb().users.filter((u) => u.role === 'user');
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const win = 30 * 24 * 60 * 60 * 1000;
  const currFrom = now - win;
  const prevFrom = now - 2 * win;
  const activeUsers = users.filter((u) => u.transactions.length > 0);

  // period-over-period aggregates (30d vs prior 30d)
  let signupsCurr = 0, signupsPrev = 0, tradesCurr = 0, tradesPrev = 0, volCurr = 0, volPrev = 0;
  for (const u of users) {
    if (u.createdAt >= currFrom) signupsCurr++;
    else if (u.createdAt >= prevFrom) signupsPrev++;
    for (const t of u.transactions) {
      const v = t.quantity * t.price;
      if (t.timestamp >= currFrom) {
        tradesCurr++;
        volCurr += v;
      } else if (t.timestamp >= prevFrom) {
        tradesPrev++;
        volPrev += v;
      }
    }
  }

  res.json({
    totalUsers: users.length,
    newToday: users.filter((u) => u.createdAt >= dayAgo).length,
    newThisWeek: users.filter((u) => u.createdAt >= weekAgo).length,
    activeUsers: activeUsers.length,
    leads: users.filter((u) => u.transactions.length === 0).length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    kycVerified: users.filter((u) => u.kycStatus === 'verified').length,
    kycPending: users.filter((u) => u.kycStatus === 'pending').length,
    totalTrades: users.reduce((s, u) => s + u.transactions.length, 0),
    totalVolume: users.reduce((s, u) => s + u.transactions.reduce((a, t) => a + t.quantity * t.price, 0), 0),
    totalEquity: users.reduce(
      (s, u) => s + u.virtualBalance + u.holdings.reduce((a, h) => a + h.avgPrice * h.quantity, 0),
      0
    ),
    deltas: {
      users: deltaPct(signupsCurr, signupsPrev),
      trades: deltaPct(tradesCurr, tradesPrev),
      volume: deltaPct(volCurr, volPrev),
    },
  });
});

app.get('/api/admin/assets', auth, adminOnly, (_req, res) => {
  const users = getDb().users.filter((u) => u.role === 'user');
  const map = {};
  for (const u of users) {
    for (const t of u.transactions) {
      const m = (map[t.symbol] ||= { symbol: t.symbol, volume: 0, trades: 0 });
      m.volume += t.quantity * t.price;
      m.trades++;
    }
  }
  const list = Object.values(map).sort((a, b) => b.volume - a.volume);
  res.json(list.map((a) => ({ ...a, volume: Math.round(a.volume) })));
});

app.get('/api/admin/timeseries', auth, adminOnly, (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const users = getDb().users.filter((u) => u.role === 'user');
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const start = startOfToday.getTime() - (days - 1) * dayMs;

  const buckets = [];
  for (let i = 0; i < days; i++) {
    const from = start + i * dayMs;
    buckets.push({ from, to: from + dayMs, date: new Date(from).toISOString().slice(0, 10), signups: 0, trades: 0, volume: 0 });
  }
  const bucketFor = (ts) => {
    if (ts < start) return -1; // before window (still counts for cumulative)
    const idx = Math.floor((ts - start) / dayMs);
    return idx >= 0 && idx < days ? idx : -2;
  };

  let usersBeforeWindow = 0;
  for (const u of users) {
    const b = bucketFor(u.createdAt);
    if (b === -1) usersBeforeWindow++;
    else if (b >= 0) buckets[b].signups++;
    for (const t of u.transactions) {
      const tb = bucketFor(t.timestamp);
      if (tb >= 0) {
        buckets[tb].trades++;
        buckets[tb].volume += t.quantity * t.price;
      }
    }
  }

  let cumulative = usersBeforeWindow;
  const series = buckets.map((b) => {
    cumulative += b.signups;
    return {
      date: b.date,
      signups: b.signups,
      cumulativeUsers: cumulative,
      trades: b.trades,
      volume: Math.round(b.volume),
    };
  });
  res.json(series);
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const { q, status, kyc, segment, sort } = req.query;
  let users = getDb().users.filter((u) => u.role === 'user');
  if (q) {
    const term = String(q).toLowerCase();
    users = users.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }
  if (status) users = users.filter((u) => u.status === status);
  if (kyc) users = users.filter((u) => u.kycStatus === kyc);
  if (segment === 'lead') users = users.filter((u) => u.transactions.length === 0);
  if (segment === 'active') users = users.filter((u) => u.transactions.length > 0);

  const equity = (u) => u.virtualBalance + u.holdings.reduce((a, h) => a + h.avgPrice * h.quantity, 0);
  if (sort === 'equity') users.sort((a, b) => equity(b) - equity(a));
  else users.sort((a, b) => b.createdAt - a.createdAt);

  const total = users.length;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
  const items = users.slice((page - 1) * pageSize, page * pageSize).map(crmUser);
  res.json({ items, total, page, pageSize });
});

app.get('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'No encontrado' });
  res.json({ ...crmUser(user), holdings: user.holdings, transactions: user.transactions, notes: user.notes || [] });
});

app.patch('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'No encontrado' });
  const { status, kycStatus, tags, resetBalance } = req.body || {};
  if (status && ['active', 'suspended'].includes(status)) user.status = status;
  if (kycStatus && ['none', 'pending', 'verified'].includes(kycStatus)) user.kycStatus = kycStatus;
  if (Array.isArray(tags)) user.tags = tags.map((t) => String(t).slice(0, 24)).slice(0, 20);
  if (resetBalance) {
    user.virtualBalance = STARTING_BALANCE;
    user.holdings = [];
    user.transactions = [];
  }
  saveUser(user);
  res.json(crmUser(user));
});

app.post('/api/admin/users/:id/notes', auth, adminOnly, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'No encontrado' });
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Nota vacía' });
  const note = { id: randomUUID(), text: text.slice(0, 1000), at: Date.now(), by: req.user.name };
  user.notes = [note, ...(user.notes || [])];
  saveUser(user);
  res.json(note);
});

// fallback error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[SimTrade] error:', err);
  res.status(500).json({ error: 'Error interno' });
});

// Only start the HTTP listener when run as a real server, not when imported by tests.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`SimTrade API en http://localhost:${PORT}`);
  });
}

export { app };
