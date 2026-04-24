import { useState } from 'react';
import { useSheetsSyncStore, type PendingSyncOp, type SyncOpKind } from '../../stores/sheetsSyncStore';
import { retryAll, retryOp } from '../../utils/syncQueue';
import { MsButton } from '../ui/MsButton';
import { MsRefreshIcon, MsDeleteIcon, MsWarningIcon } from '../ui/MsIcons';
import { useShowToast } from '../ui/Toast';
import { SideDrawer } from '../ui/SideDrawer';
import { timeAgo } from '../../utils/dateUtils';
import { cn } from '../../utils/cn';

const KIND_LABEL: Record<SyncOpKind, string> = {
  'cycle.upsert':      '사이클 저장',
  'cycle.delete':      '사이클 삭제',
  'template.upsert':   '템플릿 저장',
  'template.delete':   '템플릿 삭제',
  'submission.upsert': '제출 저장',
  'submission.delete': '제출 삭제',
  'audit.append':      '감사 로그',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SyncRetryDrawer({ open, onClose }: Props) {
  const pendingOps = useSheetsSyncStore(s => s.pendingOps);
  const lastSuccessAt = useSheetsSyncStore(s => s.lastSuccessAt);
  const removeOp = useSheetsSyncStore(s => s.removeOp);
  const clearOps = useSheetsSyncStore(s => s.clearOps);
  const [retrying, setRetrying] = useState<string | null>(null); // op id or 'all'
  const [confirmClear, setConfirmClear] = useState(false);
  const showToast = useShowToast();

  if (!open) return null;

  const handleRetryOne = async (op: PendingSyncOp) => {
    setRetrying(op.id);
    const ok = await retryOp(op);
    setRetrying(null);
    showToast(ok ? 'success' : 'error', ok ? '재시도 성공' : `실패: ${op.kind}`);
  };

  const handleRetryAll = async () => {
    if (pendingOps.length === 0) return;
    setRetrying('all');
    const res = await retryAll();
    setRetrying(null);
    if (res.failed === 0) {
      showToast('success', `${res.success}건 재시도 성공`);
    } else {
      showToast('error', `${res.success}건 성공 · ${res.failed}건 실패`);
    }
  };

  const handleClear = () => {
    clearOps();
    setConfirmClear(false);
    showToast('info', '큐를 비웠습니다. 실패 이력이 제거되었어요.');
  };

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="시트 동기화 상태"
      description={lastSuccessAt ? `마지막 성공: ${timeAgo(lastSuccessAt)}` : '아직 성공 이력이 없습니다.'}
      width="lg"
    >
      <>
        <div className="flex items-center gap-2 border-b border-gray-010 bg-gray-001 px-5 py-2.5">
          <span className="text-xs text-gray-060">대기 {pendingOps.length}건</span>
          <span className="text-xs text-red-060">
            실패 {pendingOps.filter(p => p.tryCount > 0).length}건
          </span>
          <div className="ml-auto flex items-center gap-2">
            <MsButton
              variant="outline-default"
              size="sm"
              onClick={handleRetryAll}
              disabled={pendingOps.length === 0 || retrying !== null}
              leftIcon={<MsRefreshIcon className={retrying === 'all' ? 'animate-spin' : ''} />}
            >
              전체 재시도
            </MsButton>
            <MsButton
              variant="outline-red"
              size="sm"
              onClick={() => setConfirmClear(true)}
              disabled={pendingOps.length === 0 || retrying !== null}
              leftIcon={<MsDeleteIcon />}
            >
              큐 비우기
            </MsButton>
          </div>
        </div>

        {confirmClear && (
          <div className="flex items-start gap-2 border-b border-red-020 bg-red-005 px-5 py-3">
            <MsWarningIcon size={16} className="mt-0.5 shrink-0 text-red-050" />
            <div className="flex-1 text-xs text-red-070">
              실패한 {pendingOps.length}건의 쓰기 요청이 영구 삭제됩니다. 시트에 반영되지 않은 데이터는 복구되지 않습니다.
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <MsButton variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>취소</MsButton>
              <MsButton variant="red" size="sm" onClick={handleClear}>비우기 확정</MsButton>
            </div>
          </div>
        )}

        <div>
          {pendingOps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-semibold text-gray-070">대기 중인 항목이 없습니다.</p>
              <p className="mt-1 text-xs text-gray-040">모든 변경 사항이 시트에 반영되었어요.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-005">
              {pendingOps.map(op => {
                const failed = op.tryCount > 0;
                return (
                  <li key={op.id} className="flex flex-col gap-1 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
                        failed ? 'bg-red-005 text-red-070' : 'bg-orange-005 text-orange-070',
                      )}>
                        {failed ? `실패 ${op.tryCount}회` : '대기 중'}
                      </span>
                      <span className="text-xs font-semibold text-gray-080">{KIND_LABEL[op.kind]}</span>
                      <span className="text-xs text-gray-040 truncate">#{op.targetId}</span>
                      <span className="ml-auto text-[11px] text-gray-040">
                        {op.lastTriedAt ? timeAgo(op.lastTriedAt) : timeAgo(op.queuedAt)}
                      </span>
                    </div>
                    {op.lastError && (
                      <p className="text-[11px] text-red-060 truncate" title={op.lastError}>
                        {op.lastError}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <MsButton
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetryOne(op)}
                        disabled={retrying !== null}
                        leftIcon={<MsRefreshIcon className={retrying === op.id ? 'animate-spin' : ''} />}
                      >
                        재시도
                      </MsButton>
                      <MsButton
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOp(op.id)}
                        disabled={retrying !== null}
                      >
                        제거
                      </MsButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </>
    </SideDrawer>
  );
}
