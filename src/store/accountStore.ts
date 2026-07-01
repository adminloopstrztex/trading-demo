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
  buy: (symbol: string, quantity: number, price: number) => boolean;
  sell: (symbol: string, quantity: number, price: number) => boolean;
}

function applySnapshot(user: AuthUser, snap: AccountSnapshot) {
  return {
    user,
    virtualBalance: snap.virtualBalance,
    holdings: snap.holdings,
    transactions: snap.transactions,
  };
}

async function pushAccount(state: AccountState) {
  try {
    await api('/account', {
      method: 'PUT',
      body: {
        virtualBalance: state.virtualBalance,
        holdings: state.holdings,
        transactions: state.transactions,
      },
    });
  } catch {
    // offline / token expired: keep local state, will re-sync next action
  }
}

export const useAccountStore = create<AccountState>((set, get) => ({
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

  buy: (symbol, quantity, price) => {
    const cost = quantity * price;
    const state = get();
    if (cost > state.virtualBalance || quantity <= 0) return false;

    const existing = state.holdings.find((h) => h.symbol === symbol);
    let holdings: Holding[];
    if (existing) {
      const totalQty = existing.quantity + quantity;
      const avgPrice = (existing.avgPrice * existing.quantity + price * quantity) / totalQty;
      holdings = state.holdings.map((h) =>
        h.symbol === symbol ? { ...h, quantity: totalQty, avgPrice } : h
      );
    } else {
      holdings = [...state.holdings, { symbol, quantity, avgPrice: price }];
    }

    set({
      virtualBalance: state.virtualBalance - cost,
      holdings,
      transactions: [
        { id: crypto.randomUUID(), symbol, side: 'buy', quantity, price, timestamp: Date.now() },
        ...state.transactions,
      ],
    });
    pushAccount(get());
    return true;
  },

  sell: (symbol, quantity, price) => {
    const state = get();
    const existing = state.holdings.find((h) => h.symbol === symbol);
    if (!existing || existing.quantity < quantity || quantity <= 0) return false;

    const remaining = existing.quantity - quantity;
    const holdings =
      remaining === 0
        ? state.holdings.filter((h) => h.symbol !== symbol)
        : state.holdings.map((h) => (h.symbol === symbol ? { ...h, quantity: remaining } : h));

    set({
      virtualBalance: state.virtualBalance + quantity * price,
      holdings,
      transactions: [
        { id: crypto.randomUUID(), symbol, side: 'sell', quantity, price, timestamp: Date.now() },
        ...state.transactions,
      ],
    });
    pushAccount(get());
    return true;
  },
}));
