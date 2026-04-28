/**
 * R7: 신규 회원 승인 대기열 카운트 — Sidebar 배지 + Team 배너에서 공유.
 *
 * 단일 진실 = `대기승인` 시트의 status='pending' row 수.
 * 가벼운 폴링/리프레시만 담당하므로 영속화하지 않음 (페이지 진입 시 fetch).
 */
import { create } from 'zustand';
import { getPendingApprovals } from '../utils/authApi';

interface PendingApprovalsState {
  count: number;
  loading: boolean;
  lastFetchedAt: number;
  error: string | null;
  refresh: () => Promise<void>;
}

export const usePendingApprovalsStore = create<PendingApprovalsState>((set, get) => ({
  count: 0,
  loading: false,
  lastFetchedAt: 0,
  error: null,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const items = await getPendingApprovals();
      set({ count: items.length, loading: false, lastFetchedAt: Date.now() });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
        lastFetchedAt: Date.now(),
      });
    }
  },
}));
