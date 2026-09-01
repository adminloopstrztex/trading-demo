import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seedData } from './seed.js';

// ---------------------------------------------------------------------------
// Storage engine: SQLite (Node's built-in `node:sqlite`, zero external infra).
//
// Each user is one row: indexed columns for the fields we filter/sort on, plus
// a `data` JSON blob holding the full document. Writes touch a single indexed
// row inside a real transaction (WAL mode → concurrent readers), instead of
// re-serializing and rewriting an entire JSON file on every request.
//
// The exported API is kept identical to the old file store, so the rest of the
// server is unchanged. A future move to PostgreSQL swaps only this module.
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const MEMORY = process.env.STRATEX_MEMORY === '1'; // tests: fresh in-memory DB
const DB_FILE = MEMORY ? ':memory:' : join(__dirname, 'stratex.db');

let db = null;
const stmtCache = new Map();

function stmt(sql) {
  let s = stmtCache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    stmtCache.set(sql, s);
  }
  return s;
}

const INSERT_SQL =
  'INSERT INTO users (id, email, role, status, kyc_status, created_at, last_active_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
const UPDATE_SQL =
  'UPDATE users SET email = ?, role = ?, status = ?, kyc_status = ?, created_at = ?, last_active_at = ?, data = ? WHERE id = ?';

// Extract the indexed columns from a user document.
function cols(user) {
  return {
    id: user.id,
    email: (user.email || '').toLowerCase(),
    role: user.role,
    status: user.status ?? null,
    kyc_status: user.kycStatus ?? null,
    created_at: user.createdAt ?? null,
    last_active_at: user.lastActiveAt ?? null,
    data: JSON.stringify(user),
  };
}

function insertUser(user) {
  const c = cols(user);
  stmt(INSERT_SQL).run(c.id, c.email, c.role, c.status, c.kyc_status, c.created_at, c.last_active_at, c.data);
}

export function load() {
  db = new DatabaseSync(DB_FILE);
  stmtCache.clear();
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE,
      role           TEXT NOT NULL,
      status         TEXT,
      kyc_status     TEXT,
      created_at     INTEGER,
      last_active_at INTEGER,
      data           TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
  `);

  const { count } = stmt('SELECT COUNT(*) AS count FROM users').get();
  if (count === 0) {
    const seed = seedData();
    db.exec('BEGIN');
    try {
      for (const u of seed.users) insertUser(u);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return getDb();
}

// Kept for API compatibility; writes are committed per-operation now.
export function persist() {}

// Returns the full set of users parsed — used only by admin aggregate endpoints
// (metrics, timeseries, asset volume, staff, the paginated user list). The
// user-facing hot paths use findUserById/findUserByEmail instead.
export function getDb() {
  const rows = stmt('SELECT data FROM users').all();
  return { users: rows.map((r) => JSON.parse(r.data)) };
}

export function findUserByEmail(email) {
  const row = stmt('SELECT data FROM users WHERE email = ?').get((email || '').toLowerCase());
  return row ? JSON.parse(row.data) : undefined;
}

export function findUserById(id) {
  const row = stmt('SELECT data FROM users WHERE id = ?').get(id);
  return row ? JSON.parse(row.data) : undefined;
}

export function addUser(user) {
  insertUser(user);
  return user;
}

export function saveUser(user) {
  const c = cols(user);
  stmt(UPDATE_SQL).run(c.email, c.role, c.status, c.kyc_status, c.created_at, c.last_active_at, c.data, c.id);
  return user;
}
