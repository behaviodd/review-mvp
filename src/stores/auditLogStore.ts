import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { AuditAction, AuditLogEntry } from '../types';

interface AuditLogState {
  entries: AuditLogEntry[];
  append: (entry: Omit<AuditLogEntry, 'id' | 'at'>) => AuditLogEntry;
  byCycle: (cycleId: string) => AuditLogEntry[];
  byAction: (cycleId: string, action: AuditAction) => AuditLogEntry[];
  clearCycle: (cycleId: string) => void;
}

export const useAuditLogStore = create<AuditLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      append: (entry) => {
        const full: AuditLogEntry = {
          ...entry,
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: new Date().toISOString(),
        };
        set(s => ({ entries: [full, ...s.entries] }));
        return full;
      },
      byCycle: (cycleId) => get().entries.filter(e => e.cycleId === cycleId),
      byAction: (cycleId, action) =>
        get().entries.filter(e => e.cycleId === cycleId && e.action === action),
      clearCycle: (cycleId) =>
        set(s => ({ entries: s.entries.filter(e => e.cycleId !== cycleId) })),
    }),
    {
      name: 'review-audit-log-v1',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
