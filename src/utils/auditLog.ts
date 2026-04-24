import { useAuditLogStore } from '../stores/auditLogStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { auditWriter } from './reviewSheetWriter';
import type { AuditLogEntry } from '../types';

/**
 * 감사 로그 기록 + 시트 동기화 (경로 A 큐 경유)
 */
export function recordAudit(entry: Omit<AuditLogEntry, 'id' | 'at'>): AuditLogEntry {
  const full = useAuditLogStore.getState().append(entry);
  if (useSheetsSyncStore.getState().reviewSyncEnabled) {
    void auditWriter.append(full);
  }
  return full;
}
