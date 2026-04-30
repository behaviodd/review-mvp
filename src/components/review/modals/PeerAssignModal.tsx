import { useMemo, useState } from 'react';
import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { MsInput, MsCheckbox } from '../../ui/MsControl';
import { useReviewStore } from '../../../stores/reviewStore';
import { useTeamStore } from '../../../stores/teamStore';
import { useShowToast } from '../../ui/Toast';
import { UserAvatar } from '../../ui/UserAvatar';
import { getSmallestOrg } from '../../../utils/userUtils';
import type { ReviewCycle } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  cycle: ReviewCycle;
  revieweeId: string;
  actorId: string;
  onApplied?: () => void;
}

export function PeerAssignModal({ open, onClose, cycle, revieweeId, actorId, onApplied }: Props) {
  const users = useTeamStore(s => s.users);
  const submissions = useReviewStore(s => s.submissions);
  const assignPeerReviewers = useReviewStore(s => s.assignPeerReviewers);
  const showToast = useShowToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reviewee = users.find(u => u.id === revieweeId);
  const policy = cycle.peerSelection;
  const min = policy?.minPeers ?? 3;
  const max = policy?.maxPeers ?? 5;

  const existingPeers = useMemo(
    () => submissions.filter(s => s.cycleId === cycle.id && s.type === 'peer' && s.revieweeId === revieweeId),
    [submissions, cycle.id, revieweeId],
  );
  const existingReviewerIds = new Set(existingPeers.map(s => s.reviewerId));

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(u =>
        u.isActive !== false &&
        u.id !== revieweeId &&
        !existingReviewerIds.has(u.id)
      )
      .filter(u => !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [users, revieweeId, existingReviewerIds, query]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = () => {
    if (selected.size === 0) return;
    const res = assignPeerReviewers(cycle.id, revieweeId, Array.from(selected), actorId);
    if (res.created === 0) {
      showToast('info', '배정된 새 동료가 없습니다.');
    } else {
      showToast('success', `${res.created}명 배정 완료` + (res.skipped ? ` · ${res.skipped}명 skip` : ''));
    }
    onApplied?.();
    setSelected(new Set());
    onClose();
  };

  if (!reviewee) return null;

  const total = existingPeers.length + selected.size;
  const withinRange = total >= min && total <= max;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="동료 리뷰 배정"
      description={`${reviewee.name} 님의 동료 작성자를 선택합니다. 권장 ${min}–${max}명`}
      widthClass="max-w-xl"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose}>취소</MsButton>
          <MsButton size="sm" onClick={apply} disabled={selected.size === 0}>
            {selected.size}명 배정
          </MsButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-gray-010 bg-gray-001 p-3 text-xs text-gray-060">
          기존 배정 <strong className="text-gray-080">{existingPeers.length}명</strong> + 추가 <strong className="text-gray-080">{selected.size}명</strong> = 총 {total}명
          {!withinRange && (
            <span className="ml-2 text-orange-060">권장 범위 {min}–{max}명 벗어남</span>
          )}
        </div>
        <MsInput
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="이름·이메일·부서 검색"
          className="w-full"
        />
        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-010 divide-y divide-gray-005">
          {candidates.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-fg-subtlest">후보가 없습니다.</p>
          ) : (
            candidates.map(u => {
              const checked = selected.has(u.id);
              return (
                <label
                  key={u.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    checked ? 'bg-pink-005/50' : 'hover:bg-gray-001'
                  }`}
                >
                  <MsCheckbox checked={checked} onChange={() => toggle(u.id)} />
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
    </ModalShell>
  );
}
