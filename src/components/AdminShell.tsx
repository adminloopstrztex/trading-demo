import { useState, type FormEvent } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import { api } from '../api';
import { toast } from '../store/toastStore';

export default function AdminShell() {
  const user = useAccountStore((s) => s.user);
  const logout = useAccountStore((s) => s.logout);
  const restore = useAccountStore((s) => s.restore);
  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  if (!user.permissions.includes('crm.view')) return <Navigate to="/app" replace />;

  const canManageRoles = user.permissions.includes('roles.manage');
  const ROLE_LABEL: Record<string, string> = {
    admin: 'Administrador',
    support: 'Soporte',
    viewer: 'Analista (solo lectura)',
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
      isActive ? 'bg-[#3B82F6]/15 text-[#60A5FA]' : 'text-[#8B92A0] hover:bg-white/5 hover:text-[#F2F3F5]'
    }`;

  return (
    <div className="min-h-screen flex bg-[#0A0B0D]">
      <aside className="w-60 h-screen sticky top-0 bg-[#0F1115] border-r border-[#1E2128] flex flex-col px-3 py-5">
        <div className="px-2 mb-1">
          <span className="font-semibold text-[16px] text-[#F2F3F5]">Stratex</span>
          <span className="ml-2 text-[10px] font-semibold text-[#60A5FA] bg-[#3B82F6]/15 rounded px-1.5 py-0.5">
            CRM
          </span>
        </div>
        <p className="px-2 text-[11px] text-[#5B6472] mb-6">Panel de administración</p>
        <nav className="flex flex-col gap-1">
          <NavLink to="/admin" className={linkClass} end>
            <Icon d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z" />
            Dashboard
          </NavLink>
          <NavLink to="/admin/users" className={linkClass}>
            <Icon d="M16 11a4 4 0 10-8 0 4 4 0 008 0zm-4 3c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z" />
            Usuarios
          </NavLink>
          <NavLink to="/admin/leads" className={linkClass}>
            <Icon d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
            Leads y KYC
          </NavLink>
          {canManageRoles && (
            <NavLink to="/admin/team" className={linkClass}>
              <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0H5zm14.5-9.5a2.5 2.5 0 10-3-2.4 4 4 0 011.8 3.3 4.6 4.6 0 011.2.1zM21 20h-2.6c.1-.6-.1-2.4-.9-3.6A5 5 0 0121 20z" />
              Equipo
            </NavLink>
          )}
          {canManageRoles && (
            <NavLink to="/admin/audit" className={linkClass}>
              <Icon d="M13 3H5v18h14V9h-6V3zm0 0l6 6M8 13h8M8 17h8M8 9h3" />
              Actividad
            </NavLink>
          )}
        </nav>
        <div className="mt-auto px-2 pt-4 border-t border-[#1E2128]">
          <div className="text-sm font-medium text-[#F2F3F5]">{user.name}</div>
          <div className="text-[11px] text-[#8B92A0] truncate" title={user.email}>{user.email}</div>
          <div className="text-[11px] text-[#5B6472] mb-1">{ROLE_LABEL[user.role] ?? user.role}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a href="/app" className="text-[#8B92A0] hover:text-[#F2F3F5]">
              Ver app
            </a>
            <button onClick={() => setEmailOpen(true)} className="text-[#8B92A0] hover:text-[#F2F3F5]">
              Correo
            </button>
            <button onClick={() => setPwOpen(true)} className="text-[#8B92A0] hover:text-[#F2F3F5]">
              Contraseña
            </button>
            <button onClick={logout} className="text-[#8B92A0] hover:text-[#FF5C5C]">
              Salir
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-7 max-w-[1200px]">
        <Outlet />
      </main>
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      {emailOpen && (
        <ChangeEmailModal
          currentEmail={user.email}
          onClose={() => setEmailOpen(false)}
          onChanged={() => restore()}
        />
      )}
    </div>
  );
}

function ChangeEmailModal({
  currentEmail,
  onClose,
  onChanged,
}: {
  currentEmail: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newEmail, setNewEmail] = useState('');
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Correo inválido', 'Escribe un correo con formato válido.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/email', { method: 'POST', body: { newEmail: email, currentPassword: current } });
      toast.success('Correo actualizado', `Ahora entras con ${email}.`);
      onChanged();
      onClose();
    } catch (err) {
      toast.error('No se pudo cambiar', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[#262A33] bg-[#101216] p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-[#F2F3F5]">Cambiar mi correo</h2>
        <p className="text-[11px] text-[#5B6472]">
          Correo actual: <span className="text-[#8B92A0]">{currentEmail}</span>
        </p>
        <div>
          <label className="block text-xs text-[#8B92A0] mb-1">Nuevo correo</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            placeholder="adminloop@stratex.capital"
            className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#8B92A0] mb-1">Confirma tu contraseña</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-xs font-medium text-[#8B92A0] hover:text-[#F2F3F5] px-3 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-xs font-semibold rounded-lg bg-[#3B82F6] hover:bg-[#2f6fd6] text-white px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Cambiar correo'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 6) {
      toast.error('Contraseña muy corta', 'La nueva debe tener al menos 6 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await api('/auth/password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      toast.success('Contraseña actualizada', 'Usa la nueva la próxima vez que entres.');
      onClose();
    } catch (err) {
      toast.error('No se pudo cambiar', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[#262A33] bg-[#101216] p-5 space-y-3"
      >
        <h2 className="text-sm font-semibold text-[#F2F3F5]">Cambiar mi contraseña</h2>
        <div>
          <label className="block text-xs text-[#8B92A0] mb-1">Contraseña actual</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="block text-xs text-[#8B92A0] mb-1">Nueva contraseña</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-lg border border-[#1E2128] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F3F5] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-xs font-medium text-[#8B92A0] hover:text-[#F2F3F5] px-3 py-2">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="text-xs font-semibold rounded-lg bg-[#3B82F6] hover:bg-[#2f6fd6] text-white px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Cambiar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d={d} />
    </svg>
  );
}
