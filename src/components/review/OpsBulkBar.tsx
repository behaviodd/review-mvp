import { cn } from '../../utils/cn';
import { MsButton } from '../ui/MsButton';
import { MsSendIcon, MsCancelIcon, MsRefreshIcon, MsCalendarIcon } from '../ui/MsIcons';

interface Props {
  selectedCount: number;
  pendingCount: number;
  onRemind: () => void;
  onRepush: () => void;
  onExtendDeadline?: () => void;
  canIntervene?: boolean;
  onClear: () => void;
  remindLoading?: boolean;
  repushLoading?: boolean;
}

export function OpsBulkBar({
  selectedCount,
  pendingCount,
  onRemind,
  onRepush,
  onExtendDeadline,
  canIntervene,
  onClear,
  remindLoading,
  repushLoading,
}: Props) {
  if (selectedCount === 0) return null;

  const remindDisabled = pendingCount === 0 || !!remindLoading || !!repushLoading;
  const repushDisabled = !!remindLoading || !!repushLoading;
  const extendDisabled = pendingCount === 0 || !!remindLoading || !!repushLoading;

  return (
    <div
      className={cn(
        'sticky bottom-4 z-20 mx-auto flex max-w-4xl items-center gap-3 rounded-full border border-gray-020 bg-white/95 px-4 py-2 shadow-modal backdrop-blur',
      )}
      role="toolbar"
      aria-label="일괄 작업 툴바"
    >
      <span className="text-xs font-semibold text-gray-080">
        {selectedCount}명 선택됨
        <span className="ml-2 text-gray-040 font-normal">미제출 {pendingCount}명</span>
      </span>
      <div className="ml-auto flex items-center gap-2">
        <MsButton
          variant="ghost"
          size="sm"
          onClick={onClear}
          leftIcon={<MsCancelIcon />}
        >
          해제
        </MsButton>
        {canIntervene && onExtendDeadline && (
          <MsButton
            variant="outline-default"
            size="sm"
            onClick={onExtendDeadline}
            disabled={extendDisabled}
            leftIcon={<MsCalendarIcon />}
            title={pendingCount === 0 ? '선택된 인원이 모두 제출 완료 상태입니다' : '선택한 인원의 마감 기한을 연장'}
          >
            기한 연장
          </MsButton>
        )}
        <MsButton
          variant="outline-default"
          size="sm"
          onClick={onRepush}
          disabled={repushDisabled}
          loading={repushLoading}
          leftIcon={<MsRefreshIcon className={repushLoading ? 'animate-spin' : ''} />}
          title="선택한 인원의 제출 데이터를 시트에 다시 전송"
        >
          선택 재푸시
        </MsButton>
        <MsButton
          variant="brand1"
          size="sm"
          onClick={onRemind}
          disabled={remindDisabled}
          loading={remindLoading}
          leftIcon={<MsSendIcon />}
          title={pendingCount === 0 ? '선택된 인원이 모두 제출 완료 상태입니다' : '미제출자에게 리마인드 발송'}
        >
          리마인드 발송
        </MsButton>
      </div>
    </div>
  );
}
