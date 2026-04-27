import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import type { ReviewTemplate } from '../../types';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { deadlineLabel, formatDate, isUrgent } from '../../utils/dateUtils';
import { Users, Circle } from 'lucide-react';
import { MsChevronRightLineIcon, MsDownloadIcon, MsCheckCircleIcon, MsClockIcon, MsWarningIcon } from '../../components/ui/MsIcons';
import { exportCycleToCSV } from '../../utils/exportUtils';
import type { ReviewCycle } from '../../types';

type StatusFilter = 'all' | 'active' | 'done' | 'closed';
type TypeFilter   = 'all' | 'scheduled' | 'adhoc';

// ─── 사이클별 통계 타입 ──────────────────────────────────────────────────────
interface CycleData {
  cycle: ReviewCycle;
  template: ReviewTemplate | undefined;
  total: number;
  submitted: number;
  inProgress: number;
  pct: number;
  isDone: boolean;
  isActive: boolean;
  isClosed: boolean;
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
        <MsCheckCircleIcon size={12} /> 평가 완료
      </span>
    );
  }
  if (submitted > 0) {
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

// ─── 테이블 헤더 ─────────────────────────────────────────────────────────────
function SectionHeader() {
  return (
    <div className="hidden md:flex items-center gap-5 px-5 py-2.5 border-b border-gray-010 bg-gray-005/50">
      <div className="flex-1 text-xs font-semibold text-gray-040 uppercase tracking-wide">리뷰</div>
      <div className="w-32 text-xs font-semibold text-gray-040 uppercase tracking-wide">진행도</div>
      <div className="w-28 text-right text-xs font-semibold text-gray-040 uppercase tracking-wide">마감</div>
      <div className="w-24 text-right text-xs font-semibold text-gray-040 uppercase tracking-wide">상태</div>
      <div className="w-24" />
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function TeamReviewList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all');
  const { currentUser } = useAuthStore();
  useSetPageHeader('하향 평가');
  const isAdmin = currentUser?.role === 'admin';
  const { cycles, submissions, templates } = useReviewStore();
  const { users, orgUnits } = useTeamStore();
  const navigate = useNavigate();

  // 조직장의 팀원 계산
  // - admin: admin을 제외한 모든 구성원
  // - leader: ① managerId로 지정된 구성원 + ② headId 기반 조직 소속 구성원 (OR)
  const teamMembers = useMemo(() => {
    if (isAdmin) return users.filter(u => u.role !== 'admin');

    const byManagerId = new Set(
      users.filter(u => u.managerId === currentUser?.id).map(u => u.id)
    );
    const headOrgNames = new Set(
      orgUnits.filter(o => o.headId === currentUser?.id).map(o => o.name)
    );

    return users.filter(u =>
      u.id !== currentUser?.id &&
      u.role !== 'admin' &&
      (
        byManagerId.has(u.id) ||
        headOrgNames.has(u.department) ||
        headOrgNames.has(u.subOrg  ?? '__') ||
        headOrgNames.has(u.team    ?? '__') ||
        headOrgNames.has(u.squad   ?? '__')
      )
    );
  }, [isAdmin, users, orgUnits, currentUser?.id]);

  if (!isAdmin && teamMembers.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-gray-099">하향 평가</h1>
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
      const template = templates.find(t => t.id === cycle.templateId);

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

      return { cycle, template, total, submitted, inProgress, pct, isDone, isActive, isClosed, firstMemberId };
    });

  // 유형 필터 적용
  const byType = typeFilter === 'all'
    ? cycleData
    : cycleData.filter(d => d.cycle.type === typeFilter);

  const active = byType.filter(d => d.isActive);
  const done   = byType.filter(d => d.isDone && !d.isClosed);
  const closed = byType.filter(d => d.isClosed);

  const tabs = [
    { value: 'all'    as StatusFilter, label: '전체',    count: byType.length },
    { value: 'active' as StatusFilter, label: '진행 중', count: active.length },
    { value: 'done'   as StatusFilter, label: '완료',    count: done.length },
    { value: 'closed' as StatusFilter, label: '종료됨',  count: closed.length },
  ];

  const filtered =
    statusFilter === 'active' ? active :
    statusFilter === 'done'   ? done   :
    statusFilter === 'closed' ? closed :
    byType;

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
          border-b border-gray-010 last:border-0
          ${urgent && !isCompleted ? 'bg-pink-005/40 hover:bg-pink-005/70' : 'hover:bg-gray-005/70'}
        `}
      >
        {/* ── 모바일 ── */}
        <div className="flex md:hidden items-start gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {urgent && !isCompleted && (
                <MsWarningIcon size={12} className="text-pink-040 flex-shrink-0" />
              )}
              <p className={`text-sm font-semibold truncate group-hover:text-pink-060 ${
                urgent && !isCompleted ? 'text-pink-060' : 'text-gray-099'
              }`}>
                {cycle.title}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <StatusDot submitted={submitted} total={total} isClosed={isClosed} />
              {cycle && (
                <p className={`text-xs ${urgent && !isCompleted ? 'text-pink-050 font-medium' : 'text-gray-040'}`}>
                  {deadlineLabel(cycle.managerReviewDeadline)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-040">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {total}명
              </span>
              <span className="flex items-center gap-1 text-emerald-600">
                <MsCheckCircleIcon size={12} /> {submitted}
              </span>
              {inProgress > 0 && (
                <span className="flex items-center gap-1 text-pink-050">
                  <MsClockIcon size={12} /> {inProgress}
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
              ? 'text-gray-040'
              : urgent
                ? 'bg-pink-040 text-white'
                : 'bg-pink-050 text-white'}
          `}>
            {isCompleted ? '결과 보기' : submitted === 0 ? '시작' : '계속'}
            <MsChevronRightLineIcon size={12} />
          </span>
        </div>

        {/* ── 데스크톱 ── */}
        <div className="hidden md:flex items-center gap-5 px-5 py-4">
          {/* 리뷰명 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {urgent && !isCompleted && (
                <MsWarningIcon size={12} className="text-pink-040 flex-shrink-0" />
              )}
              <p className={`text-sm font-semibold truncate group-hover:text-pink-060 ${
                urgent && !isCompleted ? 'text-pink-060' : 'text-gray-099'
              }`}>
                {cycle.title}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-040">
              <span>{cycle.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰'}</span>
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {total}명
              </span>
              {inProgress > 0 && (
                <span className="flex items-center gap-1 text-pink-040">
                  <MsClockIcon size={12} /> 작성 중 {inProgress}
                </span>
              )}
            </div>
          </div>

          {/* 진행도 */}
          <div className="w-32 flex-shrink-0">
            {!isCompleted ? (
              <div>
                <ProgressBar value={pct} max={100} size="sm" />
                <p className="text-xs text-gray-040 mt-1">
                  {submitted}/{total} 완료
                </p>
              </div>
            ) : (
              <div className="h-1.5 rounded-full bg-emerald-200" />
            )}
          </div>

          {/* 마감일 */}
          <div className="w-28 flex-shrink-0 text-right">
            <p className={`text-xs font-medium ${urgent && !isCompleted ? 'text-pink-050' : 'text-gray-060'}`}>
              {deadlineLabel(cycle.managerReviewDeadline)}
            </p>
            <p className="text-xs text-gray-040 mt-0.5">{formatDate(cycle.managerReviewDeadline)}</p>
          </div>

          {/* 상태 */}
          <div className="w-24 flex-shrink-0 flex justify-end">
            <StatusDot submitted={submitted} total={total} isClosed={isClosed} />
          </div>

          {/* CTA */}
          <div className="flex-shrink-0 w-24 flex justify-end items-center gap-2">
            {isAdmin && template && (
              <button
                onClick={e => { e.stopPropagation(); exportCycleToCSV(cycle, template, submissions, users); }}
                title="엑셀 다운로드"
                className="p-1.5 text-gray-040 hover:text-gray-070 hover:bg-gray-010 rounded-lg transition-colors"
              >
                <MsDownloadIcon size={12} />
              </button>
            )}
            {!isCompleted ? (
              <span className={`
                inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                ${urgent
                  ? 'bg-pink-040 text-white group-hover:bg-pink-050'
                  : 'bg-pink-050 text-white group-hover:bg-pink-060'}
              `}>
                {submitted === 0 ? '시작하기' : '이어서 작성'}
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

  const isEmpty = filtered.length === 0;

  return (
    <div className="space-y-5">
      {cycleData.length > 0 && (
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
      )}

      {/* 빈 상태 */}
      {isEmpty ? (
        <EmptyState
          icon={Users}
          title={
            statusFilter === 'active' ? '진행 중인 팀원 평가가 없습니다.' :
            statusFilter === 'done'   ? '완료한 팀원 평가가 없습니다.' :
            statusFilter === 'closed' ? '종료된 팀원 평가가 없습니다.' :
            '진행 중인 팀원 평가가 없습니다.'
          }
          description={
            statusFilter === 'all'
              ? '리뷰가 시작되면 여기에 표시됩니다.'
              : '다른 필터를 선택해 보세요.'
          }
        />
      ) : statusFilter === 'all' ? (
        /* 전체: 진행 중 / 완료 / 종료됨 섹션 분리 */
        <>
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-040 uppercase tracking-wide mb-2 px-1">진행 중</p>
              <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
                <SectionHeader />
                {active.map(d => <CycleRow key={d.cycle.id} data={d} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-040 uppercase tracking-wide mb-2 px-1">완료</p>
              <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
                <SectionHeader />
                {done.map(d => <CycleRow key={d.cycle.id} data={d} />)}
              </div>
            </div>
          )}
          {closed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-040 uppercase tracking-wide mb-2 px-1">종료됨</p>
              <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
                <SectionHeader />
                {closed.map(d => <CycleRow key={d.cycle.id} data={d} />)}
              </div>
            </div>
          )}
        </>
      ) : (
        /* 단독 필터 */
        <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
          <SectionHeader />
          {filtered.map(d => <CycleRow key={d.cycle.id} data={d} />)}
        </div>
      )}
    </div>
  );
}
