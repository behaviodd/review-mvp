import { useState } from 'react';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';
import { retryAll } from '../../utils/syncQueue';
import { useShowToast } from '../ui/Toast';
import { MsAlertIcon, MsRefreshIcon, MsCancelIcon } from '../ui/MsIcons';

/**
 * 앱 상단 전역 배너. 저장 대기 중(pendingOps > 0) 또는 최근 동기화 에러가 있을 때 노출.
 * '재시도' 한 번으로 모든 pending 연산을 일괄 재처리한다.
 */
export function SyncStatusBanner() {
  const pendingOps = useSheetsSyncStore(s => s.pendingOps);
  const reviewSyncError = useSheetsSyncStore(s => s.reviewSyncError);
  const orgSyncError = useSheetsSyncStore(s => s.orgSyncError);
  const showToast = useShowToast();
  const [retrying, setRetrying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hasPending = pendingOps.length > 0;
  const hasError = !!(reviewSyncError || orgSyncError);
  if ((!hasPending && !hasError) || dismissed) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const result = await retryAll();
      if (result.failed === 0 && result.total > 0) {
        showToast('success', `저장 대기 ${result.success}건 동기화 완료`);
      } else if (result.failed > 0) {
        showToast('error', `${result.failed}건 재시도 실패 · 잠시 후 다시 시도해 주세요`);
      } else {
        showToast('info', '재시도할 항목이 없습니다');
      }
    } finally {
      setRetrying(false);
    }
  };

  const tone = hasError
    ? 'bg-red-005 border-red-020 text-red-070'
    : 'bg-orange-005 border-orange-020 text-orange-070';

  const label = hasError
    ? (reviewSyncError ?? orgSyncError ?? '동기화 오류')
    : `저장 대기 중 ${pendingOps.length}건`;

  return (
    <div className={`flex items-center gap-2 border-b ${tone} px-4 py-2 text-xs font-medium`}>
      <MsAlertIcon size={14} className="shrink-0" />
      <span className="flex-1 truncate">
        {hasError ? '동기화 오류: ' : ''}{label}
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
