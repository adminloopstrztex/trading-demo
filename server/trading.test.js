import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

let token;
async function authed(method, path, body) {
  const req = request(app)[method](path).set('Authorization', `Bearer ${token}`);
  return body ? req.send(body) : req;
}

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstName: 'Trader', lastName: 'Test', email: 'trader@test.com', phone: '+51 900 000 000', password: 'secret123' });
  token = res.body.token;
});

describe('trading (mercado)', () => {
  it('compra AAPL: baja el saldo y crea la posición', async () => {
    const res = await authed('post', '/api/account/trade', { side: 'buy', symbol: 'AAPL', quantity: 1, price: 190 });
    expect(res.status).toBe(200);
    expect(res.body.account.virtualBalance).toBeCloseTo(9810, 2);
    const aapl = res.body.account.holdings.find((h) => h.symbol === 'AAPL');
    expect(aapl.quantity).toBe(1);
  });

  it('rechaza compra por saldo insuficiente', async () => {
    const res = await authed('post', '/api/account/trade', { side: 'buy', symbol: 'BTCUSD', quantity: 1000, price: 60000 });
    expect(res.status).toBe(400);
  });

  it('rechaza símbolo desconocido', async () => {
    const res = await authed('post', '/api/account/trade', { side: 'buy', symbol: 'HACK', quantity: 1, price: 1 });
    expect(res.status).toBe(400);
  });

  it('rechaza vender más de lo que se posee', async () => {
    const res = await authed('post', '/api/account/trade', { side: 'sell', symbol: 'AAPL', quantity: 999, price: 190 });
    expect(res.status).toBe(400);
  });
});

describe('órdenes límite / stop', () => {
  let orderId;

  it('crea una orden límite pendiente', async () => {
    const res = await authed('post', '/api/account/orders', {
      symbol: 'TSLA',
      side: 'buy',
      type: 'limit',
      quantity: 1,
      targetPrice: 150,
    });
    expect(res.status).toBe(200);
    expect(res.body.account.pendingOrders.length).toBeGreaterThanOrEqual(1);
    orderId = res.body.order.id;
  });

  it('no ejecuta si la condición no se cumple (precio por encima del límite de compra)', async () => {
    const res = await authed('post', `/api/account/orders/${orderId}/execute`, { price: 200 });
    expect(res.status).toBe(409);
  });

  it('ejecuta cuando el precio alcanza el objetivo', async () => {
    const res = await authed('post', `/api/account/orders/${orderId}/execute`, { price: 148 });
    expect(res.status).toBe(200);
    expect(res.body.account.pendingOrders.find((o) => o.id === orderId)).toBeUndefined();
    expect(res.body.account.holdings.find((h) => h.symbol === 'TSLA')).toBeTruthy();
  });

  it('cancela una orden pendiente', async () => {
    const created = await authed('post', '/api/account/orders', {
      symbol: 'NVDA',
      side: 'buy',
      type: 'limit',
      quantity: 1,
      targetPrice: 100,
    });
    const id = created.body.order.id;
    const res = await authed('delete', `/api/account/orders/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.account.pendingOrders.find((o) => o.id === id)).toBeUndefined();
  });
});
