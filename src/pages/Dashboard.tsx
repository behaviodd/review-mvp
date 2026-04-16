import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useAuthStore } from '../stores/authStore';
import { useReviewStore } from '../stores/reviewStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { MOCK_USERS, DEPARTMENT_STATS, GRADE_FROM_RATING } from '../data/mockData';
import { StatusBadge } from '../components/ui/StatusBadge';
import { UserAvatar } from '../components/ui/UserAvatar';
import { ProgressBar } from '../components/ui/ProgressBar';
import { deadlineLabel, formatDate, isUrgent } from '../utils/dateUtils';
import { AlertCircle, Users, TrendingUp, Clock, Plus, Bell, ChevronDown, ChevronRight } from 'lucide-react';
import { useNotificationStore } from '../stores/notificationStore';
import { useShowToast } from '../components/ui/Toast';
import { OrgReviewPanel } from '../components/common/OrgReviewPanel';

function StatCard({ label, value, sub, icon: Icon, color, iconBg }: {
  label: string; value: string | number; sub?: string;
  icon: typeof AlertCircle; color: string; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon size={15} className={color} />
        </div>
      </div>
      <p className={`text-2xl font-bold leading-none text-neutral-900`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1.5">{sub}</p>}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const { cycles, submissions } = useReviewStore();
  const { addNotification } = useNotificationStore();
  const showToast = useShowToast();
  const navigate = useNavigate();

  const activeCycles = cycles.filter(c => c.status !== 'draft' && c.status !== 'closed');
  const avgCompletion = Math.round(activeCycles.reduce((s, c) => s + c.completionRate, 0) / (activeCycles.length || 1));
  const pendingCount = submissions.filter(s => s.status === 'not_started').length;
  const urgentCount = activeCycles.filter(c => isUrgent(c.selfReviewDeadline)).length;

  const barColor = (rate: number) => rate >= 80 ? '#059669' : rate >= 50 ? '#4f46e5' : '#e11d48';

  const handleNudge = (cycleId: string) => {
    const cycle = cycles.find(c => c.id === cycleId);
    const pending = submissions.filter(s => s.cycleId === cycleId && s.status === 'not_started');
    pending.forEach((s, i) => {
      addNotification({
        id: `nudge_${Date.now()}_${i}_${s.revieweeId}`,
        userId: s.revieweeId,
        title: '리뷰 작성 독촉',
        message: `${cycle?.title} 마감이 다가오고 있습니다. 지금 바로 작성해 주세요!`,
        type: 'nudge',
        isRead: false,
        createdAt: new Date().toISOString(),
        actionUrl: `/reviews/me/${s.id}`,
      });
    });
    showToast(`${pending.length}명에게 독촉 알림을 발송했습니다.`, 'success');
  };

  const activityFeed = [
    { text: '최백엔드님이 셀프 리뷰를 제출했습니다.', time: '오늘 11:00' },
    { text: '오UX님이 셀프 리뷰를 제출했습니다.', time: '어제 16:30' },
    { text: '이개발님이 팀원 리뷰를 시작했습니다.', time: '어제 10:00' },
    { text: '김관리님이 2025년 상반기 리뷰를 배포했습니다.', time: '7월 1일' },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">관리자 대시보드</h1>
        <button onClick={() => navigate('/cycles/new')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded hover:bg-primary-700 transition-colors">
          <Plus className="w-4 h-4" /> 새 리뷰 생성
        </button>
      </div>

      {/* 통계 카드 — 모바일 2열, 데스크톱 4열 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="진행 중인 리뷰" value={activeCycles.length} icon={Clock} color="text-primary-600" iconBg="bg-primary-50" />
        <StatCard label="전사 평균 완료율" value={`${avgCompletion}%`} sub="진행 중 리뷰 기준" icon={TrendingUp} color="text-success-600" iconBg="bg-success-50" />
        <StatCard label="제출 대기 인원" value={pendingCount} sub="명" icon={Users} color="text-neutral-600" iconBg="bg-neutral-100" />
        <StatCard label="이번 주 마감" value={urgentCount} sub="개 리뷰" icon={AlertCircle} color="text-primary-600" iconBg="bg-primary-50" />
      </div>

      {/* 차트 섹션 — 모바일 1열, 데스크톱 3열 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 shadow-card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-4">부서별 완료율</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DEPARTMENT_STATS} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="department" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, '완료율']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a' }} />
              <Bar dataKey="completionRate" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11, formatter: (v: number) => `${v}%` }}>
                {DEPARTMENT_STATS.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.completionRate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-4">액션 필요</h2>
          <div className="space-y-3">
            {activeCycles.map(c => (
              <div key={c.id} className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                <button
                  onClick={() => navigate(`/cycles/${c.id}`)}
                  className="text-xs font-medium text-neutral-800 mb-1 line-clamp-1 hover:text-primary-600 hover:underline text-left w-full"
                >
                  {c.title}
                </button>
                <p className="text-xs text-neutral-500 mb-2">완료율 {c.completionRate}% · {deadlineLabel(c.selfReviewDeadline)}</p>
                <ProgressBar value={c.completionRate} size="sm" />
                <button onClick={() => handleNudge(c.id)} className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 bg-neutral-100 text-neutral-700 text-xs font-medium rounded hover:bg-neutral-200 transition-colors border border-neutral-200">
                  <Bell className="w-3.5 h-3.5" /> 미제출자 독촉 발송
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-800">최근 활동</h2>
          <button onClick={() => navigate('/cycles')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline">
            전체 보기
          </button>
        </div>
        <div className="space-y-1">
          {activityFeed.map((item, i) => (
            <button
              key={i}
              onClick={() => navigate('/cycles')}
              className="w-full flex items-center gap-3 py-2 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 rounded-lg px-1 transition-colors text-left"
            >
              <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full flex-shrink-0" />
              <p className="text-sm text-neutral-700 flex-1">{item.text}</p>
              <span className="text-xs text-neutral-400 flex-shrink-0">{item.time}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Manager Dashboard
function ManagerDashboard() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const { getFeedbackForUser } = useFeedbackStore();
  const navigate = useNavigate();

  const teamMembers = MOCK_USERS.filter(u => u.managerId === currentUser?.id);
  const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');

  const mySelfs = submissions.filter(s => s.reviewerId === currentUser?.id && s.type === 'self');
  const myDownwards = submissions.filter(s => s.reviewerId === currentUser?.id && s.type === 'downward');
  const { received } = getFeedbackForUser(currentUser?.id || '');

  const getMemberStatus = (memberId: string) => {
    const sub = submissions.find(s => s.reviewerId === currentUser?.id && s.revieweeId === memberId && s.type === 'downward' && s.cycleId === activeCycle?.id);
    return sub?.status || 'not_started';
  };

  const pieData = [
    { name: '제출 완료', value: myDownwards.filter(s => s.status === 'submitted').length, color: '#059669' },
    { name: '작성 중',  value: myDownwards.filter(s => s.status === 'in_progress').length, color: '#4f46e5' },
    { name: '미작성',   value: myDownwards.filter(s => s.status === 'not_started').length, color: '#e2e8f0' },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">팀장 대시보드</h1>

      {/* 할 일 — 모바일 1열, 태블릿+ 2열 */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">할 일</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mySelfs.some(s => s.status !== 'submitted') && (
            <button
              onClick={() => navigate('/reviews/me')}
              className="bg-white rounded-xl border border-neutral-200 shadow-card p-4 text-left hover:shadow-card-hover transition-all group"
            >
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold mb-2 bg-primary-50 text-primary-700">
                자기평가
              </span>
              <p className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700 line-clamp-1">{activeCycle?.title}</p>
              {activeCycle && <p className={`text-xs mt-1 ${isUrgent(activeCycle.selfReviewDeadline) ? 'text-primary-600 font-medium' : 'text-neutral-500'}`}>
                마감 {deadlineLabel(activeCycle.selfReviewDeadline)}
              </p>}
            </button>
          )}
          {myDownwards.some(s => s.status !== 'submitted') && (
            <button
              onClick={() => navigate('/reviews/team')}
              className="bg-white rounded-xl border border-neutral-200 shadow-card p-4 text-left hover:shadow-card-hover transition-all group"
            >
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold mb-2 bg-success-50 text-success-700">팀원 평가</span>
              <p className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700">
                {myDownwards.filter(s => s.status !== 'submitted').length}명 남음
              </p>
              {activeCycle && <p className="text-xs mt-1 text-neutral-500">마감 {deadlineLabel(activeCycle.managerReviewDeadline)}</p>}
            </button>
          )}
        </div>
      </div>

      {/* 팀원 현황 — 모바일 2열, 데스크톱 3열 */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-800">팀원 리뷰 현황</h2>
          <button onClick={() => navigate('/reports')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline">
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
                className="flex flex-col items-center p-3.5 bg-neutral-50 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-100 transition-all group"
              >
                <UserAvatar user={m} size="lg" />
                <p className="text-sm font-semibold text-neutral-900 mt-2">{m.name}</p>
                <p className="text-xs text-neutral-400 mb-2">{m.position}</p>
                <StatusBadge type="submission" value={status} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 하단 카드 — 모바일 1열, 데스크톱 2열 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
          <h2 className="text-sm font-semibold text-neutral-800 mb-4">팀 리뷰 완료율</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}명`, '']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-3 justify-center mt-2 flex-wrap">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-neutral-500">{d.name} {d.value}명</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-800">최근 받은 피드백</h2>
            <button onClick={() => navigate('/feedback')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline">
              전체 보기
            </button>
          </div>
          <div className="space-y-2">
            {received.slice(0, 3).map(fb => {
              const sender = MOCK_USERS.find(u => u.id === fb.fromUserId);
              return (
                <button
                  key={fb.id}
                  onClick={() => navigate('/feedback')}
                  className="w-full p-3 bg-neutral-50 rounded-lg text-left hover:bg-neutral-100 transition-colors border border-transparent hover:border-neutral-200"
                >
                  <p className="text-xs font-medium text-neutral-800 line-clamp-2">{fb.content}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">{fb.isAnonymous ? '익명' : sender?.name}</p>
                </button>
              );
            })}
            {received.length === 0 && (
              <p className="text-xs text-neutral-400 py-2">받은 피드백이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Employee Dashboard
function EmployeeDashboard() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const { getFeedbackForUser } = useFeedbackStore();
  const navigate = useNavigate();

  const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');
  const mySelf = submissions.find(s => s.reviewerId === currentUser?.id && s.type === 'self' && s.cycleId === activeCycle?.id);
  const { received } = getFeedbackForUser(currentUser?.id || '');
  const pastSubmissions = submissions.filter(s => s.reviewerId === currentUser?.id && s.type === 'self' && s.status === 'submitted');

  return (
    <div className="space-y-5 md:space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">안녕하세요, {currentUser?.name}님 👋</h1>

      {/* CTA 카드 */}
      {activeCycle && mySelf && mySelf.status !== 'submitted' && (
        <div className="bg-white rounded-xl border border-primary-300 shadow-card p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary-600 mb-1">지금 진행 중</p>
              <h2 className="text-lg font-semibold text-neutral-900 mb-3 truncate">{activeCycle.title}</h2>
              <div className="w-full sm:w-52">
                <ProgressBar value={mySelf.answers.length} max={6} showPercent />
                <p className="text-xs text-neutral-400 mt-1">{mySelf.answers.length}/6 질문 완료 · 마감 {deadlineLabel(activeCycle.selfReviewDeadline)}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/reviews/me/${mySelf.id}`)}
              className="flex-shrink-0 px-4 py-2 bg-primary-600 text-white font-medium text-sm rounded hover:bg-primary-700 transition-colors"
            >
              {mySelf.status === 'not_started' ? '시작하기' : '이어서 작성'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-800">최근 받은 피드백</h2>
            <button onClick={() => navigate('/feedback')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline">
              전체 보기
            </button>
          </div>
          <div className="space-y-3">
            {received.slice(0, 3).map(fb => {
              const sender = MOCK_USERS.find(u => u.id === fb.fromUserId);
              const typeColors = { praise: 'bg-success-50 text-success-700', suggestion: 'bg-primary-50 text-primary-700', note: 'bg-neutral-100 text-neutral-600' };
              const typeLabels = { praise: '칭찬 🌟', suggestion: '제안 💡', note: '기록 📝' };
              return (
                <button
                  key={fb.id}
                  onClick={() => navigate('/feedback')}
                  className="w-full p-3 bg-neutral-50 rounded-lg text-left hover:bg-neutral-100 transition-colors border border-transparent hover:border-neutral-200"
                >
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColors[fb.type]}`}>{typeLabels[fb.type]}</span>
                  <p className="text-xs text-neutral-700 mt-1.5 line-clamp-2">{fb.content}</p>
                  <p className="text-[10px] text-neutral-400 mt-1">{fb.isAnonymous ? '익명' : sender?.name}</p>
                </button>
              );
            })}
            {received.length === 0 && <p className="text-sm text-neutral-400">받은 피드백이 없습니다.</p>}
          </div>
        </div>

      {/* 이전 리뷰 타임라인 */}
      {pastSubmissions.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-800">리뷰 이력</h2>
            <button onClick={() => navigate('/reviews/me')} className="text-xs text-primary-600 hover:text-primary-700 hover:underline">
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
                  className="w-full flex items-center gap-4 py-2 border-b border-neutral-50 last:border-0 hover:bg-neutral-50 rounded-lg px-1 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center font-bold text-primary-700 flex-shrink-0 text-sm">{grade}</div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-neutral-800">{cycle?.title}</p>
                    <p className="text-xs text-neutral-400">{s.submittedAt ? formatDate(s.submittedAt) : ''}</p>
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
  if (currentUser.role === 'manager') return <ManagerDashboard />;
  return <EmployeeDashboard />;
}
