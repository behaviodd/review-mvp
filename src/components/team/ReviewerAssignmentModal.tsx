import { useMemo, useState } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useShowToast } from '../ui/Toast';
import { ModalShell } from '../review/modals/ModalShell';
import { MsButton } from '../ui/MsButton';
import { MsInput, MsSelect } from '../ui/MsControl';
import { MsDeleteIcon, MsPlusIcon } from '../ui/MsIcons';
import { UserAvatar } from '../ui/UserAvatar';
import { Pill } from '../ui/Pill';

interface Props {
  open: boolean;
  onClose: () => void;
  revieweeId: string;
}

const SOURCE_LABEL: Record<string, string> = {
  org_head_inherited: '조직장 자동',
  manual:             '수동 지정',
  excel_import:       '엑셀 일괄',
};

const SOURCE_TONE: Record<string, 'info' | 'neutral' | 'success'> = {
  org_head_inherited: 'info',
  manual:             'neutral',
  excel_import:       'success',
};

const RANK_OPTIONS = [1, 2, 3, 4, 5] as const;

export function ReviewerAssignmentModal({ open, onClose, revieweeId }: Props) {
  const users = useTeamStore(s => s.users);
  const reviewerAssignments = useTeamStore(s => s.reviewerAssignments);
  const upsertAssignment = useTeamStore(s => s.upsertAssignment);
  const endAssignment = useTeamStore(s => s.endAssignment);
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();

  const reviewee = users.find(u => u.id === revieweeId);

  const [rank, setRank] = useState<number>(1);
  const [query, setQuery] = useState('');
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('');

  const activeAssignments = useMemo(
    () => reviewerAssignments
      .filter(a => a.revieweeId === revieweeId && !a.endDate)
      .sort((a, b) => a.rank - b.rank),
    [reviewerAssignments, revieweeId],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(u => u.id !== revieweeId && u.isActive !== false)
      .filter(u => !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .slice(0, 8);
  }, [users, revieweeId, query]);

  const handleAdd = () => {
    if (!currentUser) return;
    if (!selectedReviewerId) {
      showToast('error', '평가권자를 선택해 주세요.');
      return;
    }
    if (selectedReviewerId === revieweeId) {
      showToast('error', '본인을 자기 자신의 평가권자로 지정할 수 없습니다.');
      return;
    }
    upsertAssignment({
      revieweeId,
      reviewerId: selectedReviewerId,
      rank,
      source: 'manual',
      startDate: new Date().toISOString(),
      createdBy: currentUser.id,
    });
    const reviewer = users.find(u => u.id === selectedReviewerId);
    showToast('success', `${reviewer?.name ?? '평가권자'} 를 ${rank}차로 지정했습니다.`);
    setSelectedReviewerId('');
    setQuery('');
  };

  const handleRemove = (assignmentId: string, reviewerName: string) => {
    endAssignment(assignmentId);
    showToast('success', `${reviewerName} 의 평가권을 종료했습니다.`);
  };

  if (!reviewee) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`평가권자 배정 — ${reviewee.name}`}
      description="rank 별로 최대 1명 활성. 같은 rank 에 새로 지정하면 기존 활성 row 가 자동 종료됩니다."
      widthClass="max-w-xl"
      footer={<MsButton size="sm" variant="ghost" onClick={onClose}>닫기</MsButton>}
    >
      <div className="space-y-5">
        {/* 활성 평가권자 list */}
        <section>
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">
            활성 평가권자 ({activeAssignments.length}명)
          </p>
          {activeAssignments.length === 0 ? (
            <p className="text-sm text-fg-subtlest py-2">아직 배정된 평가권자가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {activeAssignments.map(a => {
                const reviewer = users.find(u => u.id === a.reviewerId);
                return (
                  <li key={a.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-interaction-hovered transition-colors group">
                    <span className="inline-flex items-center justify-center min-w-[40px] h-6 px-2 rounded-full bg-bg-token-brand1-subtlest text-fg-brand1 text-xs font-semibold">
                      {a.rank}차
                    </span>
                    {reviewer ? (
                      <>
                        <UserAvatar user={reviewer} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-fg-default truncate">{reviewer.name}</p>
                          <p className="text-xs text-fg-subtlest truncate">{reviewer.position} · {reviewer.department}</p>
                        </div>
                      </>
                    ) : (
                      <p className="flex-1 text-sm text-fg-subtlest italic">알 수 없는 평가권자 ({a.reviewerId})</p>
                    )}
                    <Pill tone={SOURCE_TONE[a.source]} size="xs">{SOURCE_LABEL[a.source]}</Pill>
                    <button
                      type="button"
                      onClick={() => handleRemove(a.id, reviewer?.name ?? a.reviewerId)}
                      className="p-1.5 rounded-md text-fg-subtlest hover:bg-red-005 hover:text-red-050 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="평가권 종료"
                      title="평가권 종료"
                    >
                      <MsDeleteIcon size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 신규 평가권자 추가 */}
        <section className="border-t border-bd-default pt-4">
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">평가권자 추가</p>
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <MsSelect
              label="rank"
              value={String(rank)}
              onChange={e => setRank(Number(e.target.value))}
            >
              {RANK_OPTIONS.map(r => (
                <option key={r} value={r}>{r}차</option>
              ))}
            </MsSelect>
            <MsInput
              label="검색"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedReviewerId(''); }}
              placeholder="이름·이메일·부서"
            />
          </div>

          {query.trim() && (
            <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-bd-default divide-y divide-gray-005">
              {candidates.length === 0 ? (
                <li className="px-3 py-3 text-center text-xs text-fg-subtlest">후보가 없습니다.</li>
              ) : (
                candidates.map(u => (
                  <li
                    key={u.id}
                    onClick={() => setSelectedReviewerId(u.id)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                      selectedReviewerId === u.id ? 'bg-pink-005/50' : 'hover:bg-interaction-hovered'
                    }`}
                  >
                    <UserAvatar user={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg-default truncate">{u.name}</p>
                      <p className="text-xs text-fg-subtlest truncate">{u.position} · {u.department}</p>
                    </div>
                    {selectedReviewerId === u.id && (
                      <span className="text-xs font-semibold text-fg-brand1">선택됨</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}

          <div className="mt-3 flex justify-end">
            <MsButton
              size="sm"
              onClick={handleAdd}
              disabled={!selectedReviewerId}
              leftIcon={<MsPlusIcon size={14} />}
            >
              {rank}차 평가권자로 지정
            </MsButton>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}
