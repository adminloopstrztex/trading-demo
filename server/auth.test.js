import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

// valid registration payload with the fields the form now sends
const reg = (over = {}) => ({
  firstName: 'Test',
  lastName: 'User',
  email: 'nuevo@test.com',
  phone: '+51 999 888 777',
  password: 'secret123',
  ...over,
});

describe('auth', () => {
  it('registra un usuario nuevo (nombre + apellido + teléfono) y devuelve token', async () => {
    const res = await request(app).post('/api/auth/register').send(reg());
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('nuevo@test.com');
    expect(res.body.account.virtualBalance).toBe(10000);
  });

  it('rechaza email duplicado', async () => {
    await request(app).post('/api/auth/register').send(reg({ email: 'dup@test.com' }));
    const res = await request(app).post('/api/auth/register').send(reg({ email: 'dup@test.com', firstName: 'Otro' }));
    expect(res.status).toBe(409);
  });

  it('rechaza contraseña corta', async () => {
    const res = await request(app).post('/api/auth/register').send(reg({ email: 'corta@test.com', password: '123' }));
    expect(res.status).toBe(400);
  });

  it('rechaza email inválido', async () => {
    const res = await request(app).post('/api/auth/register').send(reg({ email: 'no-es-email' }));
    expect(res.status).toBe(400);
  });

  it('rechaza teléfono inválido', async () => {
    const res = await request(app).post('/api/auth/register').send(reg({ email: 'tel@test.com', phone: 'abc' }));
    expect(res.status).toBe(400);
  });

  it('rechaza apellido faltante', async () => {
    const res = await request(app).post('/api/auth/register').send(reg({ email: 'ape@test.com', lastName: '' }));
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
