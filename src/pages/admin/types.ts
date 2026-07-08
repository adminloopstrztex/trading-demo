import type { Holding, Transaction } from '../../types';

export interface Metrics {
  totalUsers: number;
  newToday: number;
  newThisWeek: number;
  activeUsers: number;
  leads: number;
  suspended: number;
  kycVerified: number;
  kycPending: number;
  totalTrades: number;
  totalVolume: number;
  totalEquity: number;
  deltas: { users: number; trades: number; volume: number };
}

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'suspended';
  kycStatus: 'none' | 'pending' | 'verified';
  createdAt: number;
  lastActiveAt: number;
  virtualBalance: number;
  invested: number;
  volume: number;
  holdingsCount: number;
  tradesCount: number;
  tags: string[];
}

export interface AssetVolume {
  symbol: string;
  volume: number;
  trades: number;
}

export interface PagedUsers {
  items: CrmUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Note {
  id: string;
  text: string;
  at: number;
  by: string;
}

export interface CrmUserDetail extends CrmUser {
  holdings: Holding[];
  transactions: Transaction[];
  notes: Note[];
}
