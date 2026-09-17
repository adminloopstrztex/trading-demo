import type { Holding, Transaction } from '../../types';

export interface SurveyStats {
  responded: number;
  avgExperience: number;
  avgTech: number;
  experience: { beginner: number; intermediate: number; advanced: number };
  goals: Record<string, number>;
}

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
  survey: SurveyStats;
}

export interface OnboardingSurvey {
  tradingExperience: number | null;
  techComfort: number | null;
  goal: string | null;
}

export interface CrmUser {
  id: string;
  name: string;
  email: string;
  phone: string;
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
  survey: OnboardingSurvey | null;
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

export interface AuditEntry {
  id: string;
  at: number;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetId: string | null;
  targetName: string | null;
  detail: string | null;
}

export interface PagedAudit {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}
