import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';

/**
 * B7 라운드 14 — markWrite 다중 탭 공유 (stability-audit-B § B7).
 * 단일 운영자가 여러 탭을 사용할 때, 한 탭의 쓰기가 다른 탭의 polling 에 grace 를 주지 않아
 * stale-overwrite 가 발생하던 race window 차단. BroadcastChannel 로 lastWriteAt 동기화.
 */
const SYNC_CHANNEL_NAME = 'sheets-sync';
const broadcastChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(SYNC_CHANNEL_NAME) : null;

export type SyncOpKind =
  | 'cycle.upsert' | 'cycle.delete'
  | 'template.upsert' | 'template.delete'
  | 'submission.upsert' | 'submission.delete'
  | 'audit.append';

/** 동기화 오류 유형 — 배너 색상/메시지/회복 안내를 가르는 핵심 신호. */
export type SyncErrorKind = 'transient' | 'permanent' | 'timeout';

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
  orgSyncErrorKind: SyncErrorKind | null;
  // 시트 ↔ 리뷰 운영 데이터 동기화 (경로 A)
  reviewSyncEnabled: boolean;
  reviewLastSyncedAt: string | null;
  reviewSyncError: string | null;
  reviewSyncErrorKind: SyncErrorKind | null;
  // 경로 A 실패 큐 + 최근 성공
  pendingOps: PendingSyncOp[];
  lastSuccessAt: string | null;
  // 최근 쓰기 타임스탬프 — OrgSync poll 의 stale-overwrite 방지용 (in-memory).
  lastWriteAt: number;
  /**
   * QA 라운드 12 B4 — 제출 성공 화면 노출 중 SyncStatusBanner 가 동시에 '저장 대기 중 1건'
   * 으로 노출돼 혼란 유발. submit 시점에 일정 시간 banner 를 일시 숨기는 timestamp.
   */
  submitSuppressUntil: number;

  setScriptUrl: (url: string) => void;
  setEnabled: (v: boolean) => void;
  markSynced: (cycleId: string) => void;
  setOrgSyncEnabled:     (v: boolean) => void;
  setOrgLastSyncedAt:    (at: string) => void;
  setOrgSyncError:       (msg: string | null, kind?: SyncErrorKind | null) => void;
  setReviewSyncEnabled:  (v: boolean) => void;
  setReviewLastSyncedAt: (at: string) => void;
  setReviewSyncError:    (msg: string | null, kind?: SyncErrorKind | null) => void;
  /** 쓰기 직전 호출 — useOrgSync 가 일정 시간 동안 poll 을 건너뛰어 stale 덮어쓰기 방지. */
  markWrite: () => void;
  /** QA 라운드 12 B4 — submit 후 N ms 동안 SyncStatusBanner 일시 숨김 */
  markSubmitSuppress: (untilMs: number) => void;

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
      scriptUrl: '',
      enabled: false,
      lastSyncAt: {},
      orgSyncEnabled: true,
      orgLastSyncedAt: null,
      orgSyncError: null,
      orgSyncErrorKind: null,
      reviewSyncEnabled: true,
      reviewLastSyncedAt: null,
      reviewSyncError: null,
      reviewSyncErrorKind: null,
      pendingOps: [],
      lastSuccessAt: null,
      lastWriteAt: 0,
      submitSuppressUntil: 0,

      setScriptUrl: (scriptUrl) => set({ scriptUrl }),
      setEnabled:   (enabled)  => set({ enabled }),
      markSynced:    (cycleId)   =>
        set(s => ({ lastSyncAt: { ...s.lastSyncAt, [cycleId]: new Date().toISOString() } })),
      setOrgSyncEnabled:     (orgSyncEnabled)     => set({ orgSyncEnabled }),
      setOrgLastSyncedAt:    (orgLastSyncedAt)    => set({ orgLastSyncedAt }),
      setOrgSyncError:       (orgSyncError, kind = null) => set({ orgSyncError, orgSyncErrorKind: orgSyncError ? kind : null }),
      setReviewSyncEnabled:  (reviewSyncEnabled)  => set({ reviewSyncEnabled }),
      setReviewLastSyncedAt: (reviewLastSyncedAt) => set({ reviewLastSyncedAt }),
      setReviewSyncError:    (reviewSyncError, kind = null) => set({ reviewSyncError, reviewSyncErrorKind: reviewSyncError ? kind : null }),
      markWrite: () => {
        const now = Date.now();
        set({ lastWriteAt: now });
        // B7 — 다른 탭에 broadcast (자신은 onmessage 안 받음, 같은 탭은 직접 set 으로 처리됨)
        broadcastChannel?.postMessage({ type: 'markWrite', at: now });
      },
      markSubmitSuppress: (untilMs) => set({ submitSuppressUntil: untilMs }),

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
        reviewSyncErrorKind: null,
      })),
      markOpFailure: (opId, error) => set(s => ({
        pendingOps: s.pendingOps.map(p =>
          p.id === opId
            ? { ...p, tryCount: p.tryCount + 1, lastError: error, lastTriedAt: new Date().toISOString() }
            : p
        ),
        reviewSyncError: error,
        // 큐 retry 실패는 보통 일시적 — 사용자가 재시도하거나 자동 polling 으로 회복 가능
        reviewSyncErrorKind: 'transient',
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
      merge: (persisted, current) => {
        const p = persisted as Partial<SheetsSyncState>;
        return {
          ...current,
          ...p,
          scriptUrl: p.scriptUrl || current.scriptUrl,
        };
      },
    },
  ),
);

// B7 라운드 14 — 다른 탭의 markWrite broadcast 수신 → 본 탭의 lastWriteAt 갱신.
// store 정의 직후 module-level setup (한 번만 등록).
// markWrite 를 다시 호출하지 않고 직접 setState 로 갱신해 broadcast 무한 루프 차단.
if (broadcastChannel) {
  broadcastChannel.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'markWrite' && typeof e.data.at === 'number') {
      const current = useSheetsSyncStore.getState().lastWriteAt;
      // 들어온 timestamp 가 더 최신일 때만 갱신 (시계 skew / 순서 뒤집힘 방지)
      if (e.data.at > current) {
        useSheetsSyncStore.setState({ lastWriteAt: e.data.at });
      }
    }
  });
}
