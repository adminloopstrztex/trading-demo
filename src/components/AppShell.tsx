import { Navigate, Outlet } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import { useMarketTicker } from '../hooks/useMarketTicker';
import { useCryptoFeed } from '../hooks/useCryptoFeed';
import Sidebar from './Sidebar';

export default function AppShell() {
  useMarketTicker(1200);
  useCryptoFeed(20000);
  const user = useAccountStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex bg-[#0A0B0D]">
      <Sidebar />
      <div className="flex-1 min-w-0 min-h-screen flex flex-col">
        <main className="flex-1 min-h-0 max-w-[1400px] mx-auto w-full px-6 py-6 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
