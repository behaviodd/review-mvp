import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { Pill } from '../../components/ui/Pill';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { MsChevronRightLineIcon, MsProfileIcon } from '../../components/ui/MsIcons';
import { formatDate } from '../../utils/dateUtils';
import type { ReviewKind, ReviewSubmission } from '../../types';

type KindFilter = 'all' | ReviewKind;

const KIND_LABEL: Record<ReviewKind, string> = {
  self: '자기평가',
  downward: '조직장',
  peer: '동료',
  upward: '상향',
};

const KIND_TONE: Record<ReviewKind, 'brand' | 'info' | 'purple' | 'success'> = {
  self: 'brand',
  downward: 'info',
  peer: 'purple',
  upward: 'success',
};

export function ReceivedReviewList() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { submissions, cycles } = useReviewStore();
  const users = useTeamStore(s => s.users);
  const [filter, setFilter] = useState<KindFilter>('all');

  // 내가 피평가자이고 제출된 것만 + 사이클 가시성 반영
  const visibleSubmissions = useMemo(() => {
    if (!currentUser) return [] as ReviewSubmission[];
    return submissions.filter(s => {
      if (s.revieweeId !== currentUser.id) return false;
      if (s.status !== 'submitted') return false;
      const cycle = cycles.find(c => c.id === s.cycleId);
      if (!cycle) return false;
      // self는 본인이 쓴 것이지만 "내가 받은" 탭에서는 숨김 (자기평가는 별도 흐름)
      if (s.type === 'self') return false;

      // 공개 범위 판정
      const when = s.type === 'downward' ? cycle.visibility?.downwardToReviewee ?? 'cycle_close'
        : s.type === 'peer' ? cycle.visibility?.peerToReviewee ?? 'cycle_close'
        : s.type === 'upward' ? cycle.visibility?.upwardToReviewee ?? 'cycle_close'
        : 'cycle_close';
      if (when === 'submission') return true;
      return cycle.status === 'closed';
    });
  }, [submissions, cycles, currentUser]);

  const filtered = useMemo(() => {
    if (filter === 'all') return visibleSubmissions;
    return visibleSubmissions.filter(s => s.type === filter);
  }, [visibleSubmissions, filter]);

  const byKindCount: Record<ReviewKind, number> = {
    self: 0,
    downward: visibleSubmissions.filter(s => s.type === 'downward').length,
    peer: visibleSubmissions.filter(s => s.type === 'peer').length,
    upward: visibleSubmissions.filter(s => s.type === 'upward').length,
  };

  const kindFilters: { value: KindFilter; label: string; count: number }[] = [
    { value: 'all',      label: '전체',    count: visibleSubmissions.length },
    { value: 'downward', label: '조직장',  count: byKindCount.downward },
    { value: 'peer',     label: '동료',    count: byKindCount.peer },
    { value: 'upward',   label: '상향',    count: byKindCount.upward },
  ];

  useSetPageHeader('내가 받은 리뷰', undefined, {
    subtitle: `받은 리뷰 총 ${visibleSubmissions.length}건`,
  });

  if (!currentUser) return <div className="text-center py-20 text-gray-040">로그인이 필요합니다.</div>;

  return (
    <div className="space-y-4">
      <ListToolbar
        segments={[
          {
            kind: 'pills',
            key: 'kind',
            ariaLabel: '리뷰 유형 필터',
            value: filter,
            onChange: v => setFilter(v as KindFilter),
            options: kindFilters.map(k => ({ value: k.value, label: k.label, count: k.count })),
          },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={MsProfileIcon}
          title={filter === 'all' ? '아직 받은 리뷰가 없습니다.' : `받은 ${KIND_LABEL[filter as ReviewKind]} 리뷰가 없습니다.`}
          description="리뷰가 제출되고 공개 시점이 되면 여기에 표시됩니다."
          variant="inline"
        />
      ) : (
        <div className="rounded-xl border border-gray-010 bg-white shadow-card divide-y divide-gray-005">
          {filtered.map(sub => {
            const cycle = cycles.find(c => c.id === sub.cycleId);
            const reviewer = users.find(u => u.id === sub.reviewerId);
            const isAnonymous =
              (sub.type === 'downward' && cycle?.anonymity?.downward) ||
              (sub.type === 'peer' && cycle?.anonymity?.peer) ||
              (sub.type === 'upward' && cycle?.anonymity?.upward);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => navigate(`/reviews/me/${sub.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-005/60"
              >
                <Pill tone={KIND_TONE[sub.type]} size="sm">{KIND_LABEL[sub.type]}</Pill>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-080 truncate">{cycle?.title ?? '–'}</p>
                  <p className="text-[11px] text-gray-040 mt-0.5">
                    제출 {sub.submittedAt ? formatDate(sub.submittedAt) : '-'}
                    {sub.overallRating != null && (
                      <> · 종합 평점 <strong className="text-pink-060">{sub.overallRating.toFixed(1)}</strong></>
                    )}
                  </p>
                </div>
                {reviewer && (
                  <div className="hidden md:flex items-center gap-2 shrink-0">
                    <UserAvatar user={reviewer} size="sm" anonymous={!!isAnonymous} />
                    <span className="text-xs text-gray-060 truncate">
                      {isAnonymous ? '익명' : reviewer.name}
                    </span>
                  </div>
                )}
                <MsChevronRightLineIcon size={16} className="text-gray-030 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
