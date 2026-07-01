import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { load, addUser, saveUser, findUserByEmail, findUserById, getDb } from './store.js';

const JWT_SECRET = 'simtrade-demo-secret-change-in-prod';
const PORT = 4000;
const STARTING_BALANCE = 10000;

load();

const app = express();
app.use(cors());
app.use(express.json());

// ---- helpers ----
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function accountSnapshot(u) {
  return {
    virtualBalance: u.virtualBalance,
    holdings: u.holdings,
    transactions: u.transactions,
  };
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
    const payload = jwt.verify(token, JWT_SECRET);
    const user = findUserById(payload.id);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
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

// ---- auth ----
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Faltan datos' });
  if (findUserByEmail(email)) return res.status(409).json({ error: 'Ese email ya está registrado' });
  const user = {
    id: randomUUID(),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 8),
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
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user), account: accountSnapshot(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = findUserByEmail(email || '');
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash))
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'Cuenta suspendida' });
  touch(user);
  saveUser(user);
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user), account: accountSnapshot(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user), account: accountSnapshot(req.user) });
});

// ---- account sync (trading app) ----
app.put('/api/account', auth, (req, res) => {
  const { virtualBalance, holdings, transactions } = req.body || {};
  if (typeof virtualBalance === 'number') req.user.virtualBalance = virtualBalance;
  if (Array.isArray(holdings)) req.user.holdings = holdings;
  if (Array.isArray(transactions)) req.user.transactions = transactions;
  touch(req.user);
  saveUser(req.user);
  res.json({ ok: true });
});

// ---- CRM (admin) ----
app.get('/api/admin/metrics', auth, adminOnly, (_req, res) => {
  const users = getDb().users.filter((u) => u.role === 'user');
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeUsers = users.filter((u) => u.transactions.length > 0);
  const metrics = {
    totalUsers: users.length,
    newToday: users.filter((u) => u.createdAt >= dayAgo).length,
    newThisWeek: users.filter((u) => u.createdAt >= weekAgo).length,
    activeUsers: activeUsers.length,
    leads: users.filter((u) => u.transactions.length === 0).length,
    suspended: users.filter((u) => u.status === 'suspended').length,
    kycVerified: users.filter((u) => u.kycStatus === 'verified').length,
    kycPending: users.filter((u) => u.kycStatus === 'pending').length,
    totalTrades: users.reduce((s, u) => s + u.transactions.length, 0),
    totalVolume: users.reduce(
      (s, u) => s + u.transactions.reduce((a, t) => a + t.quantity * t.price, 0),
      0
    ),
    totalEquity: users.reduce(
      (s, u) => s + u.virtualBalance + u.holdings.reduce((a, h) => a + h.avgPrice * h.quantity, 0),
      0
    ),
  };
  res.json(metrics);
});

app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const { q, status, kyc, segment } = req.query;
  let users = getDb().users.filter((u) => u.role === 'user');
  if (q) {
    const term = String(q).toLowerCase();
    users = users.filter(
      (u) => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    );
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
  res.json({
    ...crmUser(user),
    holdings: user.holdings,
    transactions: user.transactions,
    notes: user.notes || [],
  });
});

app.patch('/api/admin/users/:id', auth, adminOnly, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user || user.role === 'admin') return res.status(404).json({ error: 'No encontrado' });
  const { status, kycStatus, tags, resetBalance } = req.body || {};
  if (status) user.status = status;
  if (kycStatus) user.kycStatus = kycStatus;
  if (Array.isArray(tags)) user.tags = tags;
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
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Nota vacía' });
  const note = { id: randomUUID(), text, at: Date.now(), by: req.user.name };
  user.notes = [note, ...(user.notes || [])];
  saveUser(user);
  res.json(note);
});

app.listen(PORT, () => {
  console.log(`SimTrade API en http://localhost:${PORT}`);
});
