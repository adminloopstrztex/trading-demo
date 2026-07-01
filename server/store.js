import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seedData } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'db.json');

let db = { users: [] };

export function load() {
  if (existsSync(DB_PATH)) {
    try {
      db = JSON.parse(readFileSync(DB_PATH, 'utf-8'));
    } catch {
      db = { users: [] };
    }
  }
  if (!db.users || db.users.length === 0) {
    db = seedData();
    persist();
  }
  return db;
}

export function persist() {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function getDb() {
  return db;
}

export function findUserByEmail(email) {
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(id) {
  return db.users.find((u) => u.id === id);
}

export function addUser(user) {
  db.users.push(user);
  persist();
  return user;
}

export function saveUser(user) {
  const i = db.users.findIndex((u) => u.id === user.id);
  if (i >= 0) db.users[i] = user;
  persist();
  return user;
}
