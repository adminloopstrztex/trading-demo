import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAccountStore } from './store/accountStore';
import Login from './pages/Login';
import AppShell from './components/AppShell';
import Portfolio from './pages/Portfolio';
import Invest from './pages/Invest';
import InstrumentDetail from './pages/InstrumentDetail';
import Orders from './pages/Orders';

// Admin/CRM is lazy-loaded so Recharts ships in its own chunk, out of the main bundle.
const AdminShell = lazy(() => import('./components/AdminShell'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminUserDetail = lazy(() => import('./pages/admin/UserDetail'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0B0D] text-[#8B92A0] text-sm">
      Cargando…
    </div>
  );
}

export default function App() {
  const restore = useAccountStore((s) => s.restore);
  const ready = useAccountStore((s) => s.ready);

  useEffect(() => {
    restore();
  }, [restore]);

  if (!ready) return <FullScreenLoader />;

  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoader />}>
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
      </Suspense>
    </BrowserRouter>
  );
}
