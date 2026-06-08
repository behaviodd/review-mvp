import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useReviewStore } from '../stores/reviewStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { useTeamStore } from '../stores/teamStore';
import { usePermission } from '../hooks/usePermission';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { UserAvatar } from '../components/ui/UserAvatar';
import { EmptyState } from '../components/ui/EmptyState';
import { TrendingUp, BarChart2, Users } from 'lucide-react';
import { MsStarIcon, MsMessageIcon, MsChevronRightLineIcon, MsAlertIcon } from '../components/ui/MsIcons';
import type { ReviewSubmission, ReviewTemplate } from '../types';

// DS palette
const COLORS = ['#1482b8', '#20903c', '#a7b3be', '#e61919', '#5207cf'];
const tooltipStyle = { borderRadius: '8px', border: '1px solid #c4cdd4', fontSize: 12, color: '#111417' };
const GRADE_FROM_RATING = (r: number) => r >= 4.5 ? 'S' : r >= 3.5 ? 'A' : r >= 2.5 ? 'B' : r >= 1.5 ? 'C' : 'D';

// ─── 레이더 차트 데이터 계산 ─────────────────────────────────────────────────
type RadarRow = { subject: string; self: number; manager: number; peer?: number };

function computeRadarData(
  revieweeId: string,
  managerId: string | undefined,
  submissions: ReviewSubmission[],
  template: ReviewTemplate | undefined,
): RadarRow[] {
  if (!template) return [];

  const selfSub  = submissions.find(s => s.revieweeId === revieweeId && s.type === 'self'     && s.status === 'submitted');
  const mgSub    = submissions.find(s => s.revieweeId === revieweeId && s.type === 'downward' && s.reviewerId === managerId && s.status === 'submitted');
  const peerSubs = submissions.filter(s => s.revieweeId === revieweeId && s.type === 'peer'   && s.status === 'submitted');

  if (!selfSub && !mgSub) return [];

  const ratingQs = template.questions.filter(q => q.type === 'rating' || q.type === 'competency');
  if (ratingQs.length === 0) return [];

  const avgAnswers = (sub: ReviewSubmission | undefined, qIds: string[]) => {
    if (!sub) return 0;
    const vals = qIds.map(id => sub.answers.find(a => a.questionId === id)?.ratingValue).filter((v): v is number => v != null);
    return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : 0;
  };

  const peerAvgFn = (qIds: string[]) => {
    if (!peerSubs.length) return undefined;
    const vals: number[] = [];
    peerSubs.forEach(ps => qIds.forEach(id => {
      const v = ps.answers.find(a => a.questionId === id)?.ratingValue;
      if (v != null) vals.push(v);
    }));
    return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : undefined;
  };

  const sections = template.sections;
  if (sections && sections.length > 0) {
    return sections.flatMap(sec => {
      const qIds = ratingQs.filter(q => q.sectionId === sec.id).map(q => q.id);
      if (!qIds.length) return [];
      const peerAvg = peerAvgFn(qIds);
      return [{
        subject: sec.name,
        self:    avgAnswers(selfSub, qIds),
        manager: avgAnswers(mgSub,  qIds),
        ...(peerAvg != null ? { peer: peerAvg } : {}),
      }];
    });
  }

  // 섹션 없으면 개별 질문 (최대 6개)
  return ratingQs.slice(0, 6).map(q => {
    const peerAvg = peerAvgFn([q.id]);
    return {
      subject: q.text.length > 12 ? q.text.slice(0, 12) + '…' : q.text,
      self:    avgAnswers(selfSub, [q.id]),
      manager: avgAnswers(mgSub,  [q.id]),
      ...(peerAvg != null ? { peer: peerAvg } : {}),
    };
  });
}

// ─── 관대화 편향 계산 ──────────────────────────────────────────────────────────
function biasAnalysis(subs: ReviewSubmission[]) {
  const rated = subs.filter(s => s.overallRating != null && s.status === 'submitted');
  if (!rated.length) return null;
  const high = rated.filter(s => s.overallRating! >= 3.5).length;
  const ratio = Math.round((high / rated.length) * 100);
  return { total: rated.length, high, ratio, isLenient: ratio > 60 };
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminReports() {
  const { cycles, submissions } = useReviewStore();
  const { users } = useTeamStore();
  const activeUsers = users.filter(u => u.isActive !== false);
  const activeCycle = cycles.find(c => c.status === 'self_review' || c.status === 'manager_review' || c.status === 'calibration');

  // 부서별 제출률
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

  // 등급 분포 (전 사이클 합산)
  const ratingDist: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  const allRated = submissions.filter(s => s.status === 'submitted' && s.overallRating);
  allRated.forEach(s => { if (s.overallRating) ratingDist[GRADE_FROM_RATING(s.overallRating)]++; });
  const distData = Object.entries(ratingDist).map(([grade, count]) => ({ grade, count }));

  // 관대화 편향 (활성 사이클 downward 기준)
  const activeCycleId = activeCycle?.id;
  const bias = useMemo(
    () => biasAnalysis(submissions.filter(s => !!activeCycleId && s.cycleId === activeCycleId && s.type === 'downward')),
    [submissions, activeCycleId],
  );

  // 사이클별 배분율 비교 (overallRating → 등급 → count)
  const calibData = useMemo(() => {
    if (!activeCycle) return [];
    const downwards = submissions.filter(
      s => s.cycleId === activeCycle.id && s.type === 'downward' && s.status === 'submitted' && s.overallRating
    );
    const total = downwards.length;
    if (!total) return [];
    return (['S', 'A', 'B', 'C', 'D'] as const).map(g => {
      const count = downwards.filter(s => s.overallRating && GRADE_FROM_RATING(s.overallRating) === g).length;
      return { grade: g, 실제비율: total ? Math.round((count / total) * 100) : 0, count };
    });
  }, [activeCycle, submissions]);

  const totalSelf = submissions.filter(s => s.type === 'self').length;

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-0 md:divide-x md:divide-bd-default md:border md:border-bd-default md:rounded-lg">
        {[
          { icon: Users,      label: '총 구성원',    value: `${activeUsers.length}명` },
          { icon: BarChart2,  label: '진행 중 리뷰',  value: `${cycles.filter(c => c.status !== 'closed' && c.status !== 'draft').length}개` },
          { icon: TrendingUp, label: '전체 제출률',   value: `${Math.round(allRated.length / Math.max(totalSelf, 1) * 100)}%` },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-fg-subtlest" />
              <span className="text-xs text-fg-subtle">{label}</span>
            </div>
            <p className="text-2xl font-bold text-fg-default">{value}</p>
          </div>
        ))}
      </div>

      {/* 관대화 편향 점검 */}
      {bias && (
        <div className={`rounded-lg border p-5 ${bias.isLenient ? 'border-orange-020 bg-orange-005' : 'border-bd-default'}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex-shrink-0 ${bias.isLenient ? 'text-orange-060' : 'text-fg-subtle'}`}>
              <MsAlertIcon size={16} />
            </div>
            <div className="flex-1">
              <h2 className={`text-base font-semibold mb-1 ${bias.isLenient ? 'text-orange-070' : 'text-fg-default'}`}>
                조직장 편향 점검
                {bias.isLenient && <span className="ml-2 text-xs font-medium bg-orange-010 text-orange-070 px-1.5 py-0.5 rounded">관대화 경향 감지</span>}
              </h2>
              <p className={`text-xs ${bias.isLenient ? 'text-orange-070' : 'text-fg-subtle'}`}>
                조직장 평가 {bias.total}건 중 A등급 이상 {bias.high}건 — <strong>{bias.ratio}%</strong>
                {bias.isLenient
                  ? '  •  A/S 등급 비중이 60%를 초과했습니다. 등급 분포 재검토를 권장합니다.'
                  : '  •  등급 분포가 정상 범위입니다.'}
              </p>
            </div>
            {/* 미니 분포 바 */}
            <div className="flex-shrink-0 text-right">
              <p className="text-2xl font-bold text-fg-default">{bias.ratio}<span className="text-base font-normal text-fg-subtle">%</span></p>
              <p className="text-[11px] text-fg-subtlest">A/S 비율</p>
            </div>
          </div>
        </div>
      )}

      {/* 부서별 제출률 */}
      {deptData.length > 0 && (
        <div className="rounded-lg border border-bd-default p-5">
          <h2 className="text-base font-semibold text-fg-default mb-4">부서별 제출률</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deptData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e6ea" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6d7f92' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6d7f92' }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, '제출률']} contentStyle={tooltipStyle} />
              <Bar dataKey="제출률" fill="#1482b8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 등급 분포 + 캘리브레이션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-lg border border-bd-default p-5">
          <h2 className="text-base font-semibold text-fg-default mb-4">전체 등급 분포</h2>
          {distData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e6ea" />
                <XAxis dataKey="grade" tick={{ fontSize: 13, fill: '#6d7f92' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6d7f92' }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="인원" radius={[6, 6, 0, 0]}>
                  {distData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart2} title="제출된 평가 없음" compact />
          )}
        </div>

        {calibData.length > 0 && (
          <div className="rounded-lg border border-bd-default p-5">
            <h2 className="text-base font-semibold text-fg-default mb-1">
              조직장 평가 등급 비율
            </h2>
            <p className="text-xs text-fg-subtle mb-4">{activeCycle?.title} · 제출 완료 기준</p>
            <div className="space-y-3">
              {calibData.filter(d => d.count > 0).map(d => (
                <div key={d.grade}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-fg-default">{d.grade}등급</span>
                    <span className="text-fg-subtle tabular-nums">{d.count}명 · {d.실제비율}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-010 overflow-hidden">
                    <div className="h-full rounded-full bg-pink-040 transition-all" style={{ width: `${d.실제비율}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leader Dashboard ─────────────────────────────────────────────────────────
function LeaderReports() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const { users } = useTeamStore();
  const navigate = useNavigate();

  const teamMembers = users.filter(u => u.managerId === currentUser?.id && u.isActive !== false);
  const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');
  const template = activeCycle?.templateSnapshot;

  // 팀원 선택 (레이더용)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const selectedMember = teamMembers.find(m => m.id === selectedMemberId) ?? teamMembers[0];

  // 레이더 데이터
  const radarData = computeRadarData(selectedMember?.id ?? '', currentUser?.id, submissions, template);
  const hasPeer = radarData.some(d => 'peer' in d);

  // 팀 완료 현황 파이
  const submitted = teamMembers.filter(m =>
    submissions.some(s => s.revieweeId === m.id && s.type === 'self' && s.status === 'submitted')
  ).length;
  const pieData = [
    { name: '제출 완료', value: submitted },
    { name: '미제출', value: teamMembers.length - submitted },
  ];

  // 자기평가 vs 조직장평가 bar
  const teamBarData = teamMembers.map(m => {
    const selfSub = submissions.find(s => s.revieweeId === m.id && s.type === 'self' && s.status === 'submitted');
    const mgSub   = submissions.find(s => s.revieweeId === m.id && s.type === 'downward' && s.reviewerId === currentUser?.id);
    const avg = (sub: ReviewSubmission | undefined) => {
      const vals = (sub?.answers ?? []).filter(a => a.ratingValue).map(a => a.ratingValue!);
      return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : 0;
    };
    return { name: m.name, 자기평가: avg(selfSub), 조직장평가: avg(mgSub) };
  });

  return (
    <div className="space-y-6">
      {/* 팀 완료 현황 + 팀원 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-lg border border-bd-default p-5">
          <h2 className="text-base font-semibold text-fg-default mb-3">자기평가 제출 현황</h2>
          {teamMembers.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#ff4d89' : '#c4cdd4'} />)}
                </Pie>
                <Legend iconType="circle" iconSize={8} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Users} title="팀원 데이터 없음" compact />
          )}
        </div>

        <div className="rounded-lg border border-bd-default p-5">
          <h2 className="text-base font-semibold text-fg-default mb-3">팀원 현황</h2>
          <div className="space-y-2">
            {teamMembers.map(m => {
              const sub = submissions.find(s => s.revieweeId === m.id && s.type === 'self');
              return (
                <button key={m.id}
                  onClick={() => activeCycle && navigate(`/reviews/team/${activeCycle.id}/${m.id}`)}
                  disabled={!activeCycle}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-005 transition-colors disabled:cursor-default group"
                >
                  <UserAvatar user={m} size="sm" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-fg-default">{m.name}</p>
                    <p className="text-xs text-fg-subtlest">{m.position}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    sub?.status === 'submitted'   ? 'bg-green-005 text-green-060' :
                    sub?.status === 'in_progress' ? 'bg-pink-005 text-pink-050'  :
                    'bg-gray-010 text-fg-subtlest'
                  }`}>
                    {sub?.status === 'submitted' ? '제출' : sub?.status === 'in_progress' ? '작성 중' : '미시작'}
                  </span>
                  {activeCycle && <MsChevronRightLineIcon size={12} className="text-gray-030 group-hover:text-fg-subtle flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 자기 객관화 레이더 차트 */}
      <div className="rounded-lg border border-bd-default p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-fg-default">자기 객관화 진단</h2>
            <p className="text-xs text-fg-subtle mt-0.5">셀프 평가와 조직장·동료 평가의 차이를 다각도로 비교합니다</p>
          </div>
          {teamMembers.length > 1 && (
            <select
              value={selectedMemberId || selectedMember?.id || ''}
              onChange={e => setSelectedMemberId(e.target.value)}
              className="text-xs border border-bd-default rounded-md px-2 py-1.5 bg-white text-fg-default focus:outline-none focus:border-bd-focused"
            >
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
        </div>

        {radarData.length >= 3 ? (
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e1e6ea" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6d7f92' }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9, fill: '#a7b3be' }} tickCount={4} />
                <Radar name="자기평가" dataKey="self" stroke="#1482b8" fill="#1482b8" fillOpacity={0.15} strokeWidth={2} />
                <Radar name="조직장평가" dataKey="manager" stroke="#20903c" fill="#20903c" fillOpacity={0.15} strokeWidth={2} />
                {hasPeer && <Radar name="동료평가" dataKey="peer" stroke="#863dff" fill="#863dff" fillOpacity={0.12} strokeWidth={2} />}
                <Legend iconType="circle" iconSize={8} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}점`, '']} />
              </RadarChart>
            </ResponsiveContainer>
            {/* 갭 요약 */}
            {radarData.length > 0 && (() => {
              const gaps = radarData
                .filter(d => d.self > 0 && d.manager > 0)
                .map(d => ({ subject: d.subject, gap: +(d.self - d.manager).toFixed(1) }))
                .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
              if (!gaps.length) return null;
              const top = gaps[0];
              return (
                <div className="mt-3 text-center">
                  <p className="text-xs text-fg-subtle">
                    가장 큰 인식 차이 —{' '}
                    <span className="font-semibold text-fg-default">{top.subject}</span>
                    {' '}
                    <span className={top.gap > 0 ? 'text-blue-060' : 'text-green-060'}>
                      {top.gap > 0 ? `자기평가 +${top.gap}점 높음` : `조직장평가 ${Math.abs(top.gap)}점 높음`}
                    </span>
                  </p>
                </div>
              );
            })()}
          </div>
        ) : (
          <EmptyState icon={BarChart2} title="비교 데이터 부족" description="셀프·조직장 평가가 모두 제출된 후 레이더 차트가 생성됩니다." compact />
        )}
      </div>

      {/* 자기평가 vs 조직장평가 bar */}
      {teamBarData.some(d => d.자기평가 > 0) && (
        <div className="rounded-lg border border-bd-default p-5">
          <h2 className="text-base font-semibold text-fg-default mb-4">자기평가 vs 조직장평가 비교</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={teamBarData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e6ea" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6d7f92' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#6d7f92' }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" iconSize={8} />
              <Bar dataKey="자기평가"  fill="#1482b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="조직장평가" fill="#20903c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Employee Dashboard ───────────────────────────────────────────────────────
function EmployeeReports() {
  const { currentUser } = useAuthStore();
  const { cycles, submissions } = useReviewStore();
  const { feedbacks } = useFeedbackStore();
  const navigate = useNavigate();

  const mySubs     = submissions.filter(s => s.revieweeId === currentUser?.id && s.status === 'submitted');
  const mySelfSubs = mySubs.filter(s => s.type === 'self').sort((a, b) =>
    new Date(a.submittedAt ?? a.lastSavedAt).getTime() - new Date(b.submittedAt ?? b.lastSavedAt).getTime()
  );
  const myLatestSelf = mySelfSubs.at(-1);
  const myReceived   = feedbacks.filter(f => f.toUserId === currentUser?.id);
  const mySent       = feedbacks.filter(f => f.fromUserId === currentUser?.id);

  // 자기 객관화: 내 자기평가 vs 받은 조직장 평가 비교
  const selfVsMgr = useMemo(() => {
    const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');
    if (!activeCycle) return [];
    const selfSub = submissions.find(s => s.revieweeId === currentUser?.id && s.type === 'self' && s.cycleId === activeCycle.id && s.status === 'submitted');
    const mgSub   = submissions.find(s => s.revieweeId === currentUser?.id && s.type === 'downward' && s.cycleId === activeCycle.id && s.status === 'submitted');
    if (!selfSub && !mgSub) return [];
    const template = activeCycle.templateSnapshot;
    return computeRadarData(currentUser!.id, undefined, submissions, template).map(d => ({
      ...d,
      // employee view: manager는 downward sub에서 계산
      manager: mgSub
        ? (() => {
            const ratingQs = (template?.questions ?? []).filter(q => (q.type === 'rating' || q.type === 'competency'));
            const qBySection = template?.sections?.length
              ? ratingQs.filter(q => template.sections!.find(s => s.name === d.subject)
                  ? q.sectionId === template.sections!.find(s => s.name === d.subject)?.id
                  : false)
              : ratingQs.filter(q => q.text.length > 12 ? q.text.slice(0, 12) + '…' : q.text === d.subject);
            const vals = qBySection.map(q => mgSub.answers.find(a => a.questionId === q.id)?.ratingValue).filter((v): v is number => v != null);
            return vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : 0;
          })()
        : 0,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles, submissions, currentUser?.id, feedbacks]);

  // 평가 추세 (사이클별 평균)
  const trendData = mySelfSubs.map(sub => {
    const cycle = cycles.find(c => c.id === sub.cycleId);
    const vals = sub.answers.filter(a => a.ratingValue).map(a => a.ratingValue!);
    const avg = vals.length ? +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : 0;
    return { name: cycle?.title?.slice(0, 8) ?? sub.cycleId.slice(0, 6), 평균점수: avg };
  });

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-0 md:divide-x md:divide-bd-default md:border md:border-bd-default md:rounded-lg">
        {[
          { icon: MsStarIcon,   label: '제출한 자기평가', value: `${mySelfSubs.length}회`, action: () => navigate('/reviews/me'),  actionLabel: '내 리뷰 보기' },
          { icon: MsMessageIcon, label: '받은 피드백',    value: `${myReceived.length}개`, action: () => navigate('/feedback'),   actionLabel: '확인하기' },
          { icon: TrendingUp,   label: '보낸 피드백',    value: `${mySent.length}개`,      action: () => navigate('/feedback'),   actionLabel: '보내기' },
        ].map(({ icon: Icon, label, value, action, actionLabel }) => (
          <div key={label} className="p-4 md:p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-fg-subtlest" />
              <span className="text-xs text-fg-subtle">{label}</span>
            </div>
            <p className="text-2xl font-bold text-fg-default">{value}</p>
            <button onClick={action} className="mt-auto text-xs text-pink-050 hover:underline text-left">{actionLabel} →</button>
          </div>
        ))}
      </div>

      {/* 자기 객관화 레이더 */}
      <div className="rounded-lg border border-bd-default p-5">
        <h2 className="text-base font-semibold text-fg-default mb-1">자기 객관화 진단</h2>
        <p className="text-xs text-fg-subtle mb-4">내 자기평가와 조직장이 평가한 점수를 영역별로 비교합니다</p>
        {selfVsMgr.length >= 3 ? (
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={selfVsMgr}>
              <PolarGrid stroke="#e1e6ea" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6d7f92' }} />
              <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9, fill: '#a7b3be' }} tickCount={4} />
              <Radar name="자기평가"  dataKey="self"    stroke="#1482b8" fill="#1482b8" fillOpacity={0.15} strokeWidth={2} />
              <Radar name="조직장평가" dataKey="manager" stroke="#20903c" fill="#20903c" fillOpacity={0.15} strokeWidth={2} />
              <Legend iconType="circle" iconSize={8} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}점`, '']} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={BarChart2} title="비교 데이터 부족" description="자기평가와 조직장 평가가 모두 제출되면 레이더가 표시됩니다." compact />
        )}
      </div>

      {/* 평가 추세 */}
      {trendData.length >= 2 && (
        <div className="rounded-lg border border-bd-default p-5">
          <h2 className="text-base font-semibold text-fg-default mb-4">자기평가 점수 추세</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e6ea" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6d7f92' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#6d7f92' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}점`, '평균 점수']} />
              <Bar dataKey="평균점수" fill="#1482b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 최근 자기평가 점수 */}
      {myLatestSelf?.overallRating && (
        <div className="rounded-lg border border-bd-default p-5">
          <h2 className="text-base font-semibold text-fg-default mb-1">최근 자기평가</h2>
          <p className="text-3xl font-bold text-pink-050">
            {myLatestSelf.overallRating.toFixed(1)}
            <span className="text-base font-normal text-fg-subtlest"> / 5.0</span>
          </p>
          <p className="text-xs text-fg-subtle mt-1">
            종합 등급: <strong>{GRADE_FROM_RATING(myLatestSelf.overallRating)}</strong>
          </p>
          <button onClick={() => navigate(`/reviews/me/${myLatestSelf.id}`)} className="mt-3 text-xs text-pink-050 hover:underline">
            리뷰 상세 보기 →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 진입점 ───────────────────────────────────────────────────────────────────
export function Reports() {
  const { cycles } = useReviewStore();
  const { isAdmin, isLeader } = usePermission();

  const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-fg-default">리포트</h1>
        {activeCycle && (
          <span className="text-xs text-fg-subtle bg-gray-010 px-2 py-0.5 rounded">{activeCycle.title}</span>
        )}
      </div>

      {isAdmin   && <AdminReports />}
      {isLeader  && !isAdmin && <LeaderReports />}
      {!isAdmin  && !isLeader && <EmployeeReports />}
    </div>
  );
}
