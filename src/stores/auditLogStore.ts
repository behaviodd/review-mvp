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

/**
 * B-2.4 (audit-B 매트릭스 B10): audit id 를 의미 필드의 deterministic hash 로 derive.
 *  - 같은 (cycleId, actorId, action, targetIds, summary) 가 5초 윈도우 안에 재발생하면
 *    같은 id → 큐 op id 도 자동 dedupe + Apps Script 측 dedupe 도 작동
 *  - 5초 = 사용자의 "재시도" 빠른 클릭 (~0.5~3초) 흡수 + 의도적 두 번째 액션
 *    (보통 5초 이상 간격) 과 분리. 매트릭스 미해결 § 8 #4 에서 빈도 측정 후 조정 가능
 *  - djb2 hash (Apps Script 의 simpleHash 와 동일 알고리즘)
 */
const AUDIT_DEDUPE_BUCKET_MS = 5_000;
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h & h;
  }
  return Math.abs(h).toString(36);
}
function deriveAuditId(entry: Omit<AuditLogEntry, 'id' | 'at'>): string {
  const seed = JSON.stringify({
    c: entry.cycleId,
    a: entry.actorId,
    k: entry.action,
    t: [...entry.targetIds].sort().join(','),
    s: entry.summary,
    b: Math.floor(Date.now() / AUDIT_DEDUPE_BUCKET_MS),
  });
  return 'audit-' + djb2(seed);
}

export const useAuditLogStore = create<AuditLogState>()(
  persist(
    (set, get) => ({
      entries: [],
      append: (entry) => {
        const id = deriveAuditId(entry);
        // in-memory dedupe — 같은 의미 이벤트 5초 윈도우 안 재호출 시 기존 entry 재사용
        const existing = get().entries.find(e => e.id === id);
        if (existing) return existing;

        const full: AuditLogEntry = {
          ...entry,
          id,
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
