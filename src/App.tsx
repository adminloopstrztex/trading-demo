import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAccountStore } from './store/accountStore';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Landing from './pages/Landing';
import AppShell from './components/AppShell';

// The app (/app/*) is lazy-loaded so the charting library (lightweight-charts)
// and app pages stay out of the initial bundle that the public landing loads.
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Invest = lazy(() => import('./pages/Invest'));
const InstrumentDetail = lazy(() => import('./pages/InstrumentDetail'));
const Orders = lazy(() => import('./pages/Orders'));
const Terminal = lazy(() => import('./pages/Terminal'));

// Admin/CRM is lazy-loaded so Recharts ships in its own chunk, out of the main bundle.
const AdminShell = lazy(() => import('./components/AdminShell'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminUserDetail = lazy(() => import('./pages/admin/UserDetail'));
const AdminLeads = lazy(() => import('./pages/admin/Leads'));
const AdminTeam = lazy(() => import('./pages/admin/Team'));

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
      <ErrorBoundary>
        <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route element={<AppShell />}>
            <Route path="/app" element={<Portfolio />} />
            <Route path="/app/terminal" element={<Terminal />} />
            <Route path="/app/invest" element={<Invest />} />
            <Route path="/app/invest/:symbol" element={<InstrumentDetail />} />
            <Route path="/app/orders" element={<Orders />} />
          </Route>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/users/:id" element={<AdminUserDetail />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/team" element={<AdminTeam />} />
          </Route>
        </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
