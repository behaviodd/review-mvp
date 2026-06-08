import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { MsButton } from '../../components/ui/MsButton';
import { MsStarIcon, MsUsersIcon, MsCalendarIcon } from '../../components/ui/MsIcons';
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

/** 사이클의 리뷰 종류 서브텍스트 */
function reviewKindLabel(cycle: ReviewCycle) {
  const kinds = cycle.reviewKinds ?? ['self', 'downward'];
  const labels: Record<string, string> = {
    self: '셀프', downward: '하향', peer: '동료', upward: '상향',
  };
  return kinds.map(k => labels[k] ?? k).join('·') + ' 리뷰';
}

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

  // 참여자 수 (해당 사이클의 self submission 수)
  const { submissions } = useReviewStore();
  const participantCount = cycle
    ? submissions.filter(s => s.cycleId === cycle.id && s.type === 'self').length
    : 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-3.5 px-2 rounded-lg hover:bg-interaction-hovered transition-colors cursor-pointer group"
    >
      <ReviewIcon type={sub.type} />

      <div className="flex-1 min-w-0">
        <p className={`text-base font-semibold truncate group-hover:text-fg-brand1 transition-colors ${
          urgent && sub.status !== 'submitted' ? 'text-orange-060' : 'text-fg-default'
        }`}>
          {cycle?.title ?? '–'}
        </p>
        <p className="text-xs text-fg-subtle mt-0.5">
          {cycle ? reviewKindLabel(cycle) : ''}
          {sub.type !== 'self' && sub.type !== 'downward' && (
            <span className="ml-1">· {sub.type === 'peer' ? '동료 평가' : '상향 평가'}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-fg-subtle">
        {/* 참여자 수 */}
        {participantCount > 0 && (
          <span className="flex items-center gap-1">
            <MsUsersIcon size={13} className="text-fg-subtlest" />
            {participantCount}명
          </span>
        )}
        {/* 기간 */}
        {cycle && (
          <span className="flex items-center gap-1 hidden md:flex">
            <MsCalendarIcon size={13} className="text-fg-subtlest" />
            {formatPeriod(cycle)}
          </span>
        )}
        {/* 마감 (진행 중만) */}
        {showAction && cycle && sub.status !== 'submitted' && (
          <span className={`hidden md:block text-xs font-medium ${urgent ? 'text-orange-060' : 'text-fg-subtlest'}`}>
            {deadlineLabel(cycle.selfReviewDeadline)}
          </span>
        )}
      </div>

      {/* 액션 버튼 (진행 중) */}
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
  const { submissions } = useReviewStore();
  const reviewer = users.find(u => u.id === sub.reviewerId);
  const participantCount = cycle
    ? submissions.filter(s => s.cycleId === cycle.id && s.type === 'self').length
    : 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-3.5 px-2 rounded-lg hover:bg-interaction-hovered transition-colors cursor-pointer group"
    >
      <ReviewIcon type="downward" />

      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold truncate text-fg-default group-hover:text-fg-brand1 transition-colors">
          {cycle?.title ?? '–'}
        </p>
        <p className="text-xs text-fg-subtle mt-0.5">
          {cycle ? reviewKindLabel(cycle) : ''}
          {reviewer && <span className="ml-1">· {reviewer.name} 작성</span>}
        </p>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-fg-subtle">
        {participantCount > 0 && (
          <span className="flex items-center gap-1">
            <MsUsersIcon size={13} className="text-fg-subtlest" />
            {participantCount}명
          </span>
        )}
        {cycle && (
          <span className="flex items-center gap-1 hidden md:flex">
            <MsCalendarIcon size={13} className="text-fg-subtlest" />
            {sub.submittedAt ? formatDate(sub.submittedAt) : formatPeriod(cycle)}
          </span>
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
      <div className="divide-y divide-bd-default">
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

  useSetPageHeader('내 리뷰');

  const totalActive = activeSubs.length;

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

      {/* 탭 */}
      <div className="flex border-b border-bd-default -mb-2">
        {([
          { key: 'active' as Tab, label: '진행 중인 리뷰', count: totalActive },
          { key: 'closed' as Tab, label: '마감된 리뷰',    count: closedSent.length + closedReceived.length },
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-1 pb-2.5 mr-5 text-base font-semibold border-b-2 transition-colors ${
              tab === key
                ? 'border-fg-default text-fg-default'
                : 'border-transparent text-fg-subtle hover:text-fg-default'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 text-xs font-bold ${tab === key ? 'text-fg-default' : 'text-fg-subtlest'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'active' ? (
        activeSubs.length === 0 ? (
          <EmptyState
            icon={MsStarIcon}
            title="진행 중인 리뷰가 없습니다."
            description="작성을 완료했거나 아직 리뷰가 배정되지 않았습니다."
          />
        ) : (
          <div className="divide-y divide-bd-default">
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
