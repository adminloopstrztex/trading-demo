import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { load, addUser, saveUser, findUserByEmail, findUserById, getDb } from './store.js';
import { isValidSymbol, fetchLivePrice, SYMBOLS } from './market.js';

const PORT = Number(process.env.PORT) || 4000;
const STARTING_BALANCE = 10000;
const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5180';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn(
    '[SimTrade] ADVERTENCIA: JWT_SECRET no está definido. Usando un secreto de desarrollo. ' +
      'Define JWT_SECRET en el entorno para producción.'
  );
}
const SECRET = JWT_SECRET || 'dev-only-insecure-secret';

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
  return { virtualBalance: u.virtualBalance, holdings: u.holdings, transactions: u.transactions };
}
function crmUser(u) {
  const invested = u.holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0);
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

    if (side === 'buy') {
      const cost = quantity * price;
      if (cost > user.virtualBalance) return res.status(400).json({ error: 'Saldo insuficiente' });
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
      if (!existing || existing.quantity < quantity)
        return res.status(400).json({ error: 'Posición insuficiente' });
      existing.quantity -= quantity;
      if (existing.quantity <= 1e-9) user.holdings = user.holdings.filter((h) => h.symbol !== symbol);
      user.virtualBalance += quantity * price;
    }

    user.transactions = [
      { id: randomUUID(), symbol, side, quantity, price, timestamp: Date.now() },
      ...user.transactions,
    ].slice(0, 500);
    touch(user);
    saveUser(user);
    res.json({ account: accountSnapshot(user), executedPrice: price });
  })
);

// ---- CRM (admin) ----
app.get('/api/admin/metrics', auth, adminOnly, (_req, res) => {
  const users = getDb().users.filter((u) => u.role === 'user');
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeUsers = users.filter((u) => u.transactions.length > 0);
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
  });
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const { q, status, kyc, segment } = req.query;
  let users = getDb().users.filter((u) => u.role === 'user');
  if (q) {
    const term = String(q).toLowerCase();
    users = users.filter((u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }
  if (status) users = users.filter((u) => u.status === status);
  if (kyc) users = users.filter((u) => u.kycStatus === kyc);
  if (segment === 'lead') users = users.filter((u) => u.transactions.length === 0);
  if (segment === 'active') users = users.filter((u) => u.transactions.length > 0);
  users.sort((a, b) => b.createdAt - a.createdAt);
  res.json(users.map(crmUser));
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

app.listen(PORT, () => {
  console.log(`SimTrade API en http://localhost:${PORT}`);
});
