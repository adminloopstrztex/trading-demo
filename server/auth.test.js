import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

describe('auth', () => {
  it('registra un usuario nuevo y devuelve token + cuenta', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'nuevo@test.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('nuevo@test.com');
    expect(res.body.account.virtualBalance).toBe(10000);
  });

  it('rechaza email duplicado', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Ana', email: 'dup@test.com', password: 'secret123' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'dup@test.com', password: 'secret123' });
    expect(res.status).toBe(409);
  });

  it('rechaza contraseña corta', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Carlos', email: 'corta@test.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('rechaza email inválido', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Diana', email: 'no-es-email', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('login con credenciales correctas del usuario semilla', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'demo1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('user');
  });

  it('rechaza contraseña incorrecta', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'mala' });
    expect(res.status).toBe(401);
  });

  it('bloquea /auth/me sin token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
