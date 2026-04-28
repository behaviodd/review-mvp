import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';

export type SyncOpKind =
  | 'cycle.upsert' | 'cycle.delete'
  | 'template.upsert' | 'template.delete'
  | 'submission.upsert' | 'submission.delete'
  | 'audit.append';

export interface PendingSyncOp {
  id: string;                       // 'submission.upsert:sub-123'
  kind: SyncOpKind;
  action: string;                   // Apps Script action 이름
  targetId: string;
  payload: Record<string, unknown>; // 시트 컬럼 직렬화 결과
  queuedAt: string;
  tryCount: number;
  lastError?: string;
  lastTriedAt?: string;
}

interface SheetsSyncState {
  scriptUrl: string;
  // 평가 결과 → 시트 동기화 (기존)
  enabled: boolean;
  lastSyncAt: Record<string, string>; // cycleId → ISO 날짜
  // 시트 ↔ 조직 데이터 동기화
  orgSyncEnabled: boolean;
  orgLastSyncedAt: string | null;
  orgSyncError: string | null;
  // 시트 ↔ 리뷰 운영 데이터 동기화 (경로 A)
  reviewSyncEnabled: boolean;
  reviewLastSyncedAt: string | null;
  reviewSyncError: string | null;
  // 경로 A 실패 큐 + 최근 성공
  pendingOps: PendingSyncOp[];
  lastSuccessAt: string | null;
  // 최근 쓰기 타임스탬프 — OrgSync poll 의 stale-overwrite 방지용 (in-memory).
  lastWriteAt: number;

  setScriptUrl: (url: string) => void;
  setEnabled: (v: boolean) => void;
  markSynced: (cycleId: string) => void;
  setOrgSyncEnabled:     (v: boolean) => void;
  setOrgLastSyncedAt:    (at: string) => void;
  setOrgSyncError:       (msg: string | null) => void;
  setReviewSyncEnabled:  (v: boolean) => void;
  setReviewLastSyncedAt: (at: string) => void;
  setReviewSyncError:    (msg: string | null) => void;
  /** 쓰기 직전 호출 — useOrgSync 가 일정 시간 동안 poll 을 건너뛰어 stale 덮어쓰기 방지. */
  markWrite: () => void;

  // 큐 액션
  enqueueOp:    (op: Omit<PendingSyncOp, 'queuedAt' | 'tryCount'>) => void;
  markOpSuccess: (opId: string) => void;
  markOpFailure: (opId: string, error: string) => void;
  removeOp:     (opId: string) => void;
  clearOps:     () => void;
}

export const useSheetsSyncStore = create<SheetsSyncState>()(
  persist(
    (set) => ({
      scriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL ?? '',
      enabled: false,
      lastSyncAt: {},
      orgSyncEnabled: true,
      orgLastSyncedAt: null,
      orgSyncError: null,
      reviewSyncEnabled: true,
      reviewLastSyncedAt: null,
      reviewSyncError: null,
      pendingOps: [],
      lastSuccessAt: null,
      lastWriteAt: 0,

      setScriptUrl: (scriptUrl) => set({ scriptUrl }),
      setEnabled:   (enabled)  => set({ enabled }),
      markSynced:    (cycleId)   =>
        set(s => ({ lastSyncAt: { ...s.lastSyncAt, [cycleId]: new Date().toISOString() } })),
      setOrgSyncEnabled:     (orgSyncEnabled)     => set({ orgSyncEnabled }),
      setOrgLastSyncedAt:    (orgLastSyncedAt)    => set({ orgLastSyncedAt }),
      setOrgSyncError:       (orgSyncError)       => set({ orgSyncError }),
      setReviewSyncEnabled:  (reviewSyncEnabled)  => set({ reviewSyncEnabled }),
      setReviewLastSyncedAt: (reviewLastSyncedAt) => set({ reviewLastSyncedAt }),
      setReviewSyncError:    (reviewSyncError)    => set({ reviewSyncError }),
      markWrite: () => set({ lastWriteAt: Date.now() }),

      enqueueOp: (op) => set(s => {
        const queuedAt = new Date().toISOString();
        const existing = s.pendingOps.find(p => p.id === op.id);
        if (existing) {
          return {
            pendingOps: s.pendingOps.map(p =>
              p.id === op.id
                ? { ...existing, ...op, queuedAt, lastTriedAt: undefined, lastError: undefined }
                : p
            ),
          };
        }
        return { pendingOps: [...s.pendingOps, { ...op, queuedAt, tryCount: 0 }] };
      }),
      markOpSuccess: (opId) => set(s => ({
        pendingOps: s.pendingOps.filter(p => p.id !== opId),
        lastSuccessAt: new Date().toISOString(),
        reviewSyncError: null,
      })),
      markOpFailure: (opId, error) => set(s => ({
        pendingOps: s.pendingOps.map(p =>
          p.id === opId
            ? { ...p, tryCount: p.tryCount + 1, lastError: error, lastTriedAt: new Date().toISOString() }
            : p
        ),
        reviewSyncError: error,
      })),
      removeOp: (opId) => set(s => ({ pendingOps: s.pendingOps.filter(p => p.id !== opId) })),
      clearOps: () => set({ pendingOps: [] }),
    }),
    {
      name: 'sheets-sync-config',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        scriptUrl:         s.scriptUrl,
        enabled:           s.enabled,
        lastSyncAt:        s.lastSyncAt,
        orgSyncEnabled:    s.orgSyncEnabled,
        reviewSyncEnabled: s.reviewSyncEnabled,
        pendingOps:        s.pendingOps,
        lastSuccessAt:     s.lastSuccessAt,
      }),
      // localStorage에 빈 scriptUrl이 저장돼 있어도 env var로 채움
      merge: (persisted, current) => {
        const p = persisted as Partial<SheetsSyncState>;
        return {
          ...current,
          ...p,
          scriptUrl: p.scriptUrl || (import.meta.env.VITE_APPS_SCRIPT_URL ?? '') || current.scriptUrl,
        };
      },
    },
  ),
);
