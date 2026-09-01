import { useEffect, useRef } from 'react';
import { useAccountStore } from '../store/accountStore';
import { useMarketStore } from '../store/marketStore';
import { toast } from '../store/toastStore';
import type { PendingOrder } from '../types';

// Mirror of the server's trigger rules (server re-validates authoritatively).
export function orderTriggered(order: PendingOrder, price: number): boolean {
  if (order.type === 'limit') {
    return order.side === 'buy' ? price <= order.targetPrice : price >= order.targetPrice;
  }
  return order.side === 'buy' ? price >= order.targetPrice : price <= order.targetPrice;
}

// Watches live prices; when a pending order's condition is met, asks the server
// to execute it. The server re-checks against the authoritative price.
export function useOrderWatcher() {
  const pendingOrders = useAccountStore((s) => s.pendingOrders);
  const executeOrder = useAccountStore((s) => s.executeOrder);
  const assets = useMarketStore((s) => s.assets);
  const inflight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!pendingOrders.length) return;
    for (const o of pendingOrders) {
      const price = assets[o.symbol]?.price;
      if (!price || inflight.current.has(o.id)) continue;
      if (orderTriggered(o, price)) {
        inflight.current.add(o.id);
        const label = o.type === 'limit' ? 'límite' : 'stop';
        executeOrder(o.id, price)
          .then(() =>
            toast.success(
              'Orden ejecutada',
              `Se ejecutó tu orden ${label} de ${o.side === 'buy' ? 'compra' : 'venta'} de ${o.symbol} en $${price.toLocaleString('es-ES')}.`
            )
          )
          .finally(() => inflight.current.delete(o.id));
      }
    }
  }, [pendingOrders, assets, executeOrder]);
}
