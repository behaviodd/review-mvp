import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SheetsSyncState {
  scriptUrl: string;
  enabled: boolean;
  lastSyncAt: Record<string, string>; // cycleId → ISO 날짜
  setScriptUrl: (url: string) => void;
  setEnabled: (v: boolean) => void;
  markSynced: (cycleId: string) => void;
}

export const useSheetsSyncStore = create<SheetsSyncState>()(
  persist(
    (set) => ({
      scriptUrl: '',
      enabled: false,
      lastSyncAt: {},

      setScriptUrl: (scriptUrl) => set({ scriptUrl }),
      setEnabled: (enabled) => set({ enabled }),
      markSynced: (cycleId) =>
        set(s => ({
          lastSyncAt: { ...s.lastSyncAt, [cycleId]: new Date().toISOString() },
        })),
    }),
    {
      name: 'sheets-sync-config',
      partialize: (s) => ({
        scriptUrl: s.scriptUrl,
        enabled: s.enabled,
        lastSyncAt: s.lastSyncAt,
      }),
    },
  ),
);
