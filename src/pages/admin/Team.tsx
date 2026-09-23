import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAccountStore } from '../../store/accountStore';
import { Avatar, Card, Skeleton } from './ui';
import { timeAgo } from './format';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'support' | 'viewer';
  lastActiveAt: number;
}

const ROLE_OPTIONS: { value: StaffMember['role']; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'support', label: 'Soporte' },
  { value: 'viewer', label: 'Analista (solo lectura)' },
];

const ROLE_MATRIX = [
  { perm: 'Ver el CRM (dashboard, usuarios, leads)', admin: true, support: true, viewer: true },
  { perm: 'Dejar notas en un cliente', admin: true, support: true, viewer: true },
  { perm: 'Moderar clientes (estado, KYC)', admin: true, support: true, viewer: false },
  { perm: 'Resetear saldo demo de un cliente', admin: true, support: false, viewer: true },
  { perm: 'Eliminar cliente / restablecer contraseña', admin: true, support: false, viewer: false },
  { perm: 'Gestionar roles del equipo', admin: true, support: false, viewer: false },
];

const EMPTY_FORM = { name: '', email: '', password: '', role: 'support' as StaffMember['role'] };

export default function AdminTeam() {
  const me = useAccountStore((s) => s.user);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    api<StaffMember[]>('/admin/staff').then(setStaff).catch((e) => setError((e as Error).message));
  }, []);

  async function changeRole(id: string, role: StaffMember['role']) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } });
      setStaff((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, role } : s)) : prev));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function addMember() {
    setAddError(null);
    if (!form.name.trim() || !form.email.trim() || form.password.length < 6) {
      setAddError('Completa nombre, email y una contraseña de 6+ caracteres.');
      return;
    }
    setAdding(true);
    try {
      const member = await api<StaffMember>('/admin/staff', { method: 'POST', body: form });
      setStaff((prev) => (prev ? [...prev, member].sort((a, b) => a.name.localeCompare(b.name)) : [member]));
      setForm(EMPTY_FORM);
      setShowAdd(false);
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-[#F2F3F5]">Equipo</h1>
        <p className="text-sm text-[#8B92A0]">Miembros del back-office y sus roles</p>
      </header>

      <Card
        title="Miembros"
        action={
          <button
            onClick={() => {
              setShowAdd((v) => !v);
              setAddError(null);
            }}
            className="text-xs font-medium rounded-lg bg-[#3B82F6] hover:bg-[#2f6fd6] text-white px-3 py-1.5"
          >
            {showAdd ? 'Cancelar' : '+ Añadir miembro'}
          </button>
        }
      >
        {showAdd && (
          <div className="mb-4 p-4 rounded-xl bg-[#0A0B0D] border border-[#1E2128] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Nombre y apellido" />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="persona@stratex.com" type="email" />
              <Field label="Contraseña" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="mínimo 6 caracteres" type="password" />
              <div>
                <label className="block text-xs text-[#8B92A0] mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as StaffMember['role'] })}
                  className="w-full rounded-lg border border-[#262A33] bg-[#101216] px-3 py-2 text-sm text-[#B8BFCC] outline-none focus-visible:border-[#3B82F6]"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#101216]">
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {addError && <p className="text-xs text-[#FF5C5C]">{addError}</p>}
            <div className="flex justify-end">
              <button
                onClick={addMember}
                disabled={adding}
                className="text-sm font-medium rounded-lg bg-[#16C784] hover:bg-[#13B374] text-[#0A0B0D] px-4 py-2 disabled:opacity-50"
              >
                {adding ? 'Creando…' : 'Crear miembro'}
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-[#FF5C5C] mb-3">{error}</p>}
        {!staff ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-44" />
                </div>
                <Skeleton className="h-8 w-40 rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-[#1A1D23] -my-1">
            {staff.map((s) => {
              const isMe = s.id === me?.id;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <Avatar name={s.name} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#F2F3F5] truncate flex items-center gap-2">
                      {s.name}
                      {isMe && <span className="text-[10px] text-[#8B92A0] bg-[#1E2128] rounded px-1.5 py-0.5">tú</span>}
                    </div>
                    <div className="text-xs text-[#8B92A0] truncate">
                      {s.email} · activo {timeAgo(s.lastActiveAt)}
                    </div>
                  </div>
                  <select
                    value={s.role}
                    disabled={isMe || busyId === s.id}
                    onChange={(e) => changeRole(s.id, e.target.value as StaffMember['role'])}
                    aria-label={`Rol de ${s.name}`}
                    title={isMe ? 'No puedes cambiar tu propio rol' : 'Cambiar rol'}
                    className="rounded-lg border border-[#262A33] bg-[#0A0B0D] px-3 py-1.5 text-sm text-[#B8BFCC] outline-none focus-visible:border-[#3B82F6] disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#101216]">
                        {o.label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Qué puede hacer cada rol">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-[11px] uppercase text-[#5B6472] text-left">
                <th className="pb-2 font-normal">Permiso</th>
                <th className="pb-2 font-normal text-center w-24">Admin</th>
                <th className="pb-2 font-normal text-center w-24">Soporte</th>
                <th className="pb-2 font-normal text-center w-24">Analista</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_MATRIX.map((row) => (
                <tr key={row.perm} className="border-t border-[#1A1D23]">
                  <td className="py-2 text-[#D5DAE2]">{row.perm}</td>
                  <Cell on={row.admin} />
                  <Cell on={row.support} />
                  <Cell on={row.viewer} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-[#8B92A0] mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#262A33] bg-[#101216] px-3 py-2 text-sm text-[#F2F3F5] placeholder:text-[#5B6472] outline-none focus-visible:border-[#3B82F6]"
      />
    </div>
  );
}

function Cell({ on }: { on: boolean }) {
  return (
    <td className="py-2 text-center">
      {on ? (
        <span className="text-[#16C784]" aria-label="Sí">
          ✓
        </span>
      ) : (
        <span className="text-[#3A3F4B]" aria-label="No">
          —
        </span>
      )}
    </td>
  );
}
