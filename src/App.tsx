import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAccountStore } from './store/accountStore';
import Login from './pages/Login';
import AppShell from './components/AppShell';
import Portfolio from './pages/Portfolio';
import Invest from './pages/Invest';
import InstrumentDetail from './pages/InstrumentDetail';
import Orders from './pages/Orders';
import AdminShell from './components/AdminShell';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminUserDetail from './pages/admin/UserDetail';
import AdminLeads from './pages/admin/Leads';

export default function App() {
  const restore = useAccountStore((s) => s.restore);
  const ready = useAccountStore((s) => s.ready);

  useEffect(() => {
    restore();
  }, [restore]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0D] text-[#8B92A0] text-sm">
        Cargando…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Portfolio />} />
          <Route path="/invest" element={<Invest />} />
          <Route path="/invest/:symbol" element={<InstrumentDetail />} />
          <Route path="/orders" element={<Orders />} />
        </Route>
        <Route element={<AdminShell />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/leads" element={<AdminLeads />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
