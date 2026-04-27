/**
 * R6 Phase E: 마스터 로그인 감사 로그 조회 훅.
 * - 페이지 진입 시 1회 fetch + 5분 폴링 (선택적)
 * - 시트 미배포 시 빈 배열 폴백
 */
import { useEffect, useState, useCallback } from 'react';
import { getScriptHeaders } from '../utils/scriptHeaders';
import { parseImpersonationLogs } from '../utils/sheetParser';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import type { ImpersonationLog } from '../types';

interface SheetResponse {
  rows?: Record<string, unknown>[];
  error?: string;
}

const POLL_MS = 5 * 60_000;

export function useImpersonationLogs() {
  const scriptUrl = useSheetsSyncStore(s => s.scriptUrl);
  const [logs, setLogs] = useState<ImpersonationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!scriptUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/org-sync?action=getImpersonationLogs', {
        headers: getScriptHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SheetResponse = await res.json();
      if (data.error) throw new Error(data.error);
      const parsed = parseImpersonationLogs(data.rows ?? []);
      // 최신순 정렬
      parsed.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
      setLogs(parsed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setError(msg);
      console.error('[ImpersonationLogs] fetch failed:', msg);
    } finally {
      setLoading(false);
    }
  }, [scriptUrl]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}
