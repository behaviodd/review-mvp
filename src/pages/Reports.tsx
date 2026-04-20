import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useReviewStore } from '../stores/reviewStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { useTeamStore } from '../stores/teamStore';
import { usePermission } from '../hooks/usePermission';

const GRADE_FROM_RATING = (r: number) => r >= 4.5 ? 'S' : r >= 3.5 ? 'A' : r >= 2.5 ? 'B' : r >= 1.5 ? 'C' : 'D';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { UserAvatar } from '../components/ui/UserAvatar';
import { EmptyState } from '../components/ui/EmptyState';
import { TrendingUp, BarChart2, Users, Star, MessageSquare, ChevronRight } from 'lucide-react';

// sky, emerald, slate, rose, violet (Tailwind syntax theme 팔레트)
const COLORS = ['#4f46e5', '#059669', '#94a3b8', '#e11d48', '#7c3aed'];

// Tooltip 공통 스타일
const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: 12,
  color: '#0f172a',
};

export function Reports() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const { feedbacks } = useFeedbackStore();
  const { isAdmin, isLeader } = usePermission();

  const { users } = useTeamStore();
  const activeUsers = users.filter(u => u.isActive !== false && u.role !== 'admin');

  const activeCycle = cycles.find(c => c.status === 'self_review' || c.status === 'manager_review');

  // Admin: department distribution (real data)
  const deptData = useMemo(() => {
    if (!activeCycle) return [];
    const depts = Array.from(new Set(activeUsers.map(u => u.department))).filter(Boolean);
    return depts.map(dept => {
      const members = activeUsers.filter(u => u.department === dept);
      const submitted = members.filter(u =>
        submissions.some(s => s.cycleId === activeCycle.id && s.revieweeId === u.id && s.type === 'self' && s.status === 'submitted')
      ).length;
      return { name: dept, 제출률: members.length ? Math.round(submitted / members.length * 100) : 0 };
    });
  }, [activeCycle, submissions, activeUsers]);

  // Rating distribution for admin
  const allSubmitted = submissions.filter(s => s.status === 'submitted' && s.overallRating);
  const ratingDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  allSubmitted.forEach(s => {
    if (s.overallRating) ratingDist[GRADE_FROM_RATING(s.overallRating)]++;
  });
  const distData = Object.entries(ratingDist).map(([grade, count]) => ({ grade, count }));

  // Manager: team member ratings
  const teamMembers = users.filter(u => u.managerId === currentUser?.id && u.isActive !== false);
  const teamData = teamMembers.map(m => {
    const selfSub = submissions.find(s => s.revieweeId === m.id && s.type === 'self' && s.status === 'submitted');
    const managerSub = submissions.find(s => s.revieweeId === m.id && s.type === 'downward' && s.reviewerId === currentUser?.id);
    const selfRatings = selfSub?.answers.filter(a => a.ratingValue).map(a => a.ratingValue!) ?? [];
    const mgRatings = managerSub?.answers.filter(a => a.ratingValue).map(a => a.ratingValue!) ?? [];
    const selfAvg = selfRatings.length ? selfRatings.reduce((s, v) => s + v, 0) / selfRatings.length : 0;
    const mgAvg = mgRatings.length ? mgRatings.reduce((s, v) => s + v, 0) / mgRatings.length : 0;
    return { name: m.name, 자기평가: +selfAvg.toFixed(1), 매니저평가: +mgAvg.toFixed(1) };
  });

  // Completion pie for manager
  const submitted = teamMembers.filter(m =>
    submissions.some(s => s.revieweeId === m.id && s.type === 'self' && s.status === 'submitted')
  ).length;
  const pieData = [
    { name: '제출 완료', value: submitted },
    { name: '미제출', value: teamMembers.length - submitted },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-neutral-900">리포트</h1>
        {activeCycle && (
          <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">{activeCycle.title}</span>
        )}
      </div>

      {isAdmin && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: Users, label: '총 구성원', value: `${activeUsers.length}명` },
              { icon: BarChart2, label: '진행 중 리뷰', value: `${cycles.filter(c => c.status !== 'closed' && c.status !== 'draft').length}개` },
              { icon: TrendingUp, label: '전체 제출률', value: `${Math.round(allSubmitted.length / Math.max(submissions.filter(s => s.type === 'self').length, 1) * 100)}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-neutral-400" />
                  <span className="text-xs text-neutral-500">{label}</span>
                </div>
                <p className="text-2xl font-bold text-neutral-900">{value}</p>
              </div>
            ))}
          </div>

          {/* Dept completion bar chart */}
          <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
            <h2 className="text-sm font-semibold text-neutral-700 mb-4">부서별 제출률</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 100]} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, '제출률']} contentStyle={tooltipStyle} />
                <Bar dataKey="제출률" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rating distribution */}
          <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
            <h2 className="text-sm font-semibold text-neutral-700 mb-4">등급 분포</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="grade" tick={{ fontSize: 13, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="인원" radius={[6, 6, 0, 0]}>
                  {distData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {isLeader && (
        <>
          {/* Team completion pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
              <h2 className="text-sm font-semibold text-neutral-700 mb-3">자기평가 제출 현황</h2>
              {teamMembers.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#4f46e5' : '#e2e8f0'} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={8} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={Users} title="팀원 데이터 없음" compact />
              )}
            </div>

            {/* Team member stats */}
            <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
              <h2 className="text-sm font-semibold text-neutral-700 mb-3">팀원 현황</h2>
              <div className="space-y-2">
                {teamMembers.map(m => {
                  const sub = submissions.find(s => s.revieweeId === m.id && s.type === 'self');
                  return (
                    <button
                      key={m.id}
                      onClick={() => activeCycle && navigate(`/reviews/team/${activeCycle.id}/${m.id}`)}
                      disabled={!activeCycle}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-neutral-50 transition-colors disabled:cursor-default group"
                    >
                      <UserAvatar user={m} size="sm" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-semibold text-neutral-700">{m.name}</p>
                        <p className="text-xs text-neutral-400">{m.position}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        sub?.status === 'submitted' ? 'bg-success-50 text-success-600' :
                        sub?.status === 'in_progress' ? 'bg-primary-50 text-primary-600' :
                        'bg-neutral-100 text-neutral-400'
                      }`}>
                        {sub?.status === 'submitted' ? '제출' : sub?.status === 'in_progress' ? '작성 중' : '미시작'}
                      </span>
                      {activeCycle && <ChevronRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Self vs Manager comparison */}
          {teamData.some(d => d.자기평가 > 0) && (
            <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
              <h2 className="text-sm font-semibold text-neutral-700 mb-4">자기평가 vs 매니저평가 비교</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={teamData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="자기평가" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="매니저평가" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {!isAdmin && !isLeader && (() => {
        const mySubs = submissions.filter(s => s.revieweeId === currentUser?.id && s.status === 'submitted');
        const myReceived = feedbacks.filter(f => f.toUserId === currentUser?.id);
        const mySent = feedbacks.filter(f => f.fromUserId === currentUser?.id);
        const myLatestSub = mySubs.at(-1);
        const myRatings = myLatestSub?.answers.filter(a => a.ratingValue).map(a => a.ratingValue!) ?? [];
        const myAvg = myRatings.length ? (myRatings.reduce((s, v) => s + v, 0) / myRatings.length).toFixed(1) : null;

        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { icon: Star, label: '제출한 자기평가', value: `${mySubs.length}회`, action: () => navigate('/reviews/me'), actionLabel: '내 리뷰 보기' },
                { icon: MessageSquare, label: '받은 피드백', value: `${myReceived.length}개`, action: () => navigate('/feedback'), actionLabel: '확인하기' },
                { icon: TrendingUp, label: '보낸 피드백', value: `${mySent.length}개`, action: () => navigate('/feedback'), actionLabel: '보내기' },
              ].map(({ icon: Icon, label, value, action, actionLabel }) => (
                <div key={label} className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-neutral-400" />
                    <span className="text-xs text-neutral-500">{label}</span>
                  </div>
                  <p className="text-2xl font-bold text-neutral-900">{value}</p>
                  <button onClick={action} className="mt-auto text-xs text-primary-600 hover:underline text-left">{actionLabel} →</button>
                </div>
              ))}
            </div>

            {myAvg && (
              <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
                <h2 className="text-sm font-semibold text-neutral-700 mb-1">최근 자기평가 평균 점수</h2>
                <p className="text-3xl font-bold text-primary-600">{myAvg} <span className="text-base font-normal text-neutral-400">/ 5.0</span></p>
                <button onClick={() => myLatestSub && navigate(`/reviews/me/${myLatestSub.id}`)} className="mt-3 text-xs text-primary-600 hover:underline">
                  최근 리뷰 상세 보기 →
                </button>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
