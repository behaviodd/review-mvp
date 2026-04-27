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

const tooltipStyle = { borderRadius: '8px', border: '1px solid #c4cdd4', fontSize: 12, color: '#111417' };

function StatCard({ label, value, sub, icon: Icon, color, iconBg }: {
  label: string; value: string | number; sub?: string;
  icon: typeof MsAlertIcon; color: string; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-010 shadow-card p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-050 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <p className="text-2xl font-bold leading-none text-gray-099">{value}</p>
      {sub && <p className="text-xs text-gray-040 mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
import { AdminCycleWidget } from '../components/dashboard/AdminCycleWidget';
import { TodayPanel } from '../components/dashboard/TodayPanel';
import { PeerPickReminder } from '../components/review/PeerPickReminder';

function AdminDashboard() {
  const { cycles, submissions } = useReviewStore();
  const { users } = useTeamStore();
  const navigate = useNavigate();

  const activeCycles = cycles.filter(c => c.status !== 'draft' && c.status !== 'closed');

  const deptStats = useMemo(() => {
    const active = activeCycles[0];
    if (!active) return [];
    const activeUsers = users.filter(u => u.isActive !== false && u.role !== 'admin');
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
  useSetPageHeader('관리자 대시보드', headerActions);

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

  return (
    <div className="space-y-5 md:space-y-6">
      <TodayPanel variant="admin" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="진행 중인 리뷰" value={activeCycles.length} icon={MsClockIcon} color="text-pink-050" iconBg="bg-pink-005" />
        <StatCard label="전사 평균 완료율" value={`${avgCompletion}%`} sub="진행 중 리뷰 기준" icon={TrendingUp as typeof MsAlertIcon} color="text-green-060" iconBg="bg-green-005" />
        <StatCard label="제출 대기 인원" value={pendingCount} sub="명" icon={MsUsersIcon as typeof MsAlertIcon} color="text-gray-060" iconBg="bg-gray-010" />
        <StatCard label="이번 주 마감" value={urgentCount} sub="개 리뷰" icon={MsAlertIcon} color="text-pink-050" iconBg="bg-pink-005" />
      </div>

      <AdminCycleWidget />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-010 shadow-card p-5">
          <h2 className="text-sm font-semibold text-gray-080 mb-4">부서별 완료율</h2>
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

        <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
          <h2 className="text-sm font-semibold text-gray-080 mb-4">액션 필요</h2>
          <div className="space-y-3">
            {activeCycles.map(c => (
              <div key={c.id} className="p-3 bg-gray-005 rounded-lg border border-gray-010">
                <button
                  onClick={() => navigate(`/cycles/${c.id}`)}
                  className="text-xs font-medium text-gray-080 mb-1 line-clamp-1 hover:text-pink-050 hover:underline text-left w-full"
                >
                  {c.title}
                </button>
                <p className="text-xs text-gray-050 mb-2">완료율 {c.completionRate}% · {deadlineLabel(c.selfReviewDeadline)}</p>
                <ProgressBar value={c.completionRate} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-080">최근 활동</h2>
          <button onClick={() => navigate('/cycles')} className="text-xs text-pink-050 hover:text-pink-060 hover:underline">
            전체 보기
          </button>
        </div>
        {activityFeed.length === 0 ? (
          <p className="text-sm text-gray-040 py-2">아직 활동 이력이 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {activityFeed.map(item => (
              <div
                key={item.key}
                className="flex items-center gap-3 py-2 border-b border-gray-005 last:border-0 px-1"
              >
                <div className="w-1.5 h-1.5 bg-gray-030 rounded-full flex-shrink-0" />
                <p className="text-sm text-gray-070 flex-1">{item.text}</p>
                <span className="text-xs text-gray-040 flex-shrink-0 whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
      u.role !== 'admin' &&
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

  useSetPageHeader('조직장 대시보드');

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

  return (
    <div className="space-y-5 md:space-y-6">
      <TodayPanel variant="leader" />
      <PeerPickReminder />
      <div>
        <p className="text-xs font-semibold text-gray-050 uppercase tracking-wide mb-3">할 일</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mySelfs.some(s => s.status !== 'submitted') && (
            <button
              onClick={() => navigate('/reviews/me')}
              className="bg-white rounded-xl border border-gray-010 shadow-card p-4 text-left hover:shadow-card-hover transition-all group"
            >
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold mb-2 bg-pink-005 text-pink-060">
                자기평가
              </span>
              <p className="text-sm font-semibold text-gray-099 group-hover:text-pink-060 line-clamp-1">{activeCycle?.title}</p>
              {activeCycle && <p className={`text-xs mt-1 ${isUrgent(activeCycle.selfReviewDeadline) ? 'text-pink-050 font-medium' : 'text-gray-050'}`}>
                마감 {deadlineLabel(activeCycle.selfReviewDeadline)}
              </p>}
            </button>
          )}
          {myDownwards.some(s => s.status !== 'submitted') && (
            <button
              onClick={() => navigate('/reviews/team')}
              className="bg-white rounded-xl border border-gray-010 shadow-card p-4 text-left hover:shadow-card-hover transition-all group"
            >
              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold mb-2 bg-green-005 text-green-060">팀원 평가</span>
              <p className="text-sm font-semibold text-gray-099 group-hover:text-pink-060">
                {myDownwards.filter(s => s.status !== 'submitted').length}명 남음
              </p>
              {activeCycle && <p className="text-xs mt-1 text-gray-050">마감 {deadlineLabel(activeCycle.managerReviewDeadline)}</p>}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-080">팀원 리뷰 현황</h2>
          <button onClick={() => navigate('/reports')} className="text-xs text-pink-050 hover:text-pink-060 hover:underline">
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
                className="flex flex-col items-center p-3.5 bg-gray-005 rounded-lg hover:bg-pink-005 border border-transparent hover:border-pink-010 transition-all group"
              >
                <UserAvatar user={m} size="lg" />
                <p className="text-sm font-semibold text-gray-099 mt-2">{m.name}</p>
                <p className="text-xs text-gray-040 mb-2">{m.position}</p>
                <StatusBadge type="submission" value={status} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
        <h2 className="text-sm font-semibold text-gray-080 mb-4">팀 리뷰 완료율</h2>
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
              <span className="text-xs text-gray-050">{d.name} {d.value}명</span>
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

  useSetPageHeader(`안녕하세요, ${currentUser?.name}님 👋`);

  return (
    <div className="space-y-5 md:space-y-6">

      <PeerPickReminder />

      {activeCycle && mySelf && mySelf.status !== 'submitted' && (
        <div className="bg-white rounded-xl border border-pink-020 shadow-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-pink-050 mb-1">지금 진행 중</p>
              <h2 className="text-lg font-semibold text-gray-099 mb-3 truncate">{activeCycle.title}</h2>
              <div className="w-full sm:w-52">
                <ProgressBar value={mySelf.answers.length} max={6} showPercent />
                <p className="text-xs text-gray-040 mt-1">{mySelf.answers.length}/6 질문 완료 · 마감 {deadlineLabel(activeCycle.selfReviewDeadline)}</p>
              </div>
            </div>
            <MsButton onClick={() => navigate(`/reviews/me/${mySelf.id}`)} className="flex-shrink-0">
              {mySelf.status === 'not_started' ? '시작하기' : '이어서 작성'}
            </MsButton>
          </div>
        </div>
      )}

      {pastSubmissions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-080">리뷰 이력</h2>
            <button onClick={() => navigate('/reviews/me')} className="text-xs text-pink-050 hover:text-pink-060 hover:underline">
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
                  className="w-full flex items-center gap-4 py-2 border-b border-gray-005 last:border-0 hover:bg-gray-005 rounded-lg px-1 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-pink-005 flex items-center justify-center font-bold text-pink-060 flex-shrink-0 text-sm">{grade}</div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-080">{cycle?.title}</p>
                    <p className="text-xs text-gray-040">{s.submittedAt ? formatDate(s.submittedAt) : ''}</p>
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
