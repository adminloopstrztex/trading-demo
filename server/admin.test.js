import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

let adminToken;
let userToken;

beforeAll(async () => {
  const a = await request(app).post('/api/auth/login').send({ email: 'admin@simtrade.com', password: 'admin123' });
  adminToken = a.body.token;
  const u = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'demo1234' });
  userToken = u.body.token;
});

describe('CRM autorización', () => {
  it('el admin accede a las métricas', async () => {
    const res = await request(app).get('/api/admin/metrics').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeGreaterThan(0);
    expect(res.body.deltas).toBeTruthy();
  });

  it('un usuario normal recibe 403 en endpoints de admin', async () => {
    const res = await request(app).get('/api/admin/metrics').set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });
});

describe('CRM usuarios (paginado)', () => {
  it('devuelve items + total y respeta pageSize', async () => {
    const res = await request(app)
      .get('/api/admin/users?page=1&pageSize=3')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(3);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('ordena por equity de mayor a menor', async () => {
    const res = await request(app)
      .get('/api/admin/users?sort=equity&pageSize=5')
      .set('Authorization', `Bearer ${adminToken}`);
    const equities = res.body.items.map((u) => u.virtualBalance + u.invested);
    const sorted = [...equities].sort((a, b) => b - a);
    expect(equities).toEqual(sorted);
  });

  it('filtra por segmento lead (usuarios sin operaciones)', async () => {
    const res = await request(app)
      .get('/api/admin/users?segment=lead&pageSize=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.items.every((u) => u.tradesCount === 0)).toBe(true);
  });

  it('permite añadir una nota interna a un usuario', async () => {
    const list = await request(app)
      .get('/api/admin/users?pageSize=1')
      .set('Authorization', `Bearer ${adminToken}`);
    const id = list.body.items[0].id;
    const res = await request(app)
      .post(`/api/admin/users/${id}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Nota de prueba' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe('Nota de prueba');
  });
});
