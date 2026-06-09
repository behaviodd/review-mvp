import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useMemo } from 'react';
import { EmptyState } from '../../components/ui/EmptyState';
import { MsButton } from '../../components/ui/MsButton';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { HeaderTab } from '../../components/layout/HeaderTab';
import { MsStarIcon, MsUsersIcon } from '../../components/ui/MsIcons';
import { PeerPickReminder } from '../../components/review/PeerPickReminder';
import { deadlineLabel, formatDate, isUrgent } from '../../utils/dateUtils';
import type { ReviewCycle, ReviewSubmission } from '../../types';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 사이클 기간: 생성일 ~ selfReviewDeadline */
function formatPeriod(cycle: ReviewCycle) {
  const start = new Date(cycle.createdAt);
  const end   = new Date(cycle.selfReviewDeadline);
  const fmt   = (d: Date) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
  if (start.getFullYear() === end.getFullYear()) {
    return `${fmt(start)} – ${end.getMonth() + 1}. ${end.getDate()}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

const TYPE_LABEL: Record<string, string> = {
  self: 'Self 리뷰', downward: '하향 평가', peer: '동료 평가', upward: '상향 평가',
};

/** 리뷰 아이콘 색상 (submission type 또는 cycle 기반) */
const ICON_STYLE: Record<string, string> = {
  self:     'bg-pink-010 text-pink-060',
  downward: 'bg-blue-005 text-blue-060',
  peer:     'bg-purple-005 text-purple-040',
  upward:   'bg-green-005 text-green-060',
};

function ReviewIcon({ type }: { type: string }) {
  const icons: Record<string, string> = { self: 'S', downward: '↓', peer: 'P', upward: '↑' };
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-base font-bold ${ICON_STYLE[type] ?? 'bg-gray-010 text-fg-subtle'}`}>
      {icons[type] ?? '?'}
    </div>
  );
}

// ─── 리뷰 행 ─────────────────────────────────────────────────────────────────

function ReviewRow({
  sub, cycle, onClick, showAction,
}: {
  sub: ReviewSubmission;
  cycle: ReviewCycle | undefined;
  onClick: () => void;
  showAction?: boolean;
}) {
  const urgent = cycle ? isUrgent(cycle.selfReviewDeadline) : false;
  const { submissions } = useReviewStore();
  const { users } = useTeamStore();

  const participantCount = cycle
    ? submissions.filter(s => s.cycleId === cycle.id && s.type === 'self').length
    : 0;

  const reviewee = users.find(u => u.id === sub.revieweeId);
  const showReviewee = (sub.type === 'peer' || sub.type === 'upward') && reviewee;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 min-h-[52px] py-1.5 px-2 rounded-lg hover:bg-interaction-hovered transition-colors cursor-pointer group"
    >
      <ReviewIcon type={sub.type} />

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className={`text-base font-semibold tracking-[-0.3px] truncate group-hover:text-fg-brand1 transition-colors ${
          urgent && sub.status !== 'submitted' ? 'text-orange-060' : 'text-fg-default'
        }`}>
          {cycle?.title ?? '–'}
        </p>
        <p className="text-sm text-fg-subtle truncate">
          {TYPE_LABEL[sub.type] ?? sub.type}
          {showReviewee && (
            <span className="text-fg-subtlest"> · {reviewee.name}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* 상태 배지 — 모바일에서 버튼 대신 표시 */}
        <span className={showAction && sub.status !== 'submitted' ? 'md:hidden' : ''}>
          <StatusBadge type="submission" value={sub.status} />
        </span>

        {/* 메타 정보 */}
        <div className="hidden md:flex items-center gap-3 text-xs text-fg-subtle">
          {participantCount > 0 && (
            <span className="flex items-center gap-1">
              <MsUsersIcon size={13} className="text-fg-subtlest" />
              {participantCount}명
            </span>
          )}
          {showAction && cycle && sub.status !== 'submitted' && (
            <span className={`font-medium ${urgent ? 'text-orange-060' : 'text-fg-subtlest'}`}>
              {deadlineLabel(cycle.selfReviewDeadline)}
            </span>
          )}
          {!showAction && cycle && (
            <span className="text-fg-subtlest">
              {sub.submittedAt ? formatDate(sub.submittedAt) : formatPeriod(cycle)}
            </span>
          )}
        </div>

        {/* 액션 버튼 (진행 중, 데스크톱) */}
        {showAction && sub.status !== 'submitted' && (
          <MsButton
            size="sm"
            variant={urgent ? 'brand1' : 'outline-brand1'}
            onClick={e => { e.stopPropagation(); onClick(); }}
            className="flex-shrink-0 hidden md:inline-flex"
          >
            {sub.status === 'not_started' ? '시작하기' : '이어서 작성'}
          </MsButton>
        )}
      </div>
    </div>
  );
}

/** 받은 리뷰 행 (downward — reviewee 기준) */
function ReceivedRow({
  sub, cycle, onClick,
}: {
  sub: ReviewSubmission;
  cycle: ReviewCycle | undefined;
  onClick: () => void;
}) {
  const { users } = useTeamStore();
  const reviewer = users.find(u => u.id === sub.reviewerId);

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 min-h-[52px] py-1.5 px-2 rounded-lg hover:bg-interaction-hovered transition-colors cursor-pointer group"
    >
      <ReviewIcon type="downward" />

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-base font-semibold tracking-[-0.3px] truncate text-fg-default group-hover:text-fg-brand1 transition-colors">
          {cycle?.title ?? '–'}
        </p>
        <p className="text-sm text-fg-subtle truncate">
          {TYPE_LABEL.downward}
          {reviewer && <span className="text-fg-subtlest"> · {reviewer.name} 작성</span>}
        </p>
      </div>

      <div className="hidden md:flex items-center gap-3 flex-shrink-0 text-xs text-fg-subtlest">
        {cycle && (
          <span>{sub.submittedAt ? formatDate(sub.submittedAt) : formatPeriod(cycle)}</span>
        )}
      </div>
    </div>
  );
}

// ─── 섹션 래퍼 ───────────────────────────────────────────────────────────────

const PREVIEW_COUNT = 5;

function ReviewSection({
  title, count, children, total, onShowMore,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  total: number;
  onShowMore?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-fg-subtle">
          {title} <span className="text-fg-subtlest">({count})</span>
        </p>
        {total > PREVIEW_COUNT && onShowMore && (
          <button
            onClick={onShowMore}
            className="text-xs text-fg-brand1 hover:text-fg-brand1-bolder hover:underline"
          >
            더 보기
          </button>
        )}
      </div>
      <div>
        {children}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

type Tab = 'active' | 'closed';

export function MyReviewList() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('active');
  const [showAllReceived, setShowAllReceived] = useState(false);
  const [showAllSent, setShowAllSent] = useState(false);

  const closedCycleIds = new Set(cycles.filter(c => c.status === 'closed').map(c => c.id));

  // 내가 작성해야 하는 submission (self / peer / upward)
  const mySubs = submissions.filter(
    s => s.reviewerId === currentUser?.id &&
         (s.type === 'self' || s.type === 'peer' || s.type === 'upward'),
  );

  // 내가 받은 하향 평가 (submitted)
  const receivedSubs = submissions.filter(
    s => s.revieweeId === currentUser?.id && s.type === 'downward' && s.status === 'submitted',
  );

  // 탭 데이터
  const activeSubs = mySubs
    .filter(s => s.status !== 'submitted' && !closedCycleIds.has(s.cycleId))
    .sort((a, b) => (Date.parse(b.lastSavedAt) || 0) - (Date.parse(a.lastSavedAt) || 0));

  const closedSent = mySubs
    .filter(s => s.status === 'submitted' || closedCycleIds.has(s.cycleId))
    .sort((a, b) => (Date.parse(b.lastSavedAt) || 0) - (Date.parse(a.lastSavedAt) || 0));

  const closedReceived = receivedSubs
    .sort((a, b) => (Date.parse(b.submittedAt ?? b.lastSavedAt) || 0) - (Date.parse(a.submittedAt ?? a.lastSavedAt) || 0));

  const totalActive   = activeSubs.length;
  const totalClosed   = closedSent.length + closedReceived.length;

  const headerTabs = useMemo(() => (
    <>
      <HeaderTab active={tab === 'active'} onClick={() => setTab('active')}>
        진행 중인 리뷰{totalActive > 0 ? ` ${totalActive}` : ''}
      </HeaderTab>
      <HeaderTab active={tab === 'closed'} onClick={() => setTab('closed')}>
        마감된 리뷰{totalClosed > 0 ? ` ${totalClosed}` : ''}
      </HeaderTab>
    </>
  ), [tab, totalActive, totalClosed]);

  useSetPageHeader('내 리뷰', undefined, { tabs: headerTabs });

  if (mySubs.length === 0 && receivedSubs.length === 0) {
    return (
      <div className="space-y-5">
        <PeerPickReminder />
        <EmptyState
          icon={MsStarIcon}
          title="아직 진행 중인 리뷰가 없습니다."
          description="관리자가 리뷰를 생성하면 여기에 나타납니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PeerPickReminder />

      {/* 탭 콘텐츠 */}
      {tab === 'active' ? (
        activeSubs.length === 0 ? (
          <EmptyState
            icon={MsStarIcon}
            title="진행 중인 리뷰가 없습니다."
            description="작성을 완료했거나 아직 리뷰가 배정되지 않았습니다."
          />
        ) : (
          <div>
            {activeSubs.map(sub => {
              const cycle = cycles.find(c => c.id === sub.cycleId);
              return (
                <ReviewRow
                  key={sub.id}
                  sub={sub}
                  cycle={cycle}
                  onClick={() => navigate(`/reviews/me/${sub.id}`)}
                  showAction
                />
              );
            })}
          </div>
        )
      ) : (
        /* 마감된 리뷰 탭 */
        <div className="space-y-6">
          {/* 받은 리뷰 */}
          {closedReceived.length > 0 && (
            <ReviewSection
              title="받은 리뷰"
              count={closedReceived.length}
              total={closedReceived.length}
              onShowMore={() => setShowAllReceived(v => !v)}
            >
              {(showAllReceived ? closedReceived : closedReceived.slice(0, PREVIEW_COUNT)).map(sub => {
                const cycle = cycles.find(c => c.id === sub.cycleId);
                return (
                  <ReceivedRow
                    key={sub.id}
                    sub={sub}
                    cycle={cycle}
                    onClick={() => navigate(`/reviews/me/${sub.id}`)}
                  />
                );
              })}
            </ReviewSection>
          )}

          {/* 보낸 리뷰 */}
          {closedSent.length > 0 && (
            <ReviewSection
              title="보낸 리뷰"
              count={closedSent.length}
              total={closedSent.length}
              onShowMore={() => setShowAllSent(v => !v)}
            >
              {(showAllSent ? closedSent : closedSent.slice(0, PREVIEW_COUNT)).map(sub => {
                const cycle = cycles.find(c => c.id === sub.cycleId);
                return (
                  <ReviewRow
                    key={sub.id}
                    sub={sub}
                    cycle={cycle}
                    onClick={() => navigate(`/reviews/me/${sub.id}`)}
                  />
                );
              })}
            </ReviewSection>
          )}

          {closedReceived.length === 0 && closedSent.length === 0 && (
            <EmptyState
              icon={MsStarIcon}
              title="마감된 리뷰가 없습니다."
              description="완료된 리뷰가 생기면 여기에 표시됩니다."
            />
          )}
        </div>
      )}
    </div>
  );
}
