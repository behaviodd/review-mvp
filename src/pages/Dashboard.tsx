import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { useReviewStore } from '../stores/reviewStore';
import { useTeamStore } from '../stores/teamStore';
import { timeAgo } from '../utils/dateUtils';

const GRADE_FROM_RATING = (r: number) => r >= 4.5 ? 'S' : r >= 3.5 ? 'A' : r >= 2.5 ? 'B' : r >= 1.5 ? 'C' : 'D';
import { StatusBadge } from '../components/ui/StatusBadge';
import { UserAvatar } from '../components/ui/UserAvatar';
import { ProgressBar } from '../components/ui/ProgressBar';
import { deadlineLabel, formatDate, isUrgent } from '../utils/dateUtils';
import { TrendingUp } from 'lucide-react';
import { MsAlertIcon, MsClockIcon, MsPlusIcon, MsUsersIcon } from '../components/ui/MsIcons';
import { MsButton } from '../components/ui/MsButton';
import { useShowToast } from '../components/ui/Toast';
import type { User } from '../types';

const tooltipStyle = { borderRadius: '8px', border: '1px solid #c4cdd4', fontSize: 12, color: '#111417' };

/**
 * Phase D-3.A: 카드 컨테이너 제거 — 평면 + 부모 grid 의 divide-x 로 line 구분
 * (사용자 명시: "모든 카드 평면화 + line으로 구분")
 */
function StatCard({ label, value, sub, icon: Icon, color, iconBg }: {
  label: string; value: string | number; sub?: string;
  icon: typeof MsAlertIcon; color: string; iconBg: string;
}) {
  return (
    <div className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-fg-subtle uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <p className="text-2xl font-bold leading-none text-fg-default">{value}</p>
      {sub && <p className="text-xs text-fg-subtlest mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
import { AdminCycleWidget } from '../components/dashboard/AdminCycleWidget';
import { TodayPanel } from '../components/dashboard/TodayPanel';
import { PeerPickReminder } from '../components/review/PeerPickReminder';

function AdminDashboard() {
  const { cycles, submissions } = useReviewStore();
  const { users, orgUnits } = useTeamStore();
  const startImpersonation = useAuthStore(s => s.startImpersonation);
  const showToast = useShowToast();
  const navigate = useNavigate();

  // Dev 도구: 디자인 센터 하위 조직 멤버 list. import.meta.env.DEV 일 때만 노출.
  const designCenterMembers = useMemo(() => {
    if (!import.meta.env.DEV) return [] as User[];
    const center = orgUnits.find(o => o.name.replace(/\s+/g, '') === '디자인센터');
    if (!center) return [] as User[];
    const subOrgIds = new Set<string>();
    const collect = (parentId: string) => {
      orgUnits.filter(o => o.parentId === parentId).forEach(child => {
        subOrgIds.add(child.id);
        collect(child.id);
      });
    };
    collect(center.id);
    return users.filter(u => u.orgUnitId && subOrgIds.has(u.orgUnitId));
  }, [orgUnits, users]);

  const handleImpersonateTest = (target: User) => {
    const log = startImpersonation(target);
    if (!log) { showToast('error', '마스터 로그인을 시작할 수 없습니다.'); return; }
    showToast('success', `${target.name}(으)로 접속했습니다. 리뷰 작성은 빙의 대상 명의로 기록됩니다.`);
    navigate('/');
  };

  const activeCycles = cycles.filter(c => c.status !== 'draft' && c.status !== 'closed');

  const deptStats = useMemo(() => {
    const active = activeCycles[0];
    if (!active) return [];
    const activeUsers = users.filter(u => u.isActive !== false);
    const depts = Array.from(new Set(activeUsers.map(u => u.department))).filter(Boolean);
    return depts.map(dept => {
      const members = activeUsers.filter(u => u.department === dept);
      const submitted = members.filter(u =>
        submissions.some(s => s.cycleId === active.id && s.revieweeId === u.id && s.type === 'self' && s.status === 'submitted')
      ).length;
      return { department: dept, completionRate: members.length ? Math.round(submitted / members.length * 100) : 0 };
    });
  }, [activeCycles, submissions, users]);
  const avgCompletion = Math.round(activeCycles.reduce((s, c) => s + c.completionRate, 0) / (activeCycles.length || 1));
  const pendingCount = submissions.filter(s => s.status === 'not_started').length;
  const urgentCount = activeCycles.filter(c => isUrgent(c.selfReviewDeadline)).length;

  // DS: green-060 / blue-060 / red-050
  const barColor = (rate: number) => rate >= 80 ? '#20903c' : rate >= 50 ? '#1482b8' : '#e61919';

  const headerActions = useMemo(() => (
    <MsButton onClick={() => navigate('/cycles/new')} leftIcon={<MsPlusIcon size={16} />}>새 리뷰 생성</MsButton>
  ), [navigate]);
  useSetPageHeader('홈', headerActions, { subtitle: '관리자 대시보드' });

  const activityFeed = useMemo(() => {
    type Event = { key: string; text: string; time: string; timestamp: string };
    const events: Event[] = [];

    for (const s of submissions) {
      const reviewee = users.find(u => u.id === s.revieweeId);
      const reviewer = users.find(u => u.id === s.reviewerId);
      if (!reviewee) continue;

      if (s.status === 'submitted') {
        const ts = s.submittedAt ?? s.lastSavedAt;
        const text = s.type === 'self'
          ? `${reviewee.name}님이 자기평가를 제출했습니다.`
          : `${reviewer?.name ?? '조직장'}님이 ${reviewee.name}님 팀원 평가를 제출했습니다.`;
        events.push({ key: `${s.id}_sub`, text, time: timeAgo(ts), timestamp: ts });
      } else if (s.status === 'in_progress') {
        const ts = s.lastSavedAt;
        const text = s.type === 'self'
          ? `${reviewee.name}님이 자기평가를 작성 중입니다.`
          : `${reviewer?.name ?? '조직장'}님이 ${reviewee.name}님 팀원 평가를 작성 중입니다.`;
        events.push({ key: `${s.id}_prog`, text, time: timeAgo(ts), timestamp: ts });
      }
    }

    for (const c of cycles) {
      if (c.status !== 'draft') {
        events.push({
          key: `${c.id}_pub`,
          text: `"${c.title}" 리뷰가 발행되었습니다.`,
          time: timeAgo(c.createdAt),
          timestamp: c.createdAt,
        });
      }
    }

    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [submissions, users, cycles]);

  /* Phase D-3.A-fix3: full-bleed (FULL_BLEED_EXACT '/') 모드.
     페이지 자체 overflow-y-auto + px-6. 위 padding 없이 헤더 line 바로 아래
     TodayPanel 의 grid line 이 직접 닿음. 첫 horizontal border-t 제거 — 사용자 명시. */
  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 pt-6">
      <TodayPanel variant="admin" />

      {/* Stats — 첫 border-t 제거 (사용자 명시), mt-6 spacing 만. grid 안 md:divide-x 유지 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-bd-default">
        <StatCard label="진행 중인 리뷰" value={activeCycles.length} icon={MsClockIcon} color="text-pink-050" iconBg="bg-pink-005" />
        <StatCard label="전사 평균 완료율" value={`${avgCompletion}%`} sub="진행 중 리뷰 기준" icon={TrendingUp as typeof MsAlertIcon} color="text-green-060" iconBg="bg-green-005" />
        <StatCard label="제출 대기 인원" value={pendingCount} sub="명" icon={MsUsersIcon as typeof MsAlertIcon} color="text-gray-060" iconBg="bg-gray-010" />
        <StatCard label="이번 주 마감" value={urgentCount} sub="개 리뷰" icon={MsAlertIcon} color="text-pink-050" iconBg="bg-pink-005" />
      </div>

      <div className="border-t border-bd-default pt-6 mt-6">
        <AdminCycleWidget />
      </div>

      {/* 차트 + 액션 — md+ divide-x 가운데 line */}
      <div className="border-t border-bd-default pt-6 mt-6 grid grid-cols-1 lg:grid-cols-3 lg:divide-x lg:divide-bd-default">
        <div className="lg:col-span-2 lg:pr-6 pb-6 lg:pb-0">
          <h2 className="text-base font-semibold text-fg-default mb-4">부서별 완료율</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptStats} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e6ea" />
              <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#6d7f92' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6d7f92' }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, '완료율']} contentStyle={tooltipStyle} />
              <Bar dataKey="completionRate" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11, formatter: (v: unknown) => `${v}%` }}>
                {deptStats.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.completionRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:pl-6">
          <h2 className="text-base font-semibold text-fg-default mb-4">액션 필요</h2>
          <div className="space-y-3">
            {activeCycles.map(c => (
              <div key={c.id} className="p-3 rounded-lg border border-bd-default">
                <button
                  onClick={() => navigate(`/cycles/${c.id}`)}
                  className="text-xs font-medium text-fg-default mb-1 line-clamp-1 hover:text-fg-brand1 hover:underline text-left w-full"
                >
                  {c.title}
                </button>
                <p className="text-xs text-fg-subtle mb-2">완료율 {c.completionRate}% · {deadlineLabel(c.selfReviewDeadline)}</p>
                <ProgressBar value={c.completionRate} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-bd-default pt-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-fg-default">최근 활동</h2>
          <button onClick={() => navigate('/cycles')} className="text-xs text-fg-brand1 hover:text-fg-brand1-bolder hover:underline">
            전체 보기
          </button>
        </div>
        {activityFeed.length === 0 ? (
          <p className="text-base text-fg-subtlest py-2">아직 활동 이력이 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {activityFeed.map(item => (
              <div
                key={item.key}
                className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-interaction-hovered transition-colors"
              >
                <div className="w-1.5 h-1.5 bg-fg-subtlest rounded-full flex-shrink-0" />
                <p className="text-base text-fg-default flex-1">{item.text}</p>
                <span className="text-xs text-fg-subtlest flex-shrink-0 whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dev only: 테스트 계정 빙의 dropdown — production 빌드에선 import.meta.env.DEV=false 라 unmount */}
      {import.meta.env.DEV && designCenterMembers.length > 0 && (
        <div className="border-t border-bd-default py-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-orange-070 bg-orange-005 px-1.5 py-0.5 rounded uppercase tracking-wide">DEV</span>
            <h2 className="text-base font-semibold text-fg-default">테스트 계정으로 접속</h2>
          </div>
          <p className="text-xs text-fg-subtle mb-3">
            디자인 센터 하위 조직 멤버 — 빙의 후 그 사용자로서 리뷰 작성·제출이 가능합니다 (관리자 전용 라우트는 차단). 우상단 헤더에서 "원래 계정으로 복귀" 가능.
          </p>
          <select
            defaultValue=""
            onChange={(e) => {
              const target = designCenterMembers.find(u => u.id === e.target.value);
              if (target) handleImpersonateTest(target);
              e.target.value = '';
            }}
            className="w-full max-w-md h-10 px-3 text-base rounded-md border border-bd-default bg-surface-default text-fg-default focus:border-bd-focused focus:outline-none"
          >
            <option value="">선택…</option>
            {designCenterMembers.map(u => {
              const orgName = orgUnits.find(o => o.id === u.orgUnitId)?.name ?? '-';
              return (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.position} · {orgName} ({u.id})
                </option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}

// Manager Dashboard
function ManagerDashboard() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const { users, orgUnits } = useTeamStore();
  const navigate = useNavigate();

  const teamMembers = useMemo(() => {
    const byManagerId = new Set(
      users.filter(u => u.managerId === currentUser?.id && u.isActive !== false).map(u => u.id)
    );
    const headOrgNames = new Set(
      orgUnits.filter(o => o.headId === currentUser?.id).map(o => o.name)
    );
    return users.filter(u =>
      u.isActive !== false &&
      u.id !== currentUser?.id &&
      (byManagerId.has(u.id) ||
       headOrgNames.has(u.department) ||
       headOrgNames.has(u.subOrg  ?? '__') ||
       headOrgNames.has(u.team    ?? '__') ||
       headOrgNames.has(u.squad   ?? '__'))
    );
  }, [users, orgUnits, currentUser?.id]);
  const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');

  const mySelfs = submissions.filter(s => s.reviewerId === currentUser?.id && s.type === 'self');
  const myDownwards = submissions.filter(s => s.reviewerId === currentUser?.id && s.type === 'downward');

  useSetPageHeader('홈', undefined, { subtitle: '조직장 대시보드' });

  const getMemberStatus = (memberId: string) => {
    const sub = submissions.find(s => s.reviewerId === currentUser?.id && s.revieweeId === memberId && s.type === 'downward' && s.cycleId === activeCycle?.id);
    return sub?.status || 'not_started';
  };

  // DS: green-060 / blue-060 / gray-020
  const pieData = [
    { name: '제출 완료', value: myDownwards.filter(s => s.status === 'submitted').length, color: '#20903c' },
    { name: '작성 중',  value: myDownwards.filter(s => s.status === 'in_progress').length, color: '#1482b8' },
    { name: '미작성',   value: myDownwards.filter(s => s.status === 'not_started').length, color: '#c4cdd4' },
  ];

  /* Phase D-3.A-fix3: full-bleed + 첫 border-t 제거 */
  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 pt-6">
      <TodayPanel variant="leader" />
      <div className="mt-6">
        <PeerPickReminder />
      </div>
      <div className="border-t border-bd-default pt-6 mt-6">
        <p className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-3">할 일</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mySelfs.some(s => s.status !== 'submitted') && (
            <button
              onClick={() => navigate('/reviews/me')}
              className="p-4 rounded-lg border border-bd-default text-left hover:bg-interaction-hovered transition-colors group"
            >
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold mb-2 bg-pink-005 text-pink-060">
                자기평가
              </span>
              <p className="text-base font-semibold text-fg-default group-hover:text-fg-brand1 line-clamp-1">{activeCycle?.title}</p>
              {activeCycle && <p className={`text-xs mt-1 ${isUrgent(activeCycle.selfReviewDeadline) ? 'text-fg-brand1 font-medium' : 'text-fg-subtle'}`}>
                마감 {deadlineLabel(activeCycle.selfReviewDeadline)}
              </p>}
            </button>
          )}
          {myDownwards.some(s => s.status !== 'submitted') && (
            <button
              onClick={() => navigate('/reviews/team')}
              className="p-4 rounded-lg border border-bd-default text-left hover:bg-interaction-hovered transition-colors group"
            >
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold mb-2 bg-green-005 text-green-060">팀원 평가</span>
              <p className="text-base font-semibold text-fg-default group-hover:text-fg-brand1">
                {myDownwards.filter(s => s.status !== 'submitted').length}명 남음
              </p>
              {activeCycle && <p className="text-xs mt-1 text-fg-subtle">마감 {deadlineLabel(activeCycle.managerReviewDeadline)}</p>}
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-bd-default pt-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-fg-default">팀원 리뷰 현황</h2>
          <button onClick={() => navigate('/reports')} className="text-xs text-fg-brand1 hover:text-fg-brand1-bolder hover:underline">
            리포트 보기
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {teamMembers.map(m => {
            const status = getMemberStatus(m.id);
            return (
              <button
                key={m.id}
                onClick={() => activeCycle && navigate(`/reviews/team/${activeCycle.id}/${m.id}`)}
                className="flex flex-col items-center p-3.5 rounded-lg border border-bd-default hover:bg-interaction-hovered transition-colors group"
              >
                <UserAvatar user={m} size="lg" />
                <p className="text-base font-semibold text-fg-default mt-2">{m.name}</p>
                <p className="text-xs text-fg-subtle mb-2">{m.position}</p>
                <StatusBadge type="submission" value={status} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-bd-default pt-6 mt-6">
        <h2 className="text-base font-semibold text-fg-default mb-4">팀 리뷰 완료율</h2>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(v) => [`${v}명`, '']} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex gap-3 justify-center mt-2 flex-wrap">
          {pieData.map(d => (
            <div key={d.name} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-fg-subtle">{d.name} {d.value}명</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Employee Dashboard
function EmployeeDashboard() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const navigate = useNavigate();

  const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');
  const mySelf = submissions.find(s => s.reviewerId === currentUser?.id && s.type === 'self' && s.cycleId === activeCycle?.id);
  const pastSubmissions = submissions.filter(s => s.reviewerId === currentUser?.id && s.type === 'self' && s.status === 'submitted');

  useSetPageHeader('홈', undefined, { subtitle: `안녕하세요, ${currentUser?.name}님 👋` });

  /* Phase D-3.A-fix3: full-bleed + 첫 padding/border-t 제거 — 헤더 line 과 직접 닿음 */
  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 pt-6">
      <PeerPickReminder />

      {activeCycle && mySelf && mySelf.status !== 'submitted' && (
        <div className="mt-6">
          <div className="border-l-4 border-fg-brand1 pl-5 py-1">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-fg-brand1 mb-1">지금 진행 중</p>
                <h2 className="text-lg font-semibold text-fg-default mb-3 truncate">{activeCycle.title}</h2>
                <div className="w-full sm:w-52">
                  <ProgressBar value={mySelf.answers.length} max={6} showPercent />
                  <p className="text-xs text-fg-subtle mt-1">{mySelf.answers.length}/6 질문 완료 · 마감 {deadlineLabel(activeCycle.selfReviewDeadline)}</p>
                </div>
              </div>
              <MsButton onClick={() => navigate(`/reviews/me/${mySelf.id}`)} className="flex-shrink-0">
                {mySelf.status === 'not_started' ? '시작하기' : '이어서 작성'}
              </MsButton>
            </div>
          </div>
        </div>
      )}

      {pastSubmissions.length > 0 && (
        <div className="border-t border-bd-default pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-fg-default">리뷰 이력</h2>
            <button onClick={() => navigate('/reviews/me')} className="text-xs text-fg-brand1 hover:text-fg-brand1-bolder hover:underline">
              전체 보기
            </button>
          </div>
          <div className="space-y-1">
            {pastSubmissions.map(s => {
              const cycle = cycles.find(c => c.id === s.cycleId);
              const grade = s.overallRating ? GRADE_FROM_RATING(s.overallRating) : '-';
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/reviews/me/${s.id}`)}
                  className="w-full flex items-center gap-4 py-2 hover:bg-interaction-hovered rounded-lg px-1 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-pink-005 flex items-center justify-center font-bold text-pink-060 flex-shrink-0 text-base">{grade}</div>
                  <div className="flex-1 text-left">
                    <p className="text-base font-medium text-fg-default">{cycle?.title}</p>
                    <p className="text-xs text-fg-subtlest">{s.submittedAt ? formatDate(s.submittedAt) : ''}</p>
                  </div>
                  <StatusBadge type="submission" value={s.status} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const { currentUser } = useAuthStore();
  if (!currentUser) return null;
  if (currentUser.role === 'admin') return <AdminDashboard />;
  if (currentUser.role === 'leader') return <ManagerDashboard />;
  return <EmployeeDashboard />;
}
