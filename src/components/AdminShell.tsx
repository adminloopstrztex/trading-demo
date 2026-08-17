import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';

export default function AdminShell() {
  const user = useAccountStore((s) => s.user);
  const logout = useAccountStore((s) => s.logout);

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
        </nav>
        <div className="mt-auto px-2 pt-4 border-t border-[#1E2128]">
          <div className="text-sm font-medium text-[#F2F3F5]">{user.name}</div>
          <div className="text-[11px] text-[#5B6472] mb-1">{ROLE_LABEL[user.role] ?? user.role}</div>
          <div className="flex gap-3 text-xs">
            <a href="/app" className="text-[#8B92A0] hover:text-[#F2F3F5]">
              Ver app
            </a>
            <button onClick={logout} className="text-[#8B92A0] hover:text-[#FF5C5C]">
              Salir
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-8 py-7 max-w-[1200px]">
        <Outlet />
      </main>
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
