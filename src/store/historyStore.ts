import { create } from 'zustand';

interface Point {
  time: number;
  value: number;
}

interface HistoryState {
  equityHistory: Point[];
  pushEquity: (value: number) => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  equityHistory: [],
  pushEquity: (value) =>
    set((state) => {
      const time = Math.floor(Date.now() / 1000);
      const last = state.equityHistory[state.equityHistory.length - 1];
      if (last && last.time === time) return state;
      const equityHistory = [...state.equityHistory, { time, value }].slice(-180);
      return { equityHistory };
    }),
}));
