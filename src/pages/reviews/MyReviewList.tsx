import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { deadlineLabel, formatDate, isUrgent } from '../../utils/dateUtils';
import { Circle, ShieldCheck, Users, BarChart2 } from 'lucide-react';
import { MsStarIcon, MsChevronRightLineIcon, MsCheckCircleIcon, MsClockIcon, MsWarningIcon, MsProfileIcon, MsArticleIcon } from '../../components/ui/MsIcons';
import { PeerPickReminder } from '../../components/review/PeerPickReminder';
import { useTeamStore } from '../../stores/teamStore';

type StatusFilter = 'all' | 'active' | 'done' | 'closed';
type TypeFilter   = 'all' | 'scheduled' | 'adhoc';

function StatusDot({ status }: { status: string }) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-060">
        <MsCheckCircleIcon size={12} /> 제출 완료
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-060">
        <MsClockIcon size={12} /> 작성 중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-040">
      <Circle className="w-3.5 h-3.5" /> 미시작
    </span>
  );
}

export function MyReviewList() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions, templates } = useReviewStore();
  const { users } = useTeamStore();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all');

  useSetPageHeader('내 리뷰');

  // 종료된 사이클 ID 집합
  const closedCycleIds = new Set(cycles.filter(c => c.status === 'closed').map(c => c.id));

  // 내가 작성해야 하는 모든 유형 (self + peer + upward)
  const mySubmissions = submissions.filter(
    s => s.reviewerId === currentUser?.id && (s.type === 'self' || s.type === 'peer' || s.type === 'upward')
  );

  const receivedReviews = submissions.filter(
    s => s.revieweeId === currentUser?.id && s.type === 'downward' && s.status === 'submitted'
  );

  // 유형 필터 적용
  const typeMatch = (cycleId: string) => {
    if (typeFilter === 'all') return true;
    const c = cycles.find(x => x.id === cycleId);
    return c?.type === typeFilter;
  };

  const filteredMySubmissions = mySubmissions.filter(s => typeMatch(s.cycleId));
  const filteredReceived      = receivedReviews.filter(s => typeMatch(s.cycleId));

  // 상태별 분류
  const active  = filteredMySubmissions.filter(s => s.status !== 'submitted' && !closedCycleIds.has(s.cycleId));
  const done    = filteredMySubmissions.filter(s => s.status === 'submitted'  && !closedCycleIds.has(s.cycleId));
  const closedSelf     = filteredMySubmissions.filter(s => closedCycleIds.has(s.cycleId));
  const closedReceived = filteredReceived.filter(s => closedCycleIds.has(s.cycleId));
  const doneAll = [...done, ...filteredReceived.filter(s => !closedCycleIds.has(s.cycleId))];

  if (currentUser?.role === 'admin' && mySubmissions.length === 0 && receivedReviews.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-020 shadow-card p-8 text-center space-y-5">
          <div className="w-14 h-14 bg-blue-005 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-blue-050" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-099 mb-1">관리자는 셀프 리뷰 대상이 아닙니다</p>
            <p className="text-sm text-gray-050">리뷰 주기 생성·관리 및 전체 평가 현황은 아래에서 확인하세요.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => navigate('/reviews/team')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-020 hover:border-blue-020 hover:bg-blue-005/40 transition-colors text-left"
            >
              <Users className="w-5 h-5 text-blue-050" />
              <div>
                <p className="text-sm font-semibold text-gray-080">팀원 평가</p>
                <p className="text-xs text-gray-040 mt-0.5">팀원별 평가 현황 열람</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/cycles')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-020 hover:border-blue-020 hover:bg-blue-005/40 transition-colors text-left"
            >
              <BarChart2 className="w-5 h-5 text-blue-050" />
              <div>
                <p className="text-sm font-semibold text-gray-080">리뷰 운영</p>
                <p className="text-xs text-gray-040 mt-0.5">주기 생성 및 현황 관리</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/templates')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-020 hover:border-blue-020 hover:bg-blue-005/40 transition-colors text-left"
            >
              <MsArticleIcon size={20} className="text-blue-050" />
              <div>
                <p className="text-sm font-semibold text-gray-080">템플릿 관리</p>
                <p className="text-xs text-gray-040 mt-0.5">리뷰 양식 생성 및 수정</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mySubmissions.length === 0 && receivedReviews.length === 0) {
    return (
      <div className="space-y-5">
        <EmptyState
          icon={MsStarIcon}
          title="아직 진행 중인 리뷰가 없습니다."
          description="관리자가 리뷰를 생성하면 여기에 나타납니다."
        />
      </div>
    );
  }

  const totalCount  = filteredMySubmissions.length + filteredReceived.length;
  const closedCount = closedSelf.length + closedReceived.length;

  const tabs = [
    { value: 'all'    as StatusFilter, label: '전체',    count: totalCount },
    { value: 'active' as StatusFilter, label: '진행 중', count: active.length },
    { value: 'done'   as StatusFilter, label: '완료',    count: doneAll.length },
    { value: 'closed' as StatusFilter, label: '종료됨',  count: closedCount },
  ];

  // ── 셀프 리뷰 행 ─────────────────────────────────────────────────────────────
  const ReviewRow = ({ sub }: { sub: typeof mySubmissions[number] }) => {
    const cycle         = cycles.find(c => c.id === sub.cycleId);
    const template      = templates.find(t => t.id === cycle?.templateId);
    const urgent        = cycle ? isUrgent(cycle.selfReviewDeadline) : false;
    const selfQCount    = template?.questions.filter(q => q.target !== 'leader').length ?? 1;
    const progress      = Math.round((sub.answers.length / selfQCount) * 100);
    const isSubmitted   = sub.status === 'submitted';
    const managerEval   = isSubmitted
      ? receivedReviews.find(r => r.cycleId === sub.cycleId)
      : undefined;

    const kindBadge = sub.type === 'peer'
      ? <span className="inline-flex items-center rounded-full border border-purple-010 bg-purple-005 px-1.5 py-0.5 text-[10px] font-semibold text-purple-060">동료</span>
      : sub.type === 'upward'
        ? <span className="inline-flex items-center rounded-full border border-blue-020 bg-blue-005 px-1.5 py-0.5 text-[10px] font-semibold text-blue-070">상향</span>
        : null;
    const revieweeForOther = sub.type !== 'self' ? users.find(u => u.id === sub.revieweeId) : undefined;

    return (
      <div
        onClick={() => navigate(`/reviews/me/${sub.id}`)}
        className={`
          group cursor-pointer transition-colors
          border-b border-gray-010 last:border-0
          ${urgent && !isSubmitted ? 'bg-pink-005/40 hover:bg-pink-005/70' : 'hover:bg-gray-005/70'}
        `}
      >
        {/* 모바일 */}
        <div className="flex md:hidden items-start gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {urgent && !isSubmitted && (
                <MsWarningIcon size={12} className="text-pink-040 flex-shrink-0" />
              )}
              {kindBadge}
              <p className={`text-sm font-semibold truncate ${urgent && !isSubmitted ? 'text-pink-060' : 'text-gray-099'} group-hover:text-pink-060`}>
                {cycle?.title ?? '–'}
                {revieweeForOther && <span className="ml-1 text-xs font-normal text-gray-050">· {revieweeForOther.name}</span>}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <StatusDot status={sub.status} />
              {cycle && (
                <p className={`text-xs ${urgent && !isSubmitted ? 'text-pink-050 font-medium' : 'text-gray-040'}`}>
                  {deadlineLabel(cycle.selfReviewDeadline)}
                </p>
              )}
              {isSubmitted && (
                managerEval
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-pink-005 text-pink-050"><MsProfileIcon size={12} /> 조직장 평가 완료</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-010 text-gray-040"><MsProfileIcon size={12} /> 조직장 평가 대기</span>
              )}
            </div>
            {!isSubmitted && (
              <div className="mt-2">
                <ProgressBar value={progress} size="sm" />
                <p className="text-xs text-gray-040 mt-1">{sub.answers.length}/{selfQCount} 완료</p>
              </div>
            )}
          </div>
          {!isSubmitted ? (
            <span className={`
              flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold mt-0.5
              ${urgent ? 'bg-pink-040 text-white' : 'bg-pink-050 text-white'}
            `}>
              {sub.status === 'not_started' ? '시작' : '계속'}
              <MsChevronRightLineIcon size={12} />
            </span>
          ) : (
            <MsChevronRightLineIcon size={16} className="text-gray-030 mt-1 flex-shrink-0" />
          )}
        </div>

        {/* 데스크톱 */}
        <div className="hidden md:flex items-center gap-5 px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {urgent && !isSubmitted && (
                <MsWarningIcon size={12} className="text-pink-040 flex-shrink-0" />
              )}
              {kindBadge}
              <p className={`text-sm font-semibold truncate ${urgent && !isSubmitted ? 'text-pink-060' : 'text-gray-099'} group-hover:text-pink-060`}>
                {cycle?.title ?? '–'}
                {revieweeForOther && <span className="ml-1 text-xs font-normal text-gray-050">· {revieweeForOther.name}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-gray-040">
                {cycle?.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰'}
              </p>
              {isSubmitted && (
                managerEval
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-pink-005 text-pink-050"><MsProfileIcon size={12} /> 조직장 평가 완료</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-010 text-gray-040"><MsProfileIcon size={12} /> 조직장 평가 대기</span>
              )}
            </div>
          </div>

          <div className="w-32 flex-shrink-0">
            {!isSubmitted ? (
              <div>
                <ProgressBar value={progress} size="sm" />
                <p className="text-xs text-gray-040 mt-1">{sub.answers.length}/{selfQCount} 완료</p>
              </div>
            ) : (
              <div className="h-1.5 rounded-full bg-green-020" />
            )}
          </div>

          <div className="w-28 flex-shrink-0 text-right">
            {cycle && (
              <>
                <p className={`text-xs font-medium ${urgent && !isSubmitted ? 'text-pink-050' : 'text-gray-060'}`}>
                  {deadlineLabel(cycle.selfReviewDeadline)}
                </p>
                <p className="text-xs text-gray-040 mt-0.5">{formatDate(cycle.selfReviewDeadline)}</p>
              </>
            )}
          </div>

          <div className="w-24 flex-shrink-0 flex justify-end">
            <StatusDot status={sub.status} />
          </div>

          <div className="flex-shrink-0 w-24 flex justify-end">
            {!isSubmitted ? (
              <span className={`
                inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold
                ${urgent
                  ? 'bg-pink-040 text-white group-hover:bg-pink-050'
                  : 'bg-pink-050 text-white group-hover:bg-pink-060'}
                transition-colors
              `}>
                {sub.status === 'not_started' ? '시작하기' : '이어서 작성'}
                <MsChevronRightLineIcon size={12} />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-gray-040 group-hover:text-gray-060">
                결과 보기 <MsChevronRightLineIcon size={12} />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── 조직장 하향 평가 행 ────────────────────────────────────────────────────────
  const ReceivedReviewRow = ({ sub }: { sub: typeof receivedReviews[number] }) => {
    const cycle    = cycles.find(c => c.id === sub.cycleId);
    const reviewer = users.find(u => u.id === sub.reviewerId);

    return (
      <div
        onClick={() => navigate(`/reviews/me/${sub.id}`)}
        className="group cursor-pointer transition-colors border-b border-gray-010 last:border-0 hover:bg-gray-005/70"
      >
        {/* 모바일 */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-099 truncate group-hover:text-pink-060">
                {cycle?.title ?? '–'}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-pink-005 text-pink-050 flex-shrink-0">
                <MsProfileIcon size={12} /> 조직장 평가
              </span>
            </div>
            <p className="text-xs text-gray-040 mt-0.5">{reviewer?.name} 작성</p>
          </div>
          <MsChevronRightLineIcon size={16} className="text-gray-030 flex-shrink-0" />
        </div>

        {/* 데스크톱 */}
        <div className="hidden md:flex items-center gap-5 px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-099 truncate group-hover:text-pink-060">
                {cycle?.title ?? '–'}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-pink-005 text-pink-050 flex-shrink-0">
                <MsProfileIcon size={12} /> 조직장 평가
              </span>
            </div>
            <p className="text-xs text-gray-040 mt-0.5">
              {reviewer?.name} · {reviewer?.position}
            </p>
          </div>

          <div className="w-32 flex-shrink-0">
            <div className="h-1.5 rounded-full bg-blue-010" />
          </div>

          <div className="w-28 flex-shrink-0 text-right">
            <p className="text-xs text-gray-060">
              {sub.submittedAt ? formatDate(sub.submittedAt) : '—'}
            </p>
          </div>

          <div className="w-24 flex-shrink-0 flex justify-end">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-060">
              <MsCheckCircleIcon size={12} /> 완료
            </span>
          </div>

          <div className="flex-shrink-0 w-24 flex justify-end">
            <span className="inline-flex items-center gap-1 text-xs text-gray-040 group-hover:text-gray-060">
              결과 보기 <MsChevronRightLineIcon size={12} />
            </span>
          </div>
        </div>
      </div>
    );
  };

  const SectionHeader = () => (
    <div className="hidden md:flex items-center gap-5 px-5 py-2.5 border-b border-gray-010 bg-gray-005/50">
      <div className="flex-1 text-xs font-semibold text-gray-040 uppercase tracking-wide">리뷰</div>
      <div className="w-32 text-xs font-semibold text-gray-040 uppercase tracking-wide">진행도</div>
      <div className="w-28 text-right text-xs font-semibold text-gray-040 uppercase tracking-wide">마감</div>
      <div className="w-24 text-right text-xs font-semibold text-gray-040 uppercase tracking-wide">상태</div>
      <div className="w-24" />
    </div>
  );

  const isFilterEmpty =
    (statusFilter === 'active' && active.length === 0) ||
    (statusFilter === 'done'   && doneAll.length === 0) ||
    (statusFilter === 'closed' && closedCount === 0)    ||
    (statusFilter === 'all'    && totalCount === 0);

  return (
    <div className="space-y-5">
      <PeerPickReminder />

      <ListToolbar<StatusFilter>
        tabs={tabs}
        activeTab={statusFilter}
        onTabChange={setStatusFilter}
        segments={[
          {
            kind: 'pills',
            key: 'type',
            ariaLabel: '유형 필터',
            value: typeFilter,
            onChange: v => setTypeFilter(v as TypeFilter),
            options: [
              { value: 'all',       label: '전체' },
              { value: 'scheduled', label: '정기' },
              { value: 'adhoc',     label: '수시' },
            ],
          },
        ]}
      />

      {/* 빈 상태 */}
      {isFilterEmpty ? (
        <EmptyState
          icon={MsStarIcon}
          title={
            statusFilter === 'active' ? '진행 중인 리뷰가 없습니다.' :
            statusFilter === 'done'   ? '완료한 리뷰가 없습니다.' :
            statusFilter === 'closed' ? '종료된 리뷰가 없습니다.' :
            '아직 진행 중인 리뷰가 없습니다.'
          }
          description={
            statusFilter === 'all' ? '관리자가 리뷰를 생성하면 여기에 나타납니다.' : '다른 필터를 선택해 보세요.'
          }
        />
      ) : statusFilter === 'active' ? (
        <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
          <SectionHeader />
          {active.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
        </div>
      ) : statusFilter === 'done' ? (
        <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
          <SectionHeader />
          {done.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
          {filteredReceived.filter(s => !closedCycleIds.has(s.cycleId)).map(sub => <ReceivedReviewRow key={sub.id} sub={sub} />)}
        </div>
      ) : statusFilter === 'closed' ? (
        <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
          <SectionHeader />
          {closedSelf.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
          {closedReceived.map(sub => <ReceivedReviewRow key={sub.id} sub={sub} />)}
        </div>
      ) : (
        /* 전체: 섹션 분리 */
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-040 uppercase tracking-wide mb-2 px-1">진행 중</p>
              <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
                <SectionHeader />
                {active.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
              </div>
            </div>
          )}
          {doneAll.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-040 uppercase tracking-wide mb-2 px-1">완료</p>
              <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
                <SectionHeader />
                {done.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
                {filteredReceived.filter(s => !closedCycleIds.has(s.cycleId)).map(sub => <ReceivedReviewRow key={sub.id} sub={sub} />)}
              </div>
            </div>
          )}
          {closedCount > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-040 uppercase tracking-wide mb-2 px-1">종료됨</p>
              <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
                <SectionHeader />
                {closedSelf.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
                {closedReceived.map(sub => <ReceivedReviewRow key={sub.id} sub={sub} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
