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
import { getScriptHeaders } from '../utils/scriptHeaders';
import { useShowToast } from '../components/ui/Toast';
import type { ReviewCycle, ReviewSubmission, ReviewTemplate } from '../types';

const POLL_MS = 5 * 60_000; // 5분

interface SheetResponse {
  rows?: Record<string, unknown>[];
  ok?:  boolean;
  error?: string;
}

async function fetchTab(action: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(`/api/review-sync?action=${action}`, { headers: getScriptHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: SheetResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data.rows ?? [];
}

export function useReviewSync() {
  const { scriptUrl, reviewSyncEnabled, setReviewLastSyncedAt, setReviewSyncError } = useSheetsSyncStore();
  const { syncFromSheet, setLoading } = useReviewStore();
  const showToast = useShowToast();

  const enabledRef = useRef(reviewSyncEnabled);
  enabledRef.current = reviewSyncEnabled;
  // 직전 에러 상태 기억 — 최초 발생 시 1회만 토스트 알림 (폴링 반복 에러 스팸 방지)
  const prevErrorRef = useRef<string | null>(null);

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

      // ── 시트 삭제가 아직 반영되지 않은 항목을 fetch 결과에서 제외 ──
      // 삭제 큐에 있는 op(cycle.delete / submission.delete)의 targetId를 기록.
      // 시트가 실제로 지워지면 큐에서 op이 빠지며 필터도 자동 해제됨.
      const pending = useSheetsSyncStore.getState().pendingOps;
      const pendingDeleteCycleIds     = new Set(pending.filter(o => o.kind === 'cycle.delete').map(o => o.targetId));
      const pendingDeleteSubmissionIds = new Set(pending.filter(o => o.kind === 'submission.delete').map(o => o.targetId));
      // 해당 사이클이 삭제 대기중이면 그 사이클의 submissions/template도 함께 숨겨야 완전 일관
      // (template는 명시적 삭제만 제거; submissions는 cycleId 기준으로 드롭)
      const parsedCycles      = cycleRows.length      > 0 ? parseSheetCycles(cycleRows)           : undefined;
      const parsedTemplates   = templateRows.length   > 0 ? parseSheetTemplates(templateRows)     : undefined;
      const parsedSubmissions = submissionRows.length > 0 ? parseSheetSubmissions(submissionRows) : undefined;

      const filteredCycles: ReviewCycle[] | undefined = parsedCycles
        ? parsedCycles.filter(c => !pendingDeleteCycleIds.has(c.id))
        : undefined;
      const filteredSubmissions: ReviewSubmission[] | undefined = parsedSubmissions
        ? parsedSubmissions.filter(s =>
            !pendingDeleteSubmissionIds.has(s.id) &&
            !pendingDeleteCycleIds.has(s.cycleId)
          )
        : undefined;
      const filteredTemplates: ReviewTemplate[] | undefined = parsedTemplates;

      syncFromSheet({
        cycles:      filteredCycles,
        templates:   filteredTemplates,
        submissions: filteredSubmissions,
      });
      setReviewLastSyncedAt(new Date().toISOString());
      if (prevErrorRef.current) {
        // 복구 성공 — 사용자에게 알림
        showToast('success', '동기화가 복구되었어요');
        prevErrorRef.current = null;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setReviewSyncError(msg);
      console.error('[ReviewSync]', msg);
      if (prevErrorRef.current !== msg) {
        // 최초 발생 또는 에러 메시지가 변경된 경우에만 토스트
        showToast('error', `동기화 실패: ${msg}`);
        prevErrorRef.current = msg;
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncFromSheet, setLoading, setReviewLastSyncedAt, setReviewSyncError, scriptUrl]);

  useEffect(() => {
    if (!scriptUrl) return;
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
    // scriptUrl 변경은 fetchAndSync 의 deps 통해 전이적으로 반영됨.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAndSync, reviewSyncEnabled]);

  return { refetch: fetchAndSync };
}
