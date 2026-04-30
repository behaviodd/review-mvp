import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useShowToast } from '../../components/ui/Toast';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput, MsCheckbox } from '../../components/ui/MsControl';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { Pill } from '../../components/ui/Pill';
import { EmptyState } from '../../components/ui/EmptyState';
import { getSmallestOrg } from '../../utils/userUtils';

export function PeerPickPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const cycle = useReviewStore(s => s.cycles.find(c => c.id === cycleId));
  const submissions = useReviewStore(s => s.submissions);
  const pickPeerReviewers = useReviewStore(s => s.pickPeerReviewers);
  const proposePeerReviewers = useReviewStore(s => s.proposePeerReviewers);
  const users = useTeamStore(s => s.users);
  const showToast = useShowToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useSetPageHeader('동료 선택');

  const existingPeerReviewerIds = useMemo(() => {
    if (!cycleId || !currentUser) return new Set<string>();
    return new Set(
      submissions
        .filter(s => s.cycleId === cycleId && s.type === 'peer' && s.revieweeId === currentUser.id)
        .map(s => s.reviewerId),
    );
  }, [submissions, cycleId, currentUser]);

  const candidates = useMemo(() => {
    if (!currentUser) return [];
    const q = query.trim().toLowerCase();
    return users
      .filter(u =>
        u.isActive !== false &&
        u.id !== currentUser.id &&
        !existingPeerReviewerIds.has(u.id)
      )
      .filter(u => !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [users, currentUser, existingPeerReviewerIds, query]);

  const policy = cycle?.peerSelection;
  const isPick = policy?.method === 'reviewee_picks';
  const isProposal = policy?.method === 'leader_approves';
  const needsPick = !!policy && (isPick || isProposal);

  // 피어 지명 대상이 아닌 경우: 안내 토스트와 함께 내 리뷰 목록으로 자동 복귀
  useEffect(() => {
    if (!currentUser || !cycle) return;
    if (!needsPick) {
      showToast('info', '동료 선택이 필요하지 않은 사이클입니다.');
      navigate('/reviews/me', { replace: true });
    }
  }, [currentUser, cycle, needsPick, navigate, showToast]);

  if (!currentUser) {
    return (
      <EmptyState
        illustration="empty-list"
        title="로그인이 필요해요"
        description="로그인 후 다시 시도해 주세요."
        action={{ label: '로그인으로', onClick: () => navigate('/login') }}
      />
    );
  }
  if (!cycle) {
    return (
      <EmptyState
        illustration="empty-cycle"
        title="사이클을 찾을 수 없어요"
        description="삭제되었거나 접근 권한이 없는 사이클입니다."
        action={{ label: '내 리뷰 목록으로', onClick: () => navigate('/reviews/me') }}
      />
    );
  }
  if (!needsPick) {
    // 리다이렉트 effect가 즉시 발화하지만, 렌더 사이 깜빡임 방지를 위해 빈 placeholder 반환.
    return null;
  }

  const total = existingPeerReviewerIds.size + selected.size;
  const min = policy.minPeers;
  const max = policy.maxPeers;
  const canSubmit = total >= min && total <= max && selected.size > 0;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size + existingPeerReviewerIds.size < max) next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!canSubmit) return;
    setSaving(true);
    const res = isProposal
      ? proposePeerReviewers(cycle.id, currentUser.id, Array.from(selected))
      : pickPeerReviewers(cycle.id, currentUser.id, Array.from(selected));
    setSaving(false);
    if (res.error) {
      showToast('error', res.error);
      return;
    }
    showToast('success', isProposal
      ? `${res.created}명 제안 완료 · 리더 승인 대기`
      : `동료 ${res.created}명 선택 완료`);
    navigate('/reviews/me');
  };

  // 기존 제안 요약 (leader_approves 방식)
  const proposals = submissions.filter(s =>
    s.cycleId === cycle.id && s.type === 'peer' && s.revieweeId === currentUser.id && s.peerProposal
  );
  const pendingCount  = proposals.filter(p => p.peerProposal?.status === 'pending').length;
  const approvedCount = proposals.filter(p => p.peerProposal?.status === 'approved').length;
  const rejectedCount = proposals.filter(p => p.peerProposal?.status === 'rejected').length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="rounded-xl border border-gray-010 bg-white p-5 shadow-card">
        <h1 className="text-lg font-bold text-fg-default">{cycle.title}</h1>
        <p className="mt-1 text-xs text-fg-subtle">
          나를 평가할 동료 <strong>{min}–{max}명</strong>을 선택해 주세요.
          {isProposal ? ' 선택 후 리더가 승인합니다.' : ' 선택 후 해당 동료에게 평가 작성이 요청됩니다.'}
        </p>
        <div className="mt-3 rounded-lg bg-gray-001 px-3 py-2 text-xs">
          기존 배정 <strong>{existingPeerReviewerIds.size}명</strong> + 추가 <strong>{selected.size}명</strong> = 총 {total}명
          {!canSubmit && total > 0 && (
            <span className="ml-2 text-orange-060">{min}–{max}명 범위 내에서 선택</span>
          )}
        </div>
        {isProposal && proposals.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone="warning" size="sm">승인 대기 {pendingCount}</Pill>
            <Pill tone="success" size="sm">승인 {approvedCount}</Pill>
            {rejectedCount > 0 && <Pill tone="danger" size="sm">반려 {rejectedCount}</Pill>}
          </div>
        )}
      </header>

      <div className="rounded-xl border border-gray-010 bg-white p-4 shadow-card space-y-3">
        <MsInput
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="이름·이메일·부서 검색"
        />
        <div className="max-h-[480px] overflow-y-auto rounded-lg border border-gray-010 divide-y divide-gray-005">
          {candidates.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-fg-subtlest">후보가 없습니다.</p>
          ) : (
            candidates.map(u => {
              const checked = selected.has(u.id);
              const disabled = !checked && total >= max;
              return (
                <label
                  key={u.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    checked ? 'bg-pink-005/50' : disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-001'
                  }`}
                >
                  <MsCheckbox checked={checked} disabled={disabled} onChange={() => toggle(u.id)} />
                  <UserAvatar user={u} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-080 truncate">{u.name}</p>
                    <p className="text-[11px] text-fg-subtlest truncate">{u.position} · {getSmallestOrg(u)}</p>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <MsButton variant="ghost" size="sm" onClick={() => navigate('/reviews/me')}>취소</MsButton>
        <MsButton size="sm" onClick={handleSave} disabled={!canSubmit} loading={saving}>
          {selected.size}명 확정
        </MsButton>
      </div>
    </div>
  );
}
