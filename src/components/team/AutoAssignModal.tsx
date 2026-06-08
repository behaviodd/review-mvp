/**
 * 평가자 자동 지정 모달.
 *
 * 흐름:
 *   1. computeAutoAssignments() 로 후보 계산
 *   2. 결과 테이블 미리보기 (배정 가능 / 불가 / 이미 배정됨 구분)
 *   3. "기존 배정 덮어쓰기" 옵션 + 확인 시 bulkUpsertAssignments 일괄 적용
 */
import { useMemo, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTeamStore } from '../../stores/teamStore';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsCheckbox } from '../ui/MsControl';
import { ModalShell } from '../review/modals/ModalShell';
import { UserAvatar } from '../ui/UserAvatar';
import { computeAutoAssignments } from '../../utils/autoAssignReviewers';
import type { AutoAssignCandidate } from '../../utils/autoAssignReviewers';

interface Props {
  open: boolean;
  onClose: () => void;
}

const REASON_LABEL: Record<AutoAssignCandidate['reason'], string> = {
  managerId: '보고 대상 기반',
  orgHead:   '조직장 기반',
  none:      '—',
};

const SOURCE_TONE: Record<string, string> = {
  managerId: 'bg-blue-005 text-blue-060',
  orgHead:   'bg-green-005 text-green-060',
  none:      'bg-gray-010 text-fg-subtlest',
};

export function AutoAssignModal({ open, onClose }: Props) {
  const { currentUser } = useAuthStore();
  const { users, orgUnits, reviewerAssignments, bulkUpsertAssignments } = useTeamStore();
  const showToast = useShowToast();

  const [overwrite, setOverwrite] = useState(false);
  const [applying, setApplying]   = useState(false);

  const candidates = useMemo(
    () => computeAutoAssignments(users, orgUnits, reviewerAssignments),
    [users, orgUnits, reviewerAssignments],
  );

  const assignable = candidates.filter(c => c.reviewerId !== null);
  const skipped    = candidates.filter(c => c.reviewerId === null);
  const toApply    = overwrite
    ? assignable
    : assignable.filter(c => !c.hasExisting);
  const willSkip   = overwrite
    ? []                               // overwrite 시 기존 포함 모두 적용
    : assignable.filter(c => c.hasExisting);

  const handleApply = () => {
    if (!currentUser || toApply.length === 0) return;
    setApplying(true);
    try {
      const inputs = toApply.map(c => ({
        revieweeId: c.revieweeId,
        reviewerId: c.reviewerId!,
        rank:       1,
        source:     c.source,
        startDate:  new Date().toISOString(),
        createdBy:  currentUser.id,
      }));
      bulkUpsertAssignments(inputs);
      showToast('success', `${inputs.length}명의 평가자를 자동 지정했습니다.`);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="평가자 자동 지정"
      description="조직 구조(보고 대상 · 조직장)를 기반으로 rank 1 평가자를 일괄 배정합니다."
      size="lg"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose} disabled={applying}>취소</MsButton>
          <MsButton
            size="sm"
            onClick={handleApply}
            loading={applying}
            disabled={toApply.length === 0}
          >
            {toApply.length}명 지정 적용
          </MsButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* 요약 배너 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '자동 배정 가능',  value: assignable.length, color: 'text-green-060' },
            { label: '이미 배정됨',     value: assignable.filter(c => c.hasExisting).length, color: 'text-blue-060' },
            { label: '배정 불가',       value: skipped.length,    color: 'text-fg-subtlest' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-bd-default p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-fg-subtle mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 덮어쓰기 옵션 */}
        <MsCheckbox
          checked={overwrite}
          onChange={e => setOverwrite(e.target.checked)}
          label={
            <span className="text-xs text-fg-default">
              이미 배정된 구성원도 덮어쓰기
              <span className="ml-1 text-fg-subtlest">
                ({assignable.filter(c => c.hasExisting).length}명 영향)
              </span>
            </span>
          }
        />

        {/* 배정 예정 목록 */}
        {toApply.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-2">
              적용 예정 — {toApply.length}명
            </p>
            <div className="rounded-lg border border-bd-default overflow-hidden">
              <div className="max-h-64 overflow-y-auto divide-y divide-bd-default">
                {toApply.map(c => {
                  const reviewee = users.find(u => u.id === c.revieweeId);
                  const reviewer = users.find(u => u.id === c.reviewerId);
                  if (!reviewee || !reviewer) return null;
                  return (
                    <div key={c.revieweeId} className="flex items-center gap-3 px-3 py-2.5 hover:bg-interaction-hovered transition-colors">
                      {/* 피평가자 */}
                      <div className="flex items-center gap-2 w-36 flex-shrink-0">
                        <UserAvatar user={reviewee} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-fg-default truncate">{reviewee.name}</p>
                          <p className="text-[11px] text-fg-subtlest truncate">{reviewee.position}</p>
                        </div>
                      </div>
                      {/* 화살표 */}
                      <span className="text-fg-subtlest text-xs flex-shrink-0">→</span>
                      {/* 평가자 */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <UserAvatar user={reviewer} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-fg-default truncate">{reviewer.name}</p>
                          <p className="text-[11px] text-fg-subtlest truncate">{reviewer.position}</p>
                        </div>
                      </div>
                      {/* 배정 근거 */}
                      <span className={`flex-shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded ${SOURCE_TONE[c.reason]}`}>
                        {REASON_LABEL[c.reason]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 기존 배정 보존 목록 (overwrite=false) */}
        {!overwrite && willSkip.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-2">
              기존 배정 유지 — {willSkip.length}명
            </p>
            <div className="rounded-lg border border-bd-default overflow-hidden">
              <div className="max-h-40 overflow-y-auto divide-y divide-bd-default">
                {willSkip.map(c => {
                  const reviewee = users.find(u => u.id === c.revieweeId);
                  const currentReviewer = users.find(u => u.id === c.existingReviewerId);
                  const newReviewer = users.find(u => u.id === c.reviewerId);
                  if (!reviewee) return null;
                  return (
                    <div key={c.revieweeId} className="flex items-center gap-3 px-3 py-2 opacity-60">
                      <div className="flex items-center gap-2 w-36 flex-shrink-0">
                        <UserAvatar user={reviewee} size="sm" />
                        <p className="text-xs text-fg-default truncate">{reviewee.name}</p>
                      </div>
                      <span className="text-fg-subtlest text-xs flex-shrink-0">유지:</span>
                      <p className="text-xs text-fg-subtle flex-1 truncate">
                        {currentReviewer?.name ?? c.existingReviewerId}
                        {newReviewer && currentReviewer?.id !== newReviewer.id && (
                          <span className="ml-1 text-fg-subtlest">(제안: {newReviewer.name})</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 배정 불가 목록 */}
        {skipped.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-fg-subtlest uppercase tracking-wide mb-2">
              배정 불가 — {skipped.length}명 (보고 대상·조직장 미설정)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skipped.map(c => {
                const u = users.find(u2 => u2.id === c.revieweeId);
                return u ? (
                  <span key={c.revieweeId} className="text-[11px] px-2 py-0.5 rounded bg-gray-010 text-fg-subtlest">
                    {u.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {toApply.length === 0 && assignable.length > 0 && (
          <p className="text-xs text-fg-subtle text-center py-2">
            모든 구성원이 이미 배정되어 있습니다. "덮어쓰기" 옵션을 활성화하면 재배정할 수 있습니다.
          </p>
        )}
      </div>
    </ModalShell>
  );
}
