import { Link } from 'react-router-dom';
import { useAccountStore } from '../store/accountStore';
import AssetLogo from '../components/AssetLogo';

export default function Orders() {
  const transactions = useAccountStore((s) => s.transactions);
  const pendingOrders = useAccountStore((s) => s.pendingOrders);
  const cancelOrder = useAccountStore((s) => s.cancelOrder);

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-semibold text-[#F2F3F5]">Órdenes</h1>

      {/* Pending limit / stop orders */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[#8B92A0]">
          Pendientes {pendingOrders.length > 0 && <span className="text-[#5B6472]">· {pendingOrders.length}</span>}
        </h2>
        {pendingOrders.length === 0 ? (
          <div className="bg-[#101216] rounded-2xl border border-[#1E2128] p-6 text-center text-sm text-[#5B6472]">
            No tienes órdenes pendientes. Crea una orden límite o stop desde un activo.
          </div>
        ) : (
          <div className="bg-[#101216] rounded-2xl border border-[#1E2128] divide-y divide-[#1E2128]">
            {pendingOrders.map((o) => {
              const isBuy = o.side === 'buy';
              return (
                <div key={o.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <AssetLogo symbol={o.symbol} size={34} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#F2F3F5]">
                        <Link to={`/invest/${o.symbol}`} className="hover:text-[#16C784]">
                          {o.symbol}
                        </Link>
                        <span className={`ml-2 text-xs font-medium ${isBuy ? 'text-[#16C784]' : 'text-[#FF5C5C]'}`}>
                          {isBuy ? 'Compra' : 'Venta'} · {o.type === 'limit' ? 'Límite' : 'Stop'}
                        </span>
                      </div>
                      <div className="text-xs text-[#8B92A0]">
                        {o.quantity.toFixed(4)} u. · objetivo ${o.targetPrice.toLocaleString('es-ES')}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelOrder(o.id)}
                    className="text-xs font-medium text-[#8B92A0] hover:text-[#FF5C5C] border border-[#262A33] hover:border-[#FF5C5C]/40 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Executed history */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[#8B92A0]">Historial</h2>
        {transactions.length === 0 ? (
          <div className="bg-[#101216] rounded-2xl border border-[#1E2128] p-8 text-center text-sm text-[#5B6472]">
            Aún no has realizado operaciones.
          </div>
        ) : (
          <div className="bg-[#101216] rounded-2xl border border-[#1E2128] divide-y divide-[#1E2128]">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <AssetLogo symbol={t.symbol} size={36} />
                    <span
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border border-[#101216] ${
                        t.side === 'buy' ? 'bg-[#16C784] text-[#0A0B0D]' : 'bg-[#FF5C5C] text-[#0A0B0D]'
                      }`}
                    >
                      {t.side === 'buy' ? '↑' : '↓'}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-[#F2F3F5]">
                      {t.side === 'buy' ? 'Compra' : 'Venta'} de {t.symbol}
                    </div>
                    <div className="text-xs text-[#8B92A0]">{new Date(t.timestamp).toLocaleString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-[#F2F3F5]">${(t.quantity * t.price).toFixed(2)}</div>
                  <div className="text-xs text-[#8B92A0]">
                    {t.quantity.toFixed(4)} u. @ {t.price.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
