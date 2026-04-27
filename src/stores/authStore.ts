import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { User, ImpersonationLog } from '../types';

interface AuthState {
  currentUser: User | null;
  mustChangePassword: boolean;
  // R1: 마스터 로그인 (impersonation). UI 는 R5-b 에서 활성화.
  impersonatingFromId: string | null;       // 마스터 로그인 시 원본 admin id
  impersonationLogs: ImpersonationLog[];    // 세션 내 발생 기록 — 최종은 시트로

  login: (user: User, mustChangePassword?: boolean) => void;
  logout: () => void;
  clearMustChangePassword: () => void;

  // R1: impersonate
  startImpersonation: (target: User) => ImpersonationLog | null;
  endImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      mustChangePassword: false,
      impersonatingFromId: null,
      impersonationLogs: [],

      login: (user, mustChangePassword = false) =>
        set({ currentUser: user, mustChangePassword, impersonatingFromId: null }),
      logout: () =>
        set({ currentUser: null, mustChangePassword: false, impersonatingFromId: null }),
      clearMustChangePassword: () => set({ mustChangePassword: false }),

      startImpersonation: (target) => {
        const state = get();
        const actor = state.currentUser;
        if (!actor || actor.role !== 'admin') return null;
        if (state.impersonatingFromId) return null; // 이미 impersonate 중
        const log: ImpersonationLog = {
          id: `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          actorId: actor.id,
          targetUserId: target.id,
          startedAt: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        };
        set({
          currentUser: target,
          impersonatingFromId: actor.id,
          impersonationLogs: [...state.impersonationLogs, log],
        });
        return log;
      },

      endImpersonation: () => {
        const state = get();
        if (!state.impersonatingFromId) return;
        const fromId = state.impersonatingFromId;
        // 마지막 활성 로그에 endedAt 기록
        const logs = state.impersonationLogs.map((l, idx, arr) =>
          idx === arr.length - 1 && !l.endedAt ? { ...l, endedAt: new Date().toISOString() } : l
        );
        // 본인 복원: localStorage 의 안전한 currentUser 가 없으므로 actor id 만으로는 부족.
        // 실제 복원은 startImpersonation 호출자가 ID-based fetch 후 login() 으로 처리.
        // 여기서는 currentUser 를 null 로 만들고 호출자에게 fromId 반환 책임.
        set({
          currentUser: null,
          impersonatingFromId: null,
          impersonationLogs: logs,
          mustChangePassword: false,
        });
        // 호출자가 fromId 로 복원하도록 외부에서 처리 (R5-b UI 에서 구현).
        return;
        // (fromId 변수는 콜러가 dispatch 직후 useAuthStore.getState() 로 확인 가능)
        void fromId;
      },
    }),
    {
      name: 'review-auth',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        currentUser:        s.currentUser,
        mustChangePassword: s.mustChangePassword,
        impersonatingFromId: s.impersonatingFromId,
        // impersonationLogs 는 persist 안 함 — 세션 단위, 필요 시 시트로 직접 push
      }),
    }
  )
);
