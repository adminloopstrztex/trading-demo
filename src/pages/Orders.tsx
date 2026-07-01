import { useAccountStore } from '../store/accountStore';
import AssetLogo from '../components/AssetLogo';

export default function Orders() {
  const transactions = useAccountStore((s) => s.transactions);

  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-semibold text-[#F2F3F5]">Órdenes</h1>

      {transactions.length === 0 ? (
        <div className="bg-[#101216] rounded-2xl border border-[#1E2128] p-8 text-center text-sm text-[#8B92A0]">
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
                <div className="text-xs text-[#8B92A0]">{t.quantity.toFixed(4)} u. @ {t.price.toFixed(2)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
