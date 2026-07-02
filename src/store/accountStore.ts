import { create } from 'zustand';
import type { Holding, Transaction, User } from '../types';
import { api, setToken, getToken } from '../api';

interface AuthUser extends User {
  id: string;
  role: 'user' | 'admin';
}

interface AccountSnapshot {
  virtualBalance: number;
  holdings: Holding[];
  transactions: Transaction[];
}

interface AuthResponse {
  token: string;
  user: AuthUser;
  account: AccountSnapshot;
}

interface AccountState {
  user: AuthUser | null;
  ready: boolean;
  virtualBalance: number;
  holdings: Holding[];
  transactions: Transaction[];
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  trade: (
    side: 'buy' | 'sell',
    symbol: string,
    quantity: number,
    price: number
  ) => Promise<{ ok: boolean; error?: string; executedPrice?: number }>;
}

function applySnapshot(user: AuthUser, snap: AccountSnapshot) {
  return {
    user,
    virtualBalance: snap.virtualBalance,
    holdings: snap.holdings,
    transactions: snap.transactions,
  };
}

export const useAccountStore = create<AccountState>((set) => ({
  user: null,
  ready: false,
  virtualBalance: 0,
  holdings: [],
  transactions: [],

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
      const data = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setToken(data.token);
      set(applySnapshot(data.user, data.account));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  register: async (name, email, password) => {
    try {
      const data = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });
      setToken(data.token);
      set(applySnapshot(data.user, data.account));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  logout: () => {
    setToken(null);
    set({ user: null, virtualBalance: 0, holdings: [], transactions: [] });
  },

  trade: async (side, symbol, quantity, price) => {
    if (!Number.isFinite(quantity) || quantity <= 0)
      return { ok: false, error: 'Cantidad inválida' };
    try {
      const data = await api<{ account: AccountSnapshot; executedPrice: number }>(
        '/account/trade',
        { method: 'POST', body: { side, symbol, quantity, price } }
      );
      set({
        virtualBalance: data.account.virtualBalance,
        holdings: data.account.holdings,
        transactions: data.account.transactions,
      });
      return { ok: true, executedPrice: data.executedPrice };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },
}));
