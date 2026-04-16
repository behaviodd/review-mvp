import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useReviewStore } from '../../stores/reviewStore';
import { MOCK_USERS, MOCK_TEMPLATES } from '../../data/mockData';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { deadlineLabel, formatDate, isUrgent } from '../../utils/dateUtils';
import {
  Users, ChevronRight, Download, CheckCircle2, Clock, Circle,
  AlertTriangle,
} from 'lucide-react';
import { exportCycleToCSV } from '../../utils/exportUtils';

type Filter = 'all' | 'active' | 'done';

// ─── 사이클별 통계 타입 ──────────────────────────────────────────────────────
interface CycleData {
  cycle: ReturnType<typeof useReviewStore>['cycles'][0];
  template: typeof MOCK_TEMPLATES[0] | undefined;
  total: number;
  submitted: number;
  inProgress: number;
  pct: number;
  isDone: boolean;
  isActive: boolean;
  firstMemberId: string;
}

// ─── 상태 표시 컴포넌트 ──────────────────────────────────────────────────────
function StatusDot({ submitted, total, isClosed }: { submitted: number; total: number; isClosed: boolean }) {
  if (isClosed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        <Circle className="w-3.5 h-3.5" /> 종료
      </span>
    );
  }
  if (total > 0 && submitted === total) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> 평가 완료
      </span>
    );
  }
  if (submitted > 0) {
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

// ─── 테이블 헤더 ─────────────────────────────────────────────────────────────
function SectionHeader() {
  return (
    <div className="hidden md:flex items-center gap-5 px-5 py-2.5 border-b border-neutral-100 bg-neutral-50/50">
      <div className="flex-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">리뷰</div>
      <div className="w-32 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">진행도</div>
      <div className="w-28 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">마감</div>
      <div className="w-24 text-right text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">상태</div>
      <div className="w-24" />
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function TeamReviewList() {
  const [filter, setFilter] = useState<Filter>('all');
  const { currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';
  const { cycles, submissions } = useReviewStore();
  const navigate = useNavigate();

  // 관리자: 전체 팀원, 매니저: 직속 팀원
  const teamMembers = isAdmin
    ? MOCK_USERS.filter(u => u.role === 'employee')
    : MOCK_USERS.filter(u => u.managerId === currentUser?.id);

  if (!isAdmin && teamMembers.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-neutral-900">팀원 평가</h1>
        <EmptyState
          icon={Users}
          title="등록된 팀원이 없습니다."
          description="귀하를 관리자로 지정한 팀원이 없습니다."
        />
      </div>
    );
  }

  // 관련 사이클 계산 (draft 제외)
  const cycleData: CycleData[] = cycles
    .filter(c => {
      if (c.status === 'draft') return false;
      if (isAdmin) return true;
      return (
        c.targetDepartments.includes(currentUser?.department ?? '') ||
        teamMembers.some(m => c.targetDepartments.includes(m.department))
      );
    })
    .map(cycle => {
      const template = MOCK_TEMPLATES.find(t => t.id === cycle.templateId);

      const stats = teamMembers.map(member => {
        const reviewerId = isAdmin
          ? (member.managerId ?? '')
          : (currentUser?.id ?? '');
        const selfSub = submissions.find(
          s => s.cycleId === cycle.id && s.reviewerId === member.id
            && s.revieweeId === member.id && s.type === 'self'
        );
        const mgrSub = submissions.find(
          s => s.cycleId === cycle.id && s.reviewerId === reviewerId
            && s.revieweeId === member.id && s.type === 'downward'
        );
        const selfDone = selfSub?.status === 'submitted';
        const mgrStatus = selfDone ? (mgrSub?.status ?? 'not_started') : 'locked';
        return mgrStatus;
      });

      const total      = stats.length;
      const submitted  = stats.filter(s => s === 'submitted').length;
      const inProgress = stats.filter(s => s === 'in_progress').length;
      const pct        = total > 0 ? Math.round((submitted / total) * 100) : 0;
      const isClosed   = cycle.status === 'closed';
      const isDone     = isClosed || (total > 0 && submitted === total);
      const isActive   = !isDone && ['self_review', 'manager_review', 'active', 'calibration'].includes(cycle.status);
      const firstMemberId = teamMembers[0]?.id ?? '';

      return { cycle, template, total, submitted, inProgress, pct, isDone, isActive, firstMemberId };
    });

  const active = cycleData.filter(d => d.isActive);
  const done   = cycleData.filter(d => d.isDone);

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: 'all',    label: '전체',    count: cycleData.length },
    { key: 'active', label: '진행 중', count: active.length },
    { key: 'done',   label: '완료',    count: done.length },
  ];

  const filtered = filter === 'active' ? active : filter === 'done' ? done : cycleData;

  // ─── 행 컴포넌트 ────────────────────────────────────────────────────────────
  const CycleRow = ({ data }: { data: CycleData }) => {
    const { cycle, template, total, submitted, inProgress, pct, firstMemberId } = data;
    const urgent      = isUrgent(cycle.managerReviewDeadline);
    const isClosed    = cycle.status === 'closed';
    const allDone     = total > 0 && submitted === total;
    const isCompleted = isClosed || allDone;
    const notStarted  = total - submitted - inProgress;

    return (
      <div
        onClick={() => navigate(`/reviews/team/${cycle.id}/${firstMemberId}`)}
        className={`
          group cursor-pointer transition-colors
          border-b border-neutral-100 last:border-0
          ${urgent && !isCompleted ? 'bg-primary-50/40 hover:bg-primary-50/70' : 'hover:bg-neutral-50/70'}
        `}
      >
        {/* ── 모바일 ── */}
        <div className="flex md:hidden items-start gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {urgent && !isCompleted && (
                <AlertTriangle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              )}
              <p className={`text-sm font-semibold truncate group-hover:text-primary-700 ${
                urgent && !isCompleted ? 'text-primary-700' : 'text-neutral-900'
              }`}>
                {cycle.title}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <StatusDot submitted={submitted} total={total} isClosed={isClosed} />
              {cycle && (
                <p className={`text-xs ${urgent && !isCompleted ? 'text-primary-600 font-medium' : 'text-neutral-400'}`}>
                  {deadlineLabel(cycle.managerReviewDeadline)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {total}명
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="w-3 h-3" /> {submitted}
              </span>
              {inProgress > 0 && (
                <span className="flex items-center gap-1 text-primary-600">
                  <Clock className="w-3 h-3" /> {inProgress}
                </span>
              )}
              {notStarted > 0 && (
                <span className="flex items-center gap-1">
                  <Circle className="w-3 h-3" /> {notStarted}
                </span>
              )}
            </div>
            {!isCompleted && (
              <div className="mt-2">
                <ProgressBar value={pct} max={100} size="sm" />
              </div>
            )}
          </div>
          <span className={`
            flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold mt-0.5
            ${isCompleted
              ? 'text-neutral-400'
              : urgent
                ? 'bg-primary-500 text-white'
                : 'bg-primary-600 text-white'}
          `}>
            {isCompleted ? '결과 보기' : submitted === 0 ? '시작' : '계속'}
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* ── 데스크톱 ── */}
        <div className="hidden md:flex items-center gap-5 px-5 py-4">
          {/* 리뷰명 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {urgent && !isCompleted && (
                <AlertTriangle className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              )}
              <p className={`text-sm font-semibold truncate group-hover:text-primary-700 ${
                urgent && !isCompleted ? 'text-primary-700' : 'text-neutral-900'
              }`}>
                {cycle.title}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-400">
              <span>{cycle.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰'}</span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {total}명
              </span>
              {inProgress > 0 && (
                <span className="flex items-center gap-1 text-primary-500">
                  <Clock className="w-3 h-3" /> 작성 중 {inProgress}
                </span>
              )}
            </div>
          </div>

          {/* 진행도 */}
          <div className="w-32 flex-shrink-0">
            {!isCompleted ? (
              <div>
                <ProgressBar value={pct} max={100} size="sm" />
                <p className="text-[11px] text-neutral-400 mt-1">
                  {submitted}/{total} 완료
                </p>
              </div>
            ) : (
              <div className="h-1.5 rounded-full bg-emerald-200" />
            )}
          </div>

          {/* 마감일 */}
          <div className="w-28 flex-shrink-0 text-right">
            <p className={`text-xs font-medium ${urgent && !isCompleted ? 'text-primary-600' : 'text-neutral-600'}`}>
              {deadlineLabel(cycle.managerReviewDeadline)}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{formatDate(cycle.managerReviewDeadline)}</p>
          </div>

          {/* 상태 */}
          <div className="w-24 flex-shrink-0 flex justify-end">
            <StatusDot submitted={submitted} total={total} isClosed={isClosed} />
          </div>

          {/* CTA */}
          <div className="flex-shrink-0 w-24 flex justify-end items-center gap-2">
            {isAdmin && template && (
              <button
                onClick={e => { e.stopPropagation(); exportCycleToCSV(cycle, template, submissions, MOCK_USERS); }}
                title="엑셀 다운로드"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            {!isCompleted ? (
              <span className={`
                inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${urgent
                  ? 'bg-primary-500 text-white group-hover:bg-primary-600'
                  : 'bg-primary-600 text-white group-hover:bg-primary-700'}
              `}>
                {submitted === 0 ? '시작하기' : '이어서 작성'}
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

  const isEmpty = filtered.length === 0;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-900">팀원 평가</h1>

      {/* 필터 탭 */}
      {cycleData.length > 0 && (
        <div className="flex items-center gap-1 bg-white rounded-xl border border-neutral-200 shadow-card p-1 w-fit">
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
      )}

      {/* 빈 상태 */}
      {isEmpty ? (
        <EmptyState
          icon={Users}
          title={
            filter === 'active' ? '진행 중인 팀원 평가가 없습니다.' :
            filter === 'done'   ? '완료한 팀원 평가가 없습니다.' :
            '진행 중인 팀원 평가가 없습니다.'
          }
          description={
            filter === 'all'
              ? '리뷰가 시작되면 여기에 표시됩니다.'
              : '다른 필터를 선택해 보세요.'
          }
        />
      ) : filter === 'all' ? (
        /* 전체: 진행 중 / 완료 섹션 분리 */
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 px-1">진행 중</p>
              <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
                <SectionHeader />
                {active.map(d => <CycleRow key={d.cycle.id} data={d} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 px-1">완료</p>
              <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
                <SectionHeader />
                {done.map(d => <CycleRow key={d.cycle.id} data={d} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        /* 단독 필터 */
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
          <SectionHeader />
          {filtered.map(d => <CycleRow key={d.cycle.id} data={d} />)}
        </div>
      )}
    </div>
  );
}
