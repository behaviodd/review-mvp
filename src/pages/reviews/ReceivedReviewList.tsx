import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { Pill } from '../../components/ui/Pill';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeaderTab } from '../../components/layout/HeaderTab';
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

  /* Phase D-3.B: 4개 필터 → 헤더 탭 (사용자 결정 α "리뷰 종류 = 1차 분류").
     Figma "공통사항만 1개씩 예시" 정책에 따라 HeaderTab 자체에 count prop 추가 안 함.
     count 는 라벨 뒤 inline 으로 표기 (label 텍스트의 일부). */
  const headerTabs = useMemo(() => (
    <>
      <HeaderTab active={filter === 'all'} onClick={() => setFilter('all')}>
        전체 {visibleSubmissions.length}
      </HeaderTab>
      <HeaderTab active={filter === 'downward'} onClick={() => setFilter('downward')}>
        조직장 {byKindCount.downward}
      </HeaderTab>
      <HeaderTab active={filter === 'peer'} onClick={() => setFilter('peer')}>
        동료 {byKindCount.peer}
      </HeaderTab>
      <HeaderTab active={filter === 'upward'} onClick={() => setFilter('upward')}>
        상향 {byKindCount.upward}
      </HeaderTab>
    </>
  ), [filter, visibleSubmissions.length, byKindCount.downward, byKindCount.peer, byKindCount.upward]);

  useSetPageHeader('내가 받은 리뷰', undefined, {
    tabs: headerTabs,
  });

  if (!currentUser) return <EmptyState illustration="empty-list" title="로그인이 필요합니다." action={{ label: '로그인으로', onClick: () => navigate('/login') }} />;

  return (
    /* Phase D-3.B: 카드 컨테이너 제거 + 시트형 row (§ 7.6 정합).
       Avatar 40, name 16 SemiBold, sub 14 Regular subtle. */
    <div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={MsProfileIcon}
          title={filter === 'all' ? '아직 받은 리뷰가 없습니다.' : `받은 ${KIND_LABEL[filter as ReviewKind]} 리뷰가 없습니다.`}
          description="리뷰가 제출되고 공개 시점이 되면 여기에 표시됩니다."
          variant="inline"
        />
      ) : (
        <div className="space-y-1">
          {filtered.map(sub => {
            const cycle = cycles.find(c => c.id === sub.cycleId);
            const reviewer = users.find(u => u.id === sub.reviewerId);
            const isAnonymous =
              (sub.type === 'downward' && cycle?.anonymity?.downward) ||
              (sub.type === 'peer' && cycle?.anonymity?.peer) ||
              (sub.type === 'upward' && cycle?.anonymity?.upward);
            const subParts = [
              sub.submittedAt ? `제출 ${formatDate(sub.submittedAt)}` : null,
              sub.overallRating != null ? `평점 ${sub.overallRating.toFixed(1)}` : null,
              reviewer ? (isAnonymous ? '익명' : reviewer.name) : null,
            ].filter(Boolean);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => navigate(`/reviews/me/${sub.id}`)}
                className="flex w-full items-center gap-3 min-h-[52px] px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-interaction-hovered group"
              >
                {reviewer && (
                  <UserAvatar user={reviewer} className="size-10 rounded-full" anonymous={!!isAnonymous} />
                )}
                <div className="flex flex-col flex-1 min-w-0 justify-center gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-semibold text-fg-default tracking-[-0.3px] leading-6 truncate">
                      {cycle?.title ?? '–'}
                    </p>
                    <Pill tone={KIND_TONE[sub.type]} size="sm">{KIND_LABEL[sub.type]}</Pill>
                  </div>
                  {subParts.length > 0 && (
                    <p className="text-sm font-normal text-fg-subtle leading-5 tracking-[-0.3px] truncate">
                      {subParts.join(' · ')}
                    </p>
                  )}
                </div>
                <MsChevronRightLineIcon size={14} className="text-fg-subtlest shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
