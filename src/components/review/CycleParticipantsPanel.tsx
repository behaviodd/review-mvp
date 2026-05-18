import { useMemo, useState } from 'react';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsInput, MsTextarea } from '../ui/MsControl';
import { ModalShell } from './modals/ModalShell';
import { MsFriendAddIcon, MsCancelIcon, MsUsersIcon } from '../ui/MsIcons';
import { resolveTargetMembers } from '../../utils/resolveTargets';
import { UserAvatar } from '../ui/UserAvatar';

interface Props {
  cycleId: string;
}

/**
 * 사이클 진행 중 참가자(피평가자) 추가·제외 패널.
 * - 중도 입사/퇴사 등 발행 후 인원 변동 대응
 * - cycles.manage 권한자 한정 (CycleDetail 페이지가 이미 권한 게이트)
 * - 추가: 신규 submission 즉시 생성
 * - 제외: 미완료 submission autoExcluded 마크 (제출 완료된 건은 보존)
 */
export function CycleParticipantsPanel({ cycleId }: Props) {
  const cycle = useReviewStore(s => s.cycles.find(c => c.id === cycleId));
  const addCycleParticipant = useReviewStore(s => s.addCycleParticipant);
  const removeCycleParticipant = useReviewStore(s => s.removeCycleParticipant);
  const users = useTeamStore(s => s.users);
  const currentUser = useAuthStore(s => s.currentUser);
  const showToast = useShowToast();

  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentMembers = useMemo(() => {
    if (!cycle) return [];
    return resolveTargetMembers(cycle, users);
  }, [cycle, users]);

  const currentMemberIds = useMemo(() => new Set(currentMembers.map(u => u.id)), [currentMembers]);

  const candidates = useMemo(() => {
    return users
      .filter(u => u.isActive !== false && !currentMemberIds.has(u.id))
      .filter(u => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q) ||
          u.id?.toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [users, currentMemberIds, searchTerm]);

  const removeCandidates = useMemo(() => {
    return currentMembers
      .filter(u => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return (
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q)
        );
      });
  }, [currentMembers, searchTerm]);

  if (!cycle) return null;

  const canEdit = cycle.status !== 'draft' && cycle.status !== 'closed';
  const reasonHint = !canEdit
    ? cycle.status === 'draft'
      ? '발행 전 사이클은 편집 화면에서 대상자를 설정하세요.'
      : '종료된 사이클은 참가자를 변경할 수 없습니다.'
    : null;

  const openAdd = () => {
    setSearchTerm('');
    setPendingUserId(null);
    setAddOpen(true);
  };
  const openRemove = () => {
    setSearchTerm('');
    setPendingUserId(null);
    setRemoveReason('');
    setRemoveOpen(true);
  };

  const handleAddConfirm = () => {
    if (!pendingUserId || !currentUser) return;
    setSubmitting(true);
    const res = addCycleParticipant(cycleId, pendingUserId, currentUser.id);
    setSubmitting(false);
    if (res.ok) {
      const u = users.find(x => x.id === pendingUserId);
      showToast('success', `${u?.name ?? '사용자'}님을 추가했습니다. (${res.createdSubmissions ?? 0}건 submission 생성)`);
      setAddOpen(false);
    } else {
      showToast('error', res.error ?? '추가에 실패했습니다.');
    }
  };

  const handleRemoveConfirm = () => {
    if (!pendingUserId || !currentUser) return;
    setSubmitting(true);
    const res = removeCycleParticipant(cycleId, pendingUserId, currentUser.id, removeReason.trim() || undefined);
    setSubmitting(false);
    if (res.ok) {
      const u = users.find(x => x.id === pendingUserId);
      showToast('success', `${u?.name ?? '사용자'}님을 제외했습니다. (${res.markedSubmissions ?? 0}건 자동제외)`);
      setRemoveOpen(false);
    } else {
      showToast('error', res.error ?? '제외에 실패했습니다.');
    }
  };

  return (
    <div className="border-t border-bd-default pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MsUsersIcon size={16} className="text-fg-subtle" />
          <h3 className="text-base font-semibold text-fg-default">참가자 관리</h3>
          <span className="text-xs text-fg-subtle">현재 {currentMembers.length}명</span>
        </div>
        <div className="flex items-center gap-2">
          <MsButton
            size="sm"
            variant="outline-default"
            leftIcon={<MsCancelIcon size={14} />}
            onClick={openRemove}
            disabled={!canEdit || currentMembers.length === 0}
            title={reasonHint ?? '참가자 제외 (자동제외 마크, 데이터 보존)'}
          >
            참가자 제외
          </MsButton>
          <MsButton
            size="sm"
            variant="outline-brand1"
            leftIcon={<MsFriendAddIcon size={14} />}
            onClick={openAdd}
            disabled={!canEdit}
            title={reasonHint ?? '진행 중 사이클에 신규 참가자 추가'}
          >
            참가자 추가
          </MsButton>
        </div>
      </div>
      {reasonHint && (
        <p className="text-xs text-fg-subtle mb-3">{reasonHint}</p>
      )}

      {/* 추가 모달 */}
      {addOpen && (
        <ModalShell
          open={addOpen}
          onClose={() => setAddOpen(false)}
          title="참가자 추가"
          description="중도 입사·신규 합류 인원을 진행 중인 사이클에 추가합니다."
          widthClass="max-w-xl"
          footer={
            <>
              <MsButton variant="ghost" size="sm" onClick={() => setAddOpen(false)} disabled={submitting}>
                취소
              </MsButton>
              <MsButton
                variant="brand1"
                size="sm"
                onClick={handleAddConfirm}
                disabled={!pendingUserId || submitting}
              >
                {submitting ? '추가 중…' : '추가'}
              </MsButton>
            </>
          }
        >
          <div className="space-y-3">
            <MsInput
              placeholder="이름·이메일·부서·사번 검색"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            <div className="max-h-80 overflow-y-auto border border-gray-010 rounded-lg divide-y divide-gray-010">
              {candidates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-fg-subtlest">
                  추가 가능한 사용자가 없습니다.
                </div>
              ) : (
                candidates.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setPendingUserId(u.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-005 transition-colors text-left ${
                      pendingUserId === u.id ? 'bg-pink-005' : ''
                    }`}
                  >
                    <UserAvatar user={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg-default truncate">{u.name}</p>
                      <p className="text-xs text-fg-subtle truncate">
                        {[u.department, u.position, u.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {pendingUserId === u.id && (
                      <span className="text-xs font-semibold text-pink-060 flex-shrink-0">선택됨</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </ModalShell>
      )}

      {/* 제외 모달 */}
      {removeOpen && (
        <ModalShell
          open={removeOpen}
          onClose={() => setRemoveOpen(false)}
          title="참가자 제외"
          description="중도 퇴사·부서 이동 등 사유로 사이클에서 제외합니다. 제출 완료된 건은 보존됩니다."
          widthClass="max-w-xl"
          footer={
            <>
              <MsButton variant="ghost" size="sm" onClick={() => setRemoveOpen(false)} disabled={submitting}>
                취소
              </MsButton>
              <MsButton
                variant="outline-red"
                size="sm"
                onClick={handleRemoveConfirm}
                disabled={!pendingUserId || submitting}
              >
                {submitting ? '제외 중…' : '제외'}
              </MsButton>
            </>
          }
        >
          <div className="space-y-3">
            <MsInput
              placeholder="이름·이메일·부서 검색"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
            <div className="max-h-72 overflow-y-auto border border-gray-010 rounded-lg divide-y divide-gray-010">
              {removeCandidates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-fg-subtlest">
                  검색 결과가 없습니다.
                </div>
              ) : (
                removeCandidates.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setPendingUserId(u.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-005 transition-colors text-left ${
                      pendingUserId === u.id ? 'bg-orange-005' : ''
                    }`}
                  >
                    <UserAvatar user={u} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-fg-default truncate">{u.name}</p>
                      <p className="text-xs text-fg-subtle truncate">
                        {[u.department, u.position, u.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {pendingUserId === u.id && (
                      <span className="text-xs font-semibold text-orange-070 flex-shrink-0">선택됨</span>
                    )}
                  </button>
                ))
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-fg-subtle mb-1 block">제외 사유 (선택)</label>
              <MsTextarea
                value={removeReason}
                onChange={e => setRemoveReason(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder="예: 중도 퇴사 / 부서 이동 / 휴직"
              />
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
