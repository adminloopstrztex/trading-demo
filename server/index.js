import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, randomBytes } from 'node:crypto';
import { load, addUser, saveUser, updateUser, deleteUser, importUsers, findUserByEmail, findUserById, getDb } from './store.js';
import { isValidSymbol, fetchLivePrice, SYMBOLS } from './market.js';

const PORT = Number(process.env.PORT) || 4000;
const STARTING_BALANCE = 10000;
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5180';

// JWT secret: required in production; in dev, generate an ephemeral random one
// (never a hardcoded constant, which would let anyone forge admin tokens).
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[Stratex] JWT_SECRET es obligatorio en producción. Abortando.');
    process.exit(1);
  }
  SECRET = randomBytes(48).toString('hex');
  console.warn(
    '[Stratex] JWT_SECRET no definido: usando un secreto aleatorio de desarrollo ' +
      '(las sesiones se invalidan al reiniciar). Define JWT_SECRET para producción.'
  );
}

// Cloudflare Turnstile (captcha anti-bot). El secreto se define por entorno;
// si falta, la verificación se omite (útil en desarrollo local sin llaves).
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;
if (!TURNSTILE_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[Stratex] TURNSTILE_SECRET no definido en producción: el captcha del registro NO se validará.');
}

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return true; // no configurado: no bloquear
  if (typeof token !== 'string' || !token) return false;
  try {
    const form = new URLSearchParams();
    form.append('secret', TURNSTILE_SECRET);
    form.append('response', token);
    if (ip) form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = await r.json();
    return data.success === true;
  } catch {
    return false;
  }
}

load();

const app = express();
app.disable('x-powered-by');
// Detrás de Cloudflare/Railway: confiar en el primer proxy para leer la IP real
// del cliente (necesario para que el rate limiting sea por-usuario, no global).
app.set('trust proxy', 1);
app.use(helmet()); // incluye HSTS, X-Content-Type-Options, etc.
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: '64kb' }));

// Límite estricto en autenticación (anti fuerza bruta).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos.' },
});

// Límite global anti-abuso para toda la API (generoso para uso normal,
// corta scraping/floods). ~1.1 req/s sostenidas por IP.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' },
});
app.use('/api', apiLimiter);

// ---- helpers ----
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

// Role-based access control for the back-office team.
//  admin   – full control, can manage roles
//  support – manage customers (moderate status/KYC, notes) but not reset or roles
//  viewer  – read-only access to the CRM
//  user    – end customer (trader), no CRM access
const ROLE_PERMS = {
  admin: ['crm.view', 'users.moderate', 'users.reset', 'roles.manage'],
  support: ['crm.view', 'users.moderate'],
  viewer: ['crm.view'],
  user: [],
};
const STAFF_ROLES = ['admin', 'support', 'viewer'];
const ASSIGNABLE_ROLES = ['admin', 'support', 'viewer', 'user'];

function permsFor(role) {
  return ROLE_PERMS[role] || [];
}
function hasPerm(user, perm) {
  return permsFor(user.role).includes(perm);
}
function requirePerm(perm) {
  return (req, res, next) =>
    hasPerm(req.user, perm) ? next() : res.status(403).json({ error: 'No tienes permiso para esta acción' });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, permissions: permsFor(u.role), survey: u.survey || null };
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
    phone: u.phone || '',
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
    survey: u.survey || null,
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
function touch(user) {
  user.lastActiveAt = Date.now();
}

// Onboarding survey (all fields optional). Used to tailor the educational experience.
const SURVEY_GOALS = ['basics', 'strategies', 'crypto', 'ready-to-invest', 'other'];
function sanitizeSurvey(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const scale = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : null;
  };
  const tradingExperience = scale(raw.tradingExperience);
  const techComfort = scale(raw.techComfort);
  const goal = SURVEY_GOALS.includes(raw.goal) ? raw.goal : null;
  if (tradingExperience === null && techComfort === null && goal === null) return null;
  return { tradingExperience, techComfort, goal };
}
// wraps async handlers so rejected promises become 500s instead of crashes
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- auth ----
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { firstName, lastName, email, phone, password, survey, turnstileToken } = req.body || {};
  if (
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    typeof email !== 'string' ||
    typeof phone !== 'string' ||
    typeof password !== 'string'
  )
    return res.status(400).json({ error: 'Datos inválidos' });
  if (firstName.trim().length < 2) return res.status(400).json({ error: 'El nombre es demasiado corto' });
  if (lastName.trim().length < 2) return res.status(400).json({ error: 'El apellido es demasiado corto' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  if (!PHONE_RE.test(phone.trim())) return res.status(400).json({ error: 'Teléfono inválido' });
  if (password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (!(await verifyTurnstile(turnstileToken, req.ip)))
    return res.status(400).json({ error: 'Verificación anti-robot fallida. Recarga la página e inténtalo de nuevo.' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'Ese email ya está registrado' });

  const first = firstName.trim().slice(0, 40);
  const last = lastName.trim().slice(0, 40);
  const user = {
    id: randomUUID(),
    firstName: first,
    lastName: last,
    name: `${first} ${last}`,
    email: email.toLowerCase(),
    phone: phone.trim().slice(0, 20),
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
    pendingOrders: [],
    survey: sanitizeSurvey(survey),
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

// Cambiar la propia contraseña (cualquier usuario autenticado).
app.post('/api/auth/password', authLimiter, auth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string')
    return res.status(400).json({ error: 'Datos inválidos' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  if (!bcrypt.compareSync(currentPassword, req.user.passwordHash))
    return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
  const r = updateUser(req.user.id, (user) => {
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
  });
  if (r.notFound) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
});

// Cambio de correo propio (verifica la contraseña actual).
app.post('/api/auth/email', authLimiter, auth, (req, res) => {
  const { newEmail, currentPassword } = req.body || {};
  if (typeof newEmail !== 'string' || typeof currentPassword !== 'string')
    return res.status(400).json({ error: 'Datos inválidos' });
  const email = newEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  if (!bcrypt.compareSync(currentPassword, req.user.passwordHash))
    return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
  const existing = findUserByEmail(email);
  if (existing && existing.id !== req.user.id)
    return res.status(409).json({ error: 'Ese email ya está en uso' });
  if (email === (req.user.email || '').toLowerCase())
    return res.status(400).json({ error: 'Ese ya es tu correo actual' });
  try {
    const r = updateUser(req.user.id, (user) => {
      user.email = email;
    });
    if (r.notFound) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, email });
  } catch {
    // Violación de UNIQUE u otro error de escritura
    res.status(409).json({ error: 'No se pudo actualizar el correo (¿ya está en uso?)' });
  }
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

    const r = updateUser(req.user.id, (user) => {
      const result = fillOrder(user, symbol, side, quantity, price);
      if (result.error) return { error: result.error };
      touch(user);
    });
    if (r.notFound) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ account: accountSnapshot(r.user), executedPrice: price });
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

    const r = updateUser(req.user.id, (user) => {
      user.pendingOrders = user.pendingOrders || [];
      if (user.pendingOrders.length >= 50) return { error: 'Demasiadas órdenes pendientes' };
      const order = { id: randomUUID(), symbol, side, type, quantity, targetPrice, createdAt: Date.now() };
      user.pendingOrders = [order, ...user.pendingOrders];
      touch(user);
      return { order };
    });
    if (r.notFound) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ order: r.order, account: accountSnapshot(r.user) });
  })
);

app.delete('/api/account/orders/:id', auth, (req, res) => {
  const r = updateUser(req.user.id, (user) => {
    user.pendingOrders = (user.pendingOrders || []).filter((o) => o.id !== req.params.id);
  });
  if (r.notFound) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ account: accountSnapshot(r.user) });
});

// Called by the client's price watcher when a pending order's trigger condition
// is met. The server re-validates: for live symbols it re-checks against the real
// price, and executes at the authoritative price. Prevents fake-price fills.
app.post(
  '/api/account/orders/:id/execute',
  auth,
  wrap(async (req, res) => {
    // Read once to learn the order's symbol so we can fetch its live price
    // (the async part), then re-validate everything atomically inside updateUser.
    const pre = findUserById(req.user.id);
    const preOrder = (pre?.pendingOrders || []).find((o) => o.id === req.params.id);
    if (!preOrder) return res.status(404).json({ error: 'Orden no encontrada' });

    let price = Number(req.body?.price);
    if (SYMBOLS[preOrder.symbol]?.live) {
      const live = await fetchLivePrice(preOrder.symbol);
      if (live) price = live;
    }
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'Precio inválido' });

    const r = updateUser(req.user.id, (user) => {
      const order = (user.pendingOrders || []).find((o) => o.id === req.params.id);
      if (!order) return { error: 'Orden no encontrada', status: 404 };
      // verify the trigger actually holds at the authoritative price
      if (!orderTriggered(order, price)) return { error: 'La condición aún no se cumple', status: 409 };

      const result = fillOrder(user, order.symbol, order.side, order.quantity, price);
      if (result.error) {
        // e.g. insufficient funds when it triggers: drop the order so it doesn't loop
        user.pendingOrders = user.pendingOrders.filter((o) => o.id !== order.id);
        return { error: result.error, status: 400, persist: true };
      }
      user.pendingOrders = user.pendingOrders.filter((o) => o.id !== order.id);
      touch(user);
    });

    if (r.notFound) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (r.error) return res.status(r.status || 400).json({ error: r.error, account: accountSnapshot(r.user) });
    res.json({ account: accountSnapshot(r.user), executedPrice: price });
  })
);

// ---- CRM (admin) ----
// period-over-period % change: current window (last `win` ms) vs the window before it
function deltaPct(curr, prev) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

// Experience level bucket from the 1–10 onboarding scale.
function experienceLevel(score) {
  if (score == null) return null;
  if (score <= 3) return 'beginner';
  if (score <= 7) return 'intermediate';
  return 'advanced';
}

// Aggregates of the onboarding survey across a set of users.
function surveyStats(users) {
  const answered = users.filter((u) => u.survey);
  const avg = (key) => {
    const vals = answered.map((u) => u.survey[key]).filter((v) => typeof v === 'number');
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  };
  const experience = { beginner: 0, intermediate: 0, advanced: 0 };
  const goals = { basics: 0, strategies: 0, crypto: 0, 'ready-to-invest': 0, other: 0 };
  for (const u of answered) {
    const lvl = experienceLevel(u.survey.tradingExperience);
    if (lvl) experience[lvl]++;
    if (u.survey.goal && goals[u.survey.goal] != null) goals[u.survey.goal]++;
  }
  return {
    responded: answered.length,
    avgExperience: avg('tradingExperience'),
    avgTech: avg('techComfort'),
    experience,
    goals,
  };
}

app.get('/api/admin/metrics', auth, requirePerm('crm.view'), (_req, res) => {
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
    survey: surveyStats(users),
  });
});

app.get('/api/admin/assets', auth, requirePerm('crm.view'), (_req, res) => {
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

app.get('/api/admin/timeseries', auth, requirePerm('crm.view'), (req, res) => {
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

app.get('/api/admin/users', auth, requirePerm('crm.view'), (req, res) => {
  const { q, status, kyc, segment, sort, experience, goal } = req.query;
  let users = getDb().users.filter((u) => u.role === 'user');
  if (q) {
    const term = String(q).toLowerCase();
    users = users.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }
  if (status) users = users.filter((u) => u.status === status);
  if (kyc) users = users.filter((u) => u.kycStatus === kyc);
  if (segment === 'lead') users = users.filter((u) => u.transactions.length === 0);
  if (segment === 'active') users = users.filter((u) => u.transactions.length > 0);
  if (experience) users = users.filter((u) => experienceLevel(u.survey?.tradingExperience) === experience);
  if (goal) users = users.filter((u) => u.survey?.goal === goal);

  const equity = (u) => u.virtualBalance + u.holdings.reduce((a, h) => a + h.avgPrice * h.quantity, 0);
  if (sort === 'equity') users.sort((a, b) => equity(b) - equity(a));
  else users.sort((a, b) => b.createdAt - a.createdAt);

  const total = users.length;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
  const items = users.slice((page - 1) * pageSize, page * pageSize).map(crmUser);
  res.json({ items, total, page, pageSize });
});

app.get('/api/admin/users/:id', auth, requirePerm('crm.view'), (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role !== 'user') return res.status(404).json({ error: 'No encontrado' });
  res.json({ ...crmUser(user), holdings: user.holdings, transactions: user.transactions, notes: user.notes || [] });
});

app.patch('/api/admin/users/:id', auth, requirePerm('users.moderate'), (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role !== 'user') return res.status(404).json({ error: 'No encontrado' });
  const { status, kycStatus, tags, resetBalance } = req.body || {};
  if (resetBalance && !hasPerm(req.user, 'users.reset'))
    return res.status(403).json({ error: 'No tienes permiso para resetear saldos' });
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

// ---- etiquetas de cliente (cualquier miembro del CRM: crm.view) ----
// Etiquetas libres para identificar/categorizar clientes. Escritura atómica.
app.post('/api/admin/users/:id/tags', auth, requirePerm('crm.view'), (req, res) => {
  const raw = typeof req.body?.tag === 'string' ? req.body.tag.trim().replace(/\s+/g, ' ').slice(0, 24) : '';
  if (!raw) return res.status(400).json({ error: 'Etiqueta vacía' });
  const r = updateUser(req.params.id, (user) => {
    if (user.role !== 'user') return { error: 'No encontrado', status: 404 };
    const tags = user.tags || [];
    if (tags.some((t) => t.toLowerCase() === raw.toLowerCase())) return { error: 'La etiqueta ya existe', status: 409 };
    if (tags.length >= 20) return { error: 'Máximo 20 etiquetas', status: 400 };
    user.tags = [...tags, raw];
  });
  if (r.notFound) return res.status(404).json({ error: 'No encontrado' });
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ tags: r.user.tags });
});

app.delete('/api/admin/users/:id/tags/:tag', auth, requirePerm('crm.view'), (req, res) => {
  const tag = decodeURIComponent(req.params.tag);
  const r = updateUser(req.params.id, (user) => {
    if (user.role !== 'user') return { error: 'No encontrado', status: 404 };
    user.tags = (user.tags || []).filter((t) => t.toLowerCase() !== tag.toLowerCase());
  });
  if (r.notFound) return res.status(404).json({ error: 'No encontrado' });
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ tags: r.user.tags });
});

// Catálogo de etiquetas existentes con conteo (para sugerencias/autocompletado).
app.get('/api/admin/tags', auth, requirePerm('crm.view'), (_req, res) => {
  const counts = {};
  for (const u of getDb().users) {
    if (u.role !== 'user') continue;
    for (const t of u.tags || []) counts[t] = (counts[t] || 0) + 1;
  }
  const tags = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
  res.json(tags);
});

// Bulk import of customers from a spreadsheet (client parses CSV → sends rows in
// batches). Creates `user` accounts; passwords are set to a shared default (hashed
// once, never imported), emails are de-duplicated against existing accounts.
app.post('/api/admin/users/import', auth, requirePerm('users.moderate'), (req, res) => {
  const rows = Array.isArray(req.body?.users) ? req.body.users : null;
  if (!rows) return res.status(400).json({ error: 'Formato inválido: falta "users"' });
  if (rows.length > 1000) return res.status(400).json({ error: 'Máximo 1000 filas por lote' });

  const dp = typeof req.body?.defaultPassword === 'string' ? req.body.defaultPassword : '';
  const defaultPassword = dp.length >= 6 ? dp : 'demo1234';
  const passwordHash = bcrypt.hashSync(defaultPassword, 10); // hashed once, reused for the batch

  const now = Date.now();
  const errors = [];
  const docs = [];
  const seen = new Set();

  rows.forEach((r, i) => {
    const name = String(r?.name ?? '').trim();
    const email = String(r?.email ?? '').trim().toLowerCase();
    if (name.length < 2) return errors.push({ row: i + 1, error: 'Nombre inválido' });
    if (!EMAIL_RE.test(email)) return errors.push({ row: i + 1, error: `Email inválido (${email || 'vacío'})` });
    if (seen.has(email)) return errors.push({ row: i + 1, error: `Email repetido en el archivo (${email})` });
    seen.add(email);

    const status = ['active', 'suspended'].includes(r.status) ? r.status : 'active';
    const kycStatus = ['none', 'pending', 'verified'].includes(r.kycStatus) ? r.kycStatus : 'none';
    const balance = Number.isFinite(Number(r.virtualBalance)) ? Number(r.virtualBalance) : STARTING_BALANCE;
    const createdAt = Number.isFinite(Number(r.createdAt)) ? Number(r.createdAt) : now;

    docs.push({
      id: randomUUID(),
      firstName: name.split(' ')[0].slice(0, 40),
      lastName: name.split(' ').slice(1).join(' ').slice(0, 40),
      name: name.slice(0, 80),
      email,
      phone: String(r?.phone ?? '').trim().slice(0, 20),
      passwordHash,
      role: 'user',
      status,
      kycStatus,
      createdAt,
      lastActiveAt: createdAt,
      virtualBalance: balance,
      holdings: [],
      transactions: [],
      tags: ['importado'],
      notes: [],
      pendingOrders: [],
      survey: null,
    });
  });

  const { inserted, skipped } = importUsers(docs);
  res.json({ received: rows.length, inserted, skipped, invalid: errors.length, errors: errors.slice(0, 20) });
});

app.post('/api/admin/users/:id/notes', auth, requirePerm('users.moderate'), (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role !== 'user') return res.status(404).json({ error: 'No encontrado' });
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'Nota vacía' });
  const note = { id: randomUUID(), text: text.slice(0, 1000), at: Date.now(), by: req.user.name };
  user.notes = [note, ...(user.notes || [])];
  saveUser(user);
  res.json(note);
});

// Crear un cliente manualmente desde el CRM (rol 'user').
app.post('/api/admin/users', auth, requirePerm('users.moderate'), (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (typeof name !== 'string' || typeof email !== 'string')
    return res.status(400).json({ error: 'Datos inválidos' });
  if (name.trim().length < 2) return res.status(400).json({ error: 'El nombre es demasiado corto' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'Ese email ya está registrado' });
  const pass = typeof password === 'string' && password.length >= 6 ? password : 'demo1234';
  const first = name.trim().split(' ')[0].slice(0, 40);
  const last = name.trim().split(' ').slice(1).join(' ').slice(0, 40);
  const now = Date.now();
  const user = {
    id: randomUUID(),
    firstName: first,
    lastName: last,
    name: name.trim().slice(0, 80),
    email: email.toLowerCase(),
    phone: typeof phone === 'string' ? phone.trim().slice(0, 20) : '',
    passwordHash: bcrypt.hashSync(pass, 10),
    role: 'user',
    status: 'active',
    kycStatus: 'none',
    createdAt: now,
    lastActiveAt: now,
    virtualBalance: STARTING_BALANCE,
    holdings: [],
    transactions: [],
    tags: [],
    notes: [],
    pendingOrders: [],
    survey: null,
  };
  addUser(user);
  res.status(201).json(crmUser(user));
});

// Eliminar un cliente (acción destructiva → permiso users.reset, solo admin).
app.delete('/api/admin/users/:id', auth, requirePerm('users.reset'), (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role !== 'user') return res.status(404).json({ error: 'No encontrado' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  deleteUser(user.id);
  res.json({ ok: true });
});

// Restablecer la contraseña de un cliente (admin → permiso users.reset).
app.post('/api/admin/users/:id/password', auth, requirePerm('users.reset'), (req, res) => {
  const { newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  const target = findUserById(req.params.id);
  if (!target || target.role !== 'user') return res.status(404).json({ error: 'No encontrado' });
  const r = updateUser(target.id, (u) => {
    u.passwordHash = bcrypt.hashSync(newPassword, 10);
  });
  if (r.notFound) return res.status(404).json({ error: 'No encontrado' });
  res.json({ ok: true });
});

// ---- team & roles ----
app.get('/api/admin/staff', auth, requirePerm('crm.view'), (_req, res) => {
  const staff = getDb()
    .users.filter((u) => STAFF_ROLES.includes(u.role))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, lastActiveAt: u.lastActiveAt }));
  res.json(staff);
});

app.patch('/api/admin/users/:id/role', auth, requirePerm('roles.manage'), (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'No encontrado' });
  const { role } = req.body || {};
  if (!ASSIGNABLE_ROLES.includes(role)) return res.status(400).json({ error: 'Rol inválido' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
  user.role = role;
  saveUser(user);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// create a brand-new staff account
app.post('/api/admin/staff', auth, requirePerm('roles.manage'), (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Datos inválidos' });
  if (name.trim().length < 2) return res.status(400).json({ error: 'Nombre demasiado corto' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email inválido' });
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  if (!STAFF_ROLES.includes(role)) return res.status(400).json({ error: 'Rol inválido' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'Ese email ya está registrado' });

  const user = {
    id: randomUUID(),
    name: name.trim().slice(0, 60),
    email: email.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    status: 'active',
    kycStatus: 'verified',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    virtualBalance: STARTING_BALANCE,
    holdings: [],
    transactions: [],
    tags: [],
    notes: [],
    pendingOrders: [],
  };
  addUser(user);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, lastActiveAt: user.lastActiveAt });
});

// fallback error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Stratex] error:', err);
  res.status(500).json({ error: 'Error interno' });
});

// Only start the HTTP listener when run as a real server, not when imported by tests.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Stratex API en http://localhost:${PORT}`);
  });
}

export { app };
