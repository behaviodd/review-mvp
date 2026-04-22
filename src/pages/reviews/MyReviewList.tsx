import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { deadlineLabel, formatDate, isUrgent } from '../../utils/dateUtils';
import { Star, ChevronRight, CheckCircle2, Clock, Circle, AlertTriangle, UserCheck, ShieldCheck, Users, BarChart2, FileText } from 'lucide-react';
import { useTeamStore } from '../../stores/teamStore';

type Filter = 'all' | 'active' | 'done';

function StatusDot({ status }: { status: string }) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> 제출 완료
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700">
        <Clock className="w-3.5 h-3.5" /> 작성 중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400">
      <Circle className="w-3.5 h-3.5" /> 미시작
    </span>
  );
}

export function MyReviewList() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions, templates } = useReviewStore();
  const { users } = useTeamStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  useSetPageHeader('내 리뷰');

  const mySubmissions = submissions.filter(
    s => s.reviewerId === currentUser?.id && s.type === 'self'
  );

  // 팀장이 나에 대해 작성·제출 완료한 하향 리뷰
  const receivedReviews = submissions.filter(
    s => s.revieweeId === currentUser?.id && s.type === 'downward' && s.status === 'submitted'
  );

  const active  = mySubmissions.filter(s => s.status !== 'submitted');
  const done    = mySubmissions.filter(s => s.status === 'submitted');
  // "완료" 섹션 = 내가 제출한 셀프 리뷰 + 팀장이 나에 대해 제출한 리뷰
  const doneAll = [...done, ...receivedReviews];

  // 관리자 전용: 셀프 리뷰가 배정되지 않는 역할
  if (currentUser?.role === 'admin' && mySubmissions.length === 0 && receivedReviews.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-8 text-center space-y-5">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7 text-indigo-500" />
          </div>
          <div>
            <p className="text-base font-semibold text-neutral-900 mb-1">관리자는 셀프 리뷰 대상이 아닙니다</p>
            <p className="text-sm text-neutral-500">리뷰 주기 생성·관리 및 전체 평가 현황은 아래에서 확인하세요.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => navigate('/reviews/team')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left"
            >
              <Users className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-sm font-semibold text-neutral-800">팀원 평가</p>
                <p className="text-xs text-neutral-400 mt-0.5">팀원별 평가 현황 열람</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/cycles')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left"
            >
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-sm font-semibold text-neutral-800">리뷰 운영</p>
                <p className="text-xs text-neutral-400 mt-0.5">주기 생성 및 현황 관리</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/templates')}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-sm font-semibold text-neutral-800">템플릿 관리</p>
                <p className="text-xs text-neutral-400 mt-0.5">리뷰 양식 생성 및 수정</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 전체가 비어있으면 탭 없이 빈 상태 표시
  if (mySubmissions.length === 0 && receivedReviews.length === 0) {
    return (
      <div className="space-y-5">
        <EmptyState
          icon={Star}
          title="아직 진행 중인 리뷰가 없습니다."
          description="관리자가 리뷰를 생성하면 여기에 나타납니다."
        />
      </div>
    );
  }

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: 'all',    label: '전체',    count: mySubmissions.length + receivedReviews.length },
    { key: 'active', label: '진행 중', count: active.length },
    { key: 'done',   label: '완료',    count: doneAll.length },
  ];

  // ── 셀프 리뷰 행 ─────────────────────────────────────────────────────────────
  const ReviewRow = ({ sub }: { sub: typeof mySubmissions[number] }) => {
    const cycle         = cycles.find(c => c.id === sub.cycleId);
    const template      = templates.find(t => t.id === cycle?.templateId);
    const urgent        = cycle ? isUrgent(cycle.selfReviewDeadline) : false;
    const selfQCount    = template?.questions.filter(q => q.target !== 'leader').length ?? 1;
    const progress      = Math.round((sub.answers.length / selfQCount) * 100);
    const isSubmitted   = sub.status === 'submitted';
    // 제출 완료된 자기평가에 대해 조직장 하향 평가 존재 여부 확인
    const managerEval   = isSubmitted
      ? receivedReviews.find(r => r.cycleId === sub.cycleId)
      : undefined;

    return (
      <div
        onClick={() => navigate(`/reviews/me/${sub.id}`)}
        className={`
          group cursor-pointer transition-colors
          border-b border-neutral-100 last:border-0
          ${urgent && !isSubmitted ? 'bg-primary-50/40 hover:bg-primary-50/70' : 'hover:bg-neutral-50/70'}
        `}
      >
        {/* 모바일 */}
        <div className="flex md:hidden items-start gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {urgent && !isSubmitted && (
                <AlertTriangle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              )}
              <p className={`text-sm font-semibold truncate ${urgent && !isSubmitted ? 'text-primary-700' : 'text-neutral-900'} group-hover:text-primary-700`}>
                {cycle?.title ?? '–'}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <StatusDot status={sub.status} />
              {cycle && (
                <p className={`text-xs ${urgent && !isSubmitted ? 'text-primary-600 font-medium' : 'text-neutral-400'}`}>
                  {deadlineLabel(cycle.selfReviewDeadline)}
                </p>
              )}
              {isSubmitted && (
                managerEval
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600"><UserCheck className="w-2.5 h-2.5" /> 조직장 평가 완료</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-400"><UserCheck className="w-2.5 h-2.5" /> 조직장 평가 대기</span>
              )}
            </div>
            {!isSubmitted && (
              <div className="mt-2">
                <ProgressBar value={progress} size="sm" />
                <p className="text-xs text-neutral-400 mt-1">{sub.answers.length}/{selfQCount} 완료</p>
              </div>
            )}
          </div>
          {!isSubmitted ? (
            <span className={`
              flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold mt-0.5
              ${urgent ? 'bg-primary-500 text-white' : 'bg-primary-600 text-white'}
            `}>
              {sub.status === 'not_started' ? '시작' : '계속'}
              <ChevronRight className="w-3 h-3" />
            </span>
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-300 mt-1 flex-shrink-0" />
          )}
        </div>

        {/* 데스크톱 */}
        <div className="hidden md:flex items-center gap-5 px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {urgent && !isSubmitted && (
                <AlertTriangle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              )}
              <p className={`text-sm font-semibold truncate ${urgent && !isSubmitted ? 'text-primary-700' : 'text-neutral-900'} group-hover:text-primary-700`}>
                {cycle?.title ?? '–'}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-neutral-400">
                {cycle?.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰'}
              </p>
              {isSubmitted && (
                managerEval
                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600"><UserCheck className="w-2.5 h-2.5" /> 조직장 평가 완료</span>
                  : <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-400"><UserCheck className="w-2.5 h-2.5" /> 조직장 평가 대기</span>
              )}
            </div>
          </div>

          <div className="w-32 flex-shrink-0">
            {!isSubmitted ? (
              <div>
                <ProgressBar value={progress} size="sm" />
                <p className="text-xs text-neutral-400 mt-1">{sub.answers.length}/{selfQCount} 완료</p>
              </div>
            ) : (
              <div className="h-1.5 rounded-full bg-success-200" />
            )}
          </div>

          <div className="w-28 flex-shrink-0 text-right">
            {cycle && (
              <>
                <p className={`text-xs font-medium ${urgent && !isSubmitted ? 'text-primary-600' : 'text-neutral-600'}`}>
                  {deadlineLabel(cycle.selfReviewDeadline)}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">{formatDate(cycle.selfReviewDeadline)}</p>
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
                  ? 'bg-primary-500 text-white group-hover:bg-primary-600'
                  : 'bg-primary-600 text-white group-hover:bg-primary-700'}
                transition-colors
              `}>
                {sub.status === 'not_started' ? '시작하기' : '이어서 작성'}
                <ChevronRight className="w-3 h-3" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-400 group-hover:text-neutral-600">
                결과 보기 <ChevronRight className="w-3 h-3" />
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
        className="group cursor-pointer transition-colors border-b border-neutral-100 last:border-0 hover:bg-neutral-50/70"
      >
        {/* 모바일 */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-neutral-900 truncate group-hover:text-primary-700">
                {cycle?.title ?? '–'}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 flex-shrink-0">
                <UserCheck className="w-2.5 h-2.5" /> 조직장 평가
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">{reviewer?.name} 작성</p>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
        </div>

        {/* 데스크톱 */}
        <div className="hidden md:flex items-center gap-5 px-5 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-neutral-900 truncate group-hover:text-primary-700">
                {cycle?.title ?? '–'}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 flex-shrink-0">
                <UserCheck className="w-2.5 h-2.5" /> 조직장 평가
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {reviewer?.name} · {reviewer?.position}
            </p>
          </div>

          {/* 진행도 자리 — 조직장 평가는 완료 바 표시 */}
          <div className="w-32 flex-shrink-0">
            <div className="h-1.5 rounded-full bg-indigo-100" />
          </div>

          <div className="w-28 flex-shrink-0 text-right">
            <p className="text-xs text-neutral-600">
              {sub.submittedAt ? formatDate(sub.submittedAt) : '—'}
            </p>
          </div>

          <div className="w-24 flex-shrink-0 flex justify-end">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> 완료
            </span>
          </div>

          <div className="flex-shrink-0 w-24 flex justify-end">
            <span className="inline-flex items-center gap-1 text-xs text-neutral-400 group-hover:text-neutral-600">
              결과 보기 <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    );
  };

  const SectionHeader = () => (
    <div className="hidden md:flex items-center gap-5 px-5 py-2.5 border-b border-neutral-100 bg-neutral-50/50">
      <div className="flex-1 text-xs font-semibold text-neutral-400 uppercase tracking-wide">리뷰</div>
      <div className="w-32 text-xs font-semibold text-neutral-400 uppercase tracking-wide">진행도</div>
      <div className="w-28 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wide">마감</div>
      <div className="w-24 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wide">상태</div>
      <div className="w-24" />
    </div>
  );

  // "완료" 필터 시 빈 상태 판단
  const isFilterEmpty =
    (filter === 'active' && active.length === 0) ||
    (filter === 'done'   && doneAll.length === 0) ||
    (filter === 'all'    && mySubmissions.length === 0 && receivedReviews.length === 0);

  return (
    <div className="space-y-5">
      {/* 필터 탭 */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-neutral-200 shadow-card p-1 self-start w-fit">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-zinc-950 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
            }`}
          >
            {label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
              filter === key ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* 빈 상태 */}
      {isFilterEmpty ? (
        <EmptyState
          icon={Star}
          title={
            filter === 'active' ? '진행 중인 리뷰가 없습니다.' :
            filter === 'done'   ? '완료한 리뷰가 없습니다.' :
            '아직 진행 중인 리뷰가 없습니다.'
          }
          description={
            filter === 'all' ? '관리자가 리뷰를 생성하면 여기에 나타납니다.' : '다른 필터를 선택해 보세요.'
          }
        />
      ) : filter === 'active' ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          <SectionHeader />
          {active.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
        </div>
      ) : filter === 'done' ? (
        /* 완료 필터: 셀프 리뷰 + 조직장 평가 통합 */
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          <SectionHeader />
          {done.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
          {receivedReviews.map(sub => <ReceivedReviewRow key={sub.id} sub={sub} />)}
        </div>
      ) : (
        /* 전체: 진행 중 / 제출 완료 섹션 분리 */
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 px-1">진행 중</p>
              <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
                <SectionHeader />
                {active.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
              </div>
            </div>
          )}
          {doneAll.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 px-1">제출 완료</p>
              <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
                <SectionHeader />
                {done.map(sub => <ReviewRow key={sub.id} sub={sub} />)}
                {receivedReviews.map(sub => <ReceivedReviewRow key={sub.id} sub={sub} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
