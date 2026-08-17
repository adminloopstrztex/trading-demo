import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

const bearer = (t) => ({ Authorization: `Bearer ${t}` });
async function login(email, password) {
  const r = await request(app).post('/api/auth/login').send({ email, password });
  return r.body.token;
}

let admin, support, viewer, customerId;

beforeAll(async () => {
  admin = await login('admin@stratex.com', 'admin123');
  support = await login('soporte@stratex.com', 'demo1234');
  viewer = await login('analista@stratex.com', 'demo1234');
  const list = await request(app).get('/api/admin/users?pageSize=1').set(bearer(admin));
  customerId = list.body.items[0].id;
});

describe('permisos por rol (RBAC)', () => {
  it('soporte trae permisos de moderación pero no de reset/roles', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'soporte@stratex.com', password: 'demo1234' });
    expect(r.body.user.role).toBe('support');
    expect(r.body.user.permissions).toContain('users.moderate');
    expect(r.body.user.permissions).not.toContain('users.reset');
    expect(r.body.user.permissions).not.toContain('roles.manage');
  });

  it('viewer ve métricas pero no puede moderar', async () => {
    expect((await request(app).get('/api/admin/metrics').set(bearer(viewer))).status).toBe(200);
    const r = await request(app).patch(`/api/admin/users/${customerId}`).set(bearer(viewer)).send({ status: 'suspended' });
    expect(r.status).toBe(403);
  });

  it('soporte modera pero no resetea saldos', async () => {
    const ok = await request(app).patch(`/api/admin/users/${customerId}`).set(bearer(support)).send({ kycStatus: 'pending' });
    expect(ok.status).toBe(200);
    const reset = await request(app).patch(`/api/admin/users/${customerId}`).set(bearer(support)).send({ resetBalance: true });
    expect(reset.status).toBe(403);
  });

  it('solo admin gestiona roles', async () => {
    const denied = await request(app).patch('/api/admin/users/staff-viewer/role').set(bearer(support)).send({ role: 'admin' });
    expect(denied.status).toBe(403);
    const ok = await request(app).patch('/api/admin/users/staff-viewer/role').set(bearer(admin)).send({ role: 'support' });
    expect(ok.status).toBe(200);
    expect(ok.body.role).toBe('support');
  });

  it('el admin no puede cambiar su propio rol', async () => {
    const r = await request(app).patch('/api/admin/users/admin-1/role').set(bearer(admin)).send({ role: 'viewer' });
    expect(r.status).toBe(400);
  });

  it('lista el equipo (staff)', async () => {
    const r = await request(app).get('/api/admin/staff').set(bearer(admin));
    expect(r.status).toBe(200);
    expect(r.body.some((s) => s.role === 'admin')).toBe(true);
  });

  it('el admin crea un nuevo miembro del equipo', async () => {
    const r = await request(app)
      .post('/api/admin/staff')
      .set(bearer(admin))
      .send({ name: 'Nuevo Agente', email: 'agente@stratex.com', password: 'secret123', role: 'support' });
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('support');
    const staff = await request(app).get('/api/admin/staff').set(bearer(admin));
    expect(staff.body.some((s) => s.email === 'agente@stratex.com')).toBe(true);
  });

  it('soporte no puede crear miembros', async () => {
    const r = await request(app)
      .post('/api/admin/staff')
      .set(bearer(support))
      .send({ name: 'X Y', email: 'x@stratex.com', password: 'secret123', role: 'viewer' });
    expect(r.status).toBe(403);
  });

  it('el admin promueve un cliente a miembro del equipo', async () => {
    const r = await request(app).patch(`/api/admin/users/${customerId}/role`).set(bearer(admin)).send({ role: 'support' });
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('support');
    // ya no aparece en la lista de clientes
    const list = await request(app).get('/api/admin/users?pageSize=100').set(bearer(admin));
    expect(list.body.items.some((u) => u.id === customerId)).toBe(false);
  });
});
