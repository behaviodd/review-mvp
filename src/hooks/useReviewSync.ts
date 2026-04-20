/**
 * Google Sheets ↔ 리뷰 운영 데이터 동기화 훅
 * - reviewSyncEnabled 가 true일 때 앱 시작 시 1회 + 5분 폴링
 * - 사이클·템플릿·제출내용 3개 탭을 병렬 조회
 */
import { useEffect, useCallback, useRef } from 'react';
import { useReviewStore } from '../stores/reviewStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import {
  parseSheetCycles,
  parseSheetTemplates,
  parseSheetSubmissions,
} from '../utils/reviewSheetParser';

const POLL_MS = 5 * 60_000; // 5분

interface SheetResponse {
  rows?: Record<string, unknown>[];
  ok?:  boolean;
  error?: string;
}

async function fetchTab(action: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`/api/review-sync?action=${action}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: SheetResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data.rows ?? [];
}

export function useReviewSync() {
  const { reviewSyncEnabled, setReviewLastSyncedAt, setReviewSyncError } = useSheetsSyncStore();
  const { syncFromSheet, setLoading } = useReviewStore();

  const enabledRef = useRef(reviewSyncEnabled);
  enabledRef.current = reviewSyncEnabled;

  const fetchAndSync = useCallback(async () => {
    if (!enabledRef.current) return;
    setLoading(true);
    setReviewSyncError(null);
    try {
      const [cycleRows, templateRows, submissionRows] = await Promise.all([
        fetchTab('getCycles'),
        fetchTab('getTemplates'),
        fetchTab('getSubmissions'),
      ]);
      syncFromSheet({
        cycles:      parseSheetCycles(cycleRows),
        templates:   parseSheetTemplates(templateRows),
        submissions: parseSheetSubmissions(submissionRows),
      });
      setReviewLastSyncedAt(new Date().toISOString());
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setReviewSyncError(msg);
      console.error('[ReviewSync]', msg);
    } finally {
      setLoading(false);
    }
  }, [syncFromSheet, setLoading, setReviewLastSyncedAt, setReviewSyncError]);

  useEffect(() => {
    fetchAndSync();
    if (!reviewSyncEnabled) return;
    const interval = setInterval(fetchAndSync, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchAndSync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAndSync, reviewSyncEnabled]);

  return { refetch: fetchAndSync };
}
