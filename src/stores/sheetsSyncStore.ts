import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SheetsSyncState {
  scriptUrl: string;
  // 평가 결과 → 시트 동기화 (기존)
  enabled: boolean;
  lastSyncAt: Record<string, string>; // cycleId → ISO 날짜
  // 시트 ↔ 조직 데이터 동기화
  orgSyncEnabled: boolean;
  orgLastSyncedAt: string | null;
  orgSyncError: string | null;
  // 시트 ↔ 리뷰 운영 데이터 동기화
  reviewSyncEnabled: boolean;
  reviewLastSyncedAt: string | null;
  reviewSyncError: string | null;

  setScriptUrl: (url: string) => void;
  setEnabled: (v: boolean) => void;
  markSynced: (cycleId: string) => void;
  setOrgSyncEnabled:     (v: boolean) => void;
  setOrgLastSyncedAt:    (at: string) => void;
  setOrgSyncError:       (msg: string | null) => void;
  setReviewSyncEnabled:  (v: boolean) => void;
  setReviewLastSyncedAt: (at: string) => void;
  setReviewSyncError:    (msg: string | null) => void;
}

export const useSheetsSyncStore = create<SheetsSyncState>()(
  persist(
    (set) => ({
      // VITE_APPS_SCRIPT_URL이 있으면 기본값으로 사용 (로컬 개발용)
      scriptUrl: import.meta.env.VITE_APPS_SCRIPT_URL ?? '',
      enabled: false,
      lastSyncAt: {},
      orgSyncEnabled: true,
      orgLastSyncedAt: null,
      orgSyncError: null,
      reviewSyncEnabled: true,
      reviewLastSyncedAt: null,
      reviewSyncError: null,

      setScriptUrl:  (scriptUrl) => set({ scriptUrl }),
      setEnabled:    (enabled)   => set({ enabled }),
      markSynced:    (cycleId)   =>
        set(s => ({ lastSyncAt: { ...s.lastSyncAt, [cycleId]: new Date().toISOString() } })),
      setOrgSyncEnabled:     (orgSyncEnabled)     => set({ orgSyncEnabled }),
      setOrgLastSyncedAt:    (orgLastSyncedAt)    => set({ orgLastSyncedAt }),
      setOrgSyncError:       (orgSyncError)       => set({ orgSyncError }),
      setReviewSyncEnabled:  (reviewSyncEnabled)  => set({ reviewSyncEnabled }),
      setReviewLastSyncedAt: (reviewLastSyncedAt) => set({ reviewLastSyncedAt }),
      setReviewSyncError:    (reviewSyncError)    => set({ reviewSyncError }),
    }),
    {
      name: 'sheets-sync-config',
      partialize: (s) => ({
        scriptUrl:         s.scriptUrl,
        enabled:           s.enabled,
        lastSyncAt:        s.lastSyncAt,
        orgSyncEnabled:    s.orgSyncEnabled,
        reviewSyncEnabled: s.reviewSyncEnabled,
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
