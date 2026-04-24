import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { MsWarningIcon } from '../../ui/MsIcons';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  revieweeName?: string;
  reviewerName?: string;
  stage: 'self' | 'downward';
}

export function ProxyWriteConfirmModal({ open, onClose, onConfirm, revieweeName, reviewerName, stage }: Props) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="대리 작성 진입"
      description={stage === 'self'
        ? `${revieweeName ?? '대상자'}님 대신 자기평가를 작성합니다.`
        : `${reviewerName ?? '조직장'} → ${revieweeName ?? '대상자'} 리뷰를 대리 작성합니다.`}
      widthClass="max-w-md"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose}>취소</MsButton>
          <MsButton size="sm" variant="red" onClick={onConfirm}>대리 작성 시작</MsButton>
        </>
      }
    >
      <div className="flex items-start gap-2 rounded-lg border border-red-020 bg-red-005 p-3">
        <MsWarningIcon size={16} className="mt-0.5 shrink-0 text-red-050" />
        <div className="text-xs text-red-070 leading-relaxed">
          대리 작성은 <strong>감사 로그에 영구 기록</strong>됩니다. 제출 후 대리 작성자, 원 작성자, 대상자 정보가 모두 남습니다.
          가능하면 원 작성자가 직접 작성하도록 안내해 주세요.
        </div>
      </div>
    </ModalShell>
  );
}
