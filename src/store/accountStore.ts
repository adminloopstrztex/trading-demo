import { create } from 'zustand';
import type { Holding, Transaction, PendingOrder, User } from '../types';
import { api, setToken, getToken } from '../api';

interface AuthUser extends User {
  id: string;
  role: 'user' | 'admin';
}

interface AccountSnapshot {
  virtualBalance: number;
  holdings: Holding[];
  transactions: Transaction[];
  pendingOrders: PendingOrder[];
}

interface AuthResponse {
  token: string;
  user: AuthUser;
  account: AccountSnapshot;
}

type Result = { ok: boolean; error?: string; executedPrice?: number };

interface AccountState {
  user: AuthUser | null;
  ready: boolean;
  virtualBalance: number;
  holdings: Holding[];
  transactions: Transaction[];
  pendingOrders: PendingOrder[];
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  trade: (side: 'buy' | 'sell', symbol: string, quantity: number, price: number) => Promise<Result>;
  createOrder: (
    type: 'limit' | 'stop',
    side: 'buy' | 'sell',
    symbol: string,
    quantity: number,
    targetPrice: number
  ) => Promise<Result>;
  cancelOrder: (id: string) => Promise<void>;
  executeOrder: (id: string, price: number) => Promise<void>;
}

function applySnapshot(user: AuthUser, snap: AccountSnapshot) {
  return {
    user,
    virtualBalance: snap.virtualBalance,
    holdings: snap.holdings,
    transactions: snap.transactions,
    pendingOrders: snap.pendingOrders ?? [],
  };
}

function setSnapshot(snap: AccountSnapshot) {
  return {
    virtualBalance: snap.virtualBalance,
    holdings: snap.holdings,
    transactions: snap.transactions,
    pendingOrders: snap.pendingOrders ?? [],
  };
}

export const useAccountStore = create<AccountState>((set) => ({
  user: null,
  ready: false,
  virtualBalance: 0,
  holdings: [],
  transactions: [],
  pendingOrders: [],

  restore: async () => {
    if (!getToken()) {
      set({ ready: true });
      return;
    }
    try {
      const data = await api<{ user: AuthUser; account: AccountSnapshot }>('/auth/me');
      set({ ...applySnapshot(data.user, data.account), ready: true });
    } catch {
      setToken(null);
      set({ ready: true });
    }
  },

  login: async (email, password) => {
    try {
      const data = await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
      setToken(data.token);
      set(applySnapshot(data.user, data.account));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  register: async (name, email, password) => {
    try {
      const data = await api<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password } });
      setToken(data.token);
      set(applySnapshot(data.user, data.account));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  logout: () => {
    setToken(null);
    set({ user: null, virtualBalance: 0, holdings: [], transactions: [], pendingOrders: [] });
  },

  trade: async (side, symbol, quantity, price) => {
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Cantidad inválida' };
    try {
      const data = await api<{ account: AccountSnapshot; executedPrice: number }>('/account/trade', {
        method: 'POST',
        body: { side, symbol, quantity, price },
      });
      set(setSnapshot(data.account));
      return { ok: true, executedPrice: data.executedPrice };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  createOrder: async (type, side, symbol, quantity, targetPrice) => {
    if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Cantidad inválida' };
    if (!Number.isFinite(targetPrice) || targetPrice <= 0)
      return { ok: false, error: 'Precio objetivo inválido' };
    try {
      const data = await api<{ account: AccountSnapshot }>('/account/orders', {
        method: 'POST',
        body: { type, side, symbol, quantity, targetPrice },
      });
      set(setSnapshot(data.account));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  cancelOrder: async (id) => {
    try {
      const data = await api<{ account: AccountSnapshot }>(`/account/orders/${id}`, { method: 'DELETE' });
      set(setSnapshot(data.account));
    } catch {
      // ignore; next snapshot will reconcile
    }
  },

  executeOrder: async (id, price) => {
    try {
      const data = await api<{ account: AccountSnapshot }>(`/account/orders/${id}/execute`, {
        method: 'POST',
        body: { price },
      });
      if (data.account) set(setSnapshot(data.account));
    } catch {
      // 409 (condition not yet met) or transient error: leave the order pending
    }
  },
}));
