import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { MsCheckCircleIcon, MsWarningIcon, MsCancelIcon } from '../../ui/MsIcons';
import type { PreflightResult, PreflightCheck } from '../../../utils/cyclePreflight';
import { cn } from '../../../utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  result: PreflightResult | null;
  cycleTitle: string;
  loading?: boolean;
}

const SEVERITY_STYLE: Record<PreflightCheck['severity'], { bg: string; fg: string; border: string; icon: string }> = {
  block: { bg: 'bg-red-005',    fg: 'text-red-070',    border: 'border-red-020',    icon: 'text-red-050' },
  warn:  { bg: 'bg-orange-005', fg: 'text-orange-070', border: 'border-orange-020', icon: 'text-orange-050' },
};

export function PreflightModal({ open, onClose, onConfirm, result, cycleTitle, loading }: Props) {
  if (!result) return null;

  const allPass = result.checks.length === 0;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="사전 점검"
      description={`"${cycleTitle}" 발행 전 최종 확인`}
      widthClass="max-w-xl"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose} disabled={loading}>취소</MsButton>
          <MsButton
            size="sm"
            onClick={onConfirm}
            disabled={result.blocked || loading}
            loading={loading}
            title={result.blocked ? '차단 항목을 먼저 수정해주세요.' : ''}
          >
            {allPass ? '발행하기' : result.blocked ? '수정 필요' : '경고 확인 후 발행'}
          </MsButton>
        </>
      }
    >
      {allPass ? (
        <div className="flex items-start gap-2 rounded-lg border border-green-020 bg-green-005 p-3">
          <MsCheckCircleIcon size={16} className="mt-0.5 shrink-0 text-green-060" />
          <div className="text-xs text-green-070 leading-relaxed">
            모든 점검 항목을 통과했습니다. 발행 시 템플릿이 현재 상태로 동결되어 이후 템플릿이 수정되어도 이 사이클의 질문은 유지됩니다.
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {result.checks.map(c => {
            const s = SEVERITY_STYLE[c.severity];
            return (
              <li key={c.id} className={cn('flex items-start gap-2 rounded-lg border p-3', s.bg, s.border)}>
                {c.severity === 'block'
                  ? <MsCancelIcon size={16} className={cn('mt-0.5 shrink-0', s.icon)} />
                  : <MsWarningIcon size={16} className={cn('mt-0.5 shrink-0', s.icon)} />
                }
                <div className={cn('text-xs leading-relaxed min-w-0 flex-1', s.fg)}>
                  <p className="font-semibold">
                    [{c.severity === 'block' ? '차단' : '경고'}] {c.title}
                  </p>
                  <p className="mt-0.5">{c.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>
  );
}
