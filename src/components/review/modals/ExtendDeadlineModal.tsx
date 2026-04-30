import { useMemo, useState } from 'react';
import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { MsInput, MsTextarea } from '../../ui/MsControl';
import { useReviewStore } from '../../../stores/reviewStore';
import { useShowToast } from '../../ui/Toast';
import { formatDate } from '../../../utils/dateUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  submissionIds: string[];
  actorId: string;
  onApplied?: (result: { applied: number; rejected: number }) => void;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ExtendDeadlineModal({
  open,
  onClose,
  cycleId,
  submissionIds,
  actorId,
  onApplied,
}: Props) {
  const cycle = useReviewStore(s => s.cycles.find(c => c.id === cycleId));
  const submissions = useReviewStore(s => s.submissions);
  const extendDeadline = useReviewStore(s => s.extendDeadline);
  const showToast = useShowToast();

  const baseDefault = useMemo(() => {
    if (!cycle) return '';
    const candidates = [cycle.selfReviewDeadline, cycle.managerReviewDeadline];
    const latest = candidates.sort().slice(-1)[0];
    return addDays(latest, 3);
  }, [cycle]);

  const [until, setUntil] = useState(baseDefault);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const scoped = useMemo(() => {
    const set = new Set(submissionIds);
    return submissions.filter(s => set.has(s.id) && s.cycleId === cycleId);
  }, [submissions, submissionIds, cycleId]);

  const pending = scoped.filter(s => s.status !== 'submitted');
  const alreadyDone = scoped.length - pending.length;
  const selfCount = pending.filter(s => s.type === 'self').length;
  const managerCount = pending.filter(s => s.type === 'downward').length;

  if (!cycle) return null;

  const disabled = !until || pending.length === 0 || loading;

  const handleApply = async () => {
    if (disabled) return;
    setLoading(true);
    try {
      const ids = pending.map(s => s.id);
      const result = extendDeadline(ids, new Date(until).toISOString(), actorId, reason.trim() || undefined);
      if (result.applied.length === 0) {
        const firstReason = result.rejected[0]?.reason ?? '적용 가능한 항목이 없습니다.';
        showToast('error', `연장 실패: ${firstReason}`);
      } else if (result.rejected.length === 0) {
        showToast('success', `${result.applied.length}건 기한이 ${formatDate(until)}까지 연장되었습니다.`);
      } else {
        showToast('info', `${result.applied.length}건 연장 · ${result.rejected.length}건 거부`);
      }
      onApplied?.({ applied: result.applied.length, rejected: result.rejected.length });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="기한 연장"
      description={`"${cycle.title}" · 선택 ${scoped.length}건`}
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose}>취소</MsButton>
          <MsButton size="sm" onClick={handleApply} disabled={disabled} loading={loading}>
            연장 적용
          </MsButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-010 bg-gray-001 p-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-fg-subtlest">대상 요약</p>
              <p className="mt-1 font-semibold text-gray-080">
                자기평가 {selfCount}건 · 조직장 {managerCount}건
              </p>
            </div>
            <div>
              <p className="text-fg-subtlest">제외</p>
              <p className="mt-1 font-semibold text-gray-080">
                이미 제출 {alreadyDone}건
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-060 mb-1">연장 마감일</label>
          <MsInput
            type="date"
            value={until}
            onChange={e => setUntil(e.target.value)}
            hint={`현재 자기평가 마감: ${formatDate(cycle.selfReviewDeadline)} · 조직장: ${formatDate(cycle.managerReviewDeadline)}`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-060 mb-1">사유 (선택)</label>
          <MsTextarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="예) 일부 구성원 휴가로 인한 연장"
          />
        </div>
      </div>
    </ModalShell>
  );
}
