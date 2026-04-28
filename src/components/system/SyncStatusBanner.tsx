import { useEffect, useState } from 'react';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';
import { retryAll } from '../../utils/syncQueue';
import { refetchAllSync } from '../../utils/syncControl';
import { timeAgo } from '../../utils/dateUtils';
import { useShowToast } from '../ui/Toast';
import { MsAlertIcon, MsRefreshIcon, MsCancelIcon } from '../ui/MsIcons';

/**
 * 앱 상단 전역 동기화 배너.
 *
 * 표시 조건:
 *  - 동기화 오류가 있음 (orgSyncError / reviewSyncError) — 빨강(permanent) 또는 주황(transient/timeout)
 *  - 또는 저장 대기 op 가 있음 — 주황
 *
 * 재시도 동작:
 *  - 쓰기 큐(pendingOps) 일괄 재처리 + 양쪽 읽기 동기화 강제 refetch 동시 발화.
 *  - 둘 중 하나라도 회복되면 사용자가 빠르게 알 수 있음.
 *
 * 닫기:
 *  - 사용자가 닫아도 상태가 변하면(다른 오류/새 pending) 다시 표시.
 */
export function SyncStatusBanner() {
  const pendingOps         = useSheetsSyncStore(s => s.pendingOps);
  const reviewSyncError    = useSheetsSyncStore(s => s.reviewSyncError);
  const orgSyncError       = useSheetsSyncStore(s => s.orgSyncError);
  const reviewSyncErrorKind = useSheetsSyncStore(s => s.reviewSyncErrorKind);
  const orgSyncErrorKind   = useSheetsSyncStore(s => s.orgSyncErrorKind);
  const orgLastSyncedAt    = useSheetsSyncStore(s => s.orgLastSyncedAt);
  const reviewLastSyncedAt = useSheetsSyncStore(s => s.reviewLastSyncedAt);

  const showToast = useShowToast();
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hasPending = pendingOps.length > 0;
  const errorMessage = reviewSyncError ?? orgSyncError;
  const hasError = !!errorMessage;

  // 가장 심각한 kind 우선 (permanent > transient/timeout). 둘 다 없으면 null.
  const errorKind: 'permanent' | 'transient' | null = hasError
    ? (orgSyncErrorKind === 'permanent' || reviewSyncErrorKind === 'permanent'
        ? 'permanent'
        : 'transient')
    : null;

  // 상태 키 — 변하면 dismissed 리셋
  const stateKey = `${reviewSyncError ?? ''}|${orgSyncError ?? ''}|${pendingOps.length}`;
  useEffect(() => { setDismissed(false); }, [stateKey]);

  if ((!hasPending && !hasError) || dismissed) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const [queueResult] = await Promise.all([
        retryAll(),
        refetchAllSync(),
      ]);
      if (queueResult.failed === 0 && queueResult.total > 0) {
        showToast('success', `저장 대기 ${queueResult.success}건 동기화 완료`);
      } else if (queueResult.failed > 0) {
        showToast('error', `${queueResult.failed}건 재시도 실패 · 잠시 후 다시 시도해 주세요`);
      }
      // 읽기 refetch 결과는 훅 내부에서 자체 토스트 발화 (복구 토스트 / 실패 토스트)
    } finally {
      setRetrying(false);
    }
  };

  // 색상 결정: permanent → 빨강 (즉시 사용자 행동 필요) · 그 외 → 주황 (자동 회복 진행 중)
  const tone = errorKind === 'permanent'
    ? 'bg-red-005 border-red-020 text-red-070'
    : 'bg-orange-005 border-orange-020 text-orange-070';

  // 제목 메시지
  const title = (() => {
    if (errorKind === 'permanent') return '동기화 오류 — 설정/권한 확인 필요';
    if (errorKind === 'transient') return '동기화 일시 지연 — 자동 재시도 중';
    return `저장 대기 중 ${pendingOps.length}건`;
  })();

  // 마지막 성공 시각 — 두 동기화 중 더 최근 시점
  const lastSyncedAt = pickLatest(orgLastSyncedAt, reviewLastSyncedAt);
  const lastSyncedHint = hasError && lastSyncedAt
    ? `${timeAgo(lastSyncedAt)} 마지막 동기화 성공`
    : null;

  return (
    <div className={`flex items-center gap-2 border-b ${tone} px-4 py-2 text-xs font-medium`}>
      <MsAlertIcon size={14} className="shrink-0" />
      <span className="flex-1 min-w-0 truncate">
        <span>{title}</span>
        {errorMessage && (
          <span className="ml-2 opacity-70 font-normal">· {errorMessage}</span>
        )}
        {lastSyncedHint && (
          <span className="ml-2 opacity-70 font-normal">· {lastSyncedHint}</span>
        )}
      </span>
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="inline-flex items-center gap-1 rounded-md bg-white/60 hover:bg-white px-2 py-0.5 transition-colors disabled:opacity-50"
      >
        <MsRefreshIcon size={12} className={retrying ? 'animate-spin' : undefined} />
        {retrying ? '재시도 중' : '재시도'}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-md p-0.5 hover:bg-white/60 transition-colors"
        aria-label="배너 닫기"
      >
        <MsCancelIcon size={12} />
      </button>
    </div>
  );
}

/** 두 ISO 문자열 중 더 최근 값을 반환. 둘 다 null 이면 null. */
function pickLatest(a: string | null, b: string | null): string | null {
  if (a && b) return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
  return a ?? b;
}
