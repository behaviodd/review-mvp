import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import { useTeamStore } from './teamStore';
import type { User, ImpersonationLog } from '../types';

interface AuthState {
  currentUser: User | null;
  mustChangePassword: boolean;
  // R1/R5-b: 마스터 로그인 (impersonation)
  impersonatingFromId: string | null;       // 마스터 로그인 시 원본 admin id
  originalUser: User | null;                 // 복원용 admin 스냅샷
  activeImpersonationLogId: string | null;   // 현재 활성 로그 id (endedAt 기록용)
  impersonationLogs: ImpersonationLog[];     // 세션 내 발생 기록 — 시트로 동기화

  login: (user: User, mustChangePassword?: boolean) => void;
  logout: () => void;
  clearMustChangePassword: () => void;

  startImpersonation: (target: User, reason?: string) => ImpersonationLog | null;
  endImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      mustChangePassword: false,
      impersonatingFromId: null,
      originalUser: null,
      activeImpersonationLogId: null,
      impersonationLogs: [],

      login: (user, mustChangePassword = false) =>
        set({
          currentUser: user,
          mustChangePassword,
          impersonatingFromId: null,
          originalUser: null,
          activeImpersonationLogId: null,
        }),
      logout: () =>
        set({
          currentUser: null,
          mustChangePassword: false,
          impersonatingFromId: null,
          originalUser: null,
          activeImpersonationLogId: null,
        }),
      clearMustChangePassword: () => set({ mustChangePassword: false }),

      startImpersonation: (target, reason) => {
        const state = get();
        const actor = state.currentUser;
        if (!actor) return null;
        if (state.impersonatingFromId) return null; // 이미 impersonate 중
        // R6: admin role 또는 'auth.impersonate' 권한 보유자만 허용.
        if (actor.role !== 'admin') {
          const tg = useTeamStore.getState();
          const hasImpersonate = tg.permissionGroups.some(g =>
            g.memberIds.includes(actor.id) && g.permissions.includes('auth.impersonate')
          );
          if (!hasImpersonate) return null;
        }
        const log: ImpersonationLog = {
          id: `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          actorId: actor.id,
          targetUserId: target.id,
          startedAt: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        };
        // 사유는 추후 audit 로그에 기록 — 현재는 unused
        void reason;
        set({
          currentUser: target,
          impersonatingFromId: actor.id,
          originalUser: actor,
          activeImpersonationLogId: log.id,
          impersonationLogs: [...state.impersonationLogs, log],
        });
        return log;
      },

      endImpersonation: () => {
        const state = get();
        if (!state.impersonatingFromId || !state.originalUser) return;
        const activeLogId = state.activeImpersonationLogId;
        const logs = state.impersonationLogs.map(l =>
          l.id === activeLogId && !l.endedAt
            ? { ...l, endedAt: new Date().toISOString() }
            : l
        );
        set({
          currentUser: state.originalUser, // 원래 admin 으로 복원
          impersonatingFromId: null,
          originalUser: null,
          activeImpersonationLogId: null,
          impersonationLogs: logs,
        });
      },
    }),
    {
      name: 'review-auth',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        currentUser:               s.currentUser,
        mustChangePassword:        s.mustChangePassword,
        impersonatingFromId:       s.impersonatingFromId,
        originalUser:              s.originalUser,
        activeImpersonationLogId:  s.activeImpersonationLogId,
        // impersonationLogs 는 persist 안 함 — 세션 단위, 시트로 push
      }),
    }
  )
);
