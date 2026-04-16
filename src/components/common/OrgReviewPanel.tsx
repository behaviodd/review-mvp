import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { MOCK_USERS } from '../../data/mockData';
import { UserAvatar } from '../ui/UserAvatar';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_CLS: Record<string, string> = {
  submitted:   'bg-success-50 text-success-700',
  in_progress: 'bg-primary-50 text-primary-700',
  not_started: 'bg-neutral-100 text-neutral-500',
};
const STATUS_LABEL: Record<string, string> = {
  submitted:   '제출 완료',
  in_progress: '작성 중',
  not_started: '미작성',
};

export function OrgReviewPanel() {
  const { cycles, submissions } = useReviewStore();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const activeCycle = cycles.find(c => c.status !== 'draft' && c.status !== 'closed');
  const managers = MOCK_USERS.filter(u => u.role === 'manager');

  const toggleManager = (managerId: string) =>
    setExpanded(prev => ({ ...prev, [managerId]: !prev[managerId] }));

  const getSub = (reviewerId: string, revieweeId: string, type: 'self' | 'downward') =>
    submissions.find(
      s => s.reviewerId === reviewerId && s.revieweeId === revieweeId
        && s.type === type && s.cycleId === activeCycle?.id
    );

  if (!activeCycle) return null;

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-800">조직별 평가 현황</h2>
          <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
            {activeCycle.title}
          </span>
        </div>
      </div>

      {/* 컬럼 헤더 */}
      <div className="grid grid-cols-[1fr_100px_100px_100px] gap-3 px-5 py-2 bg-neutral-50/60 border-b border-neutral-100">
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">구성원</span>
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide text-center">자기평가</span>
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide text-center">매니저 평가</span>
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide text-right">평균점수</span>
      </div>

      <div className="divide-y divide-neutral-100">
        {managers.map(manager => {
          const employees = MOCK_USERS.filter(u => u.managerId === manager.id);
          const isOpen = expanded[manager.id] !== false; // 기본 펼침
          const managerSelf = getSub(manager.id, manager.id, 'self');

          const totalEmployees = employees.length;
          const selfSubmitted   = employees.filter(e => getSub(e.id, e.id, 'self')?.status === 'submitted').length;
          const managerReviewed = employees.filter(e => getSub(manager.id, e.id, 'downward')?.status === 'submitted').length;

          return (
            <div key={manager.id}>
              {/* 팀장 행 */}
              <button
                onClick={() => toggleManager(manager.id)}
                className="w-full grid grid-cols-[1fr_100px_100px_100px] gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors items-center"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 flex items-center justify-center text-neutral-400 flex-shrink-0">
                    {isOpen
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                  </span>
                  <UserAvatar user={manager} size="sm" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-neutral-900 leading-tight">{manager.name}</p>
                    <p className="text-xs text-neutral-400">{manager.department} · 팀장</p>
                  </div>
                  <span className="ml-2 text-[11px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                    팀원 {selfSubmitted}/{totalEmployees} 제출 · 매니저 평가 {managerReviewed}/{totalEmployees}
                  </span>
                </div>
                {/* 팀장 자기평가 */}
                <div className="flex justify-center">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${STATUS_CLS[managerSelf?.status || 'not_started']}`}>
                    {STATUS_LABEL[managerSelf?.status || 'not_started']}
                  </span>
                </div>
                {/* 매니저 평가 수 */}
                <div className="flex justify-center">
                  <span className="text-xs text-neutral-500">{managerReviewed}/{totalEmployees}</span>
                </div>
                {/* 점수 */}
                <div className="text-right">
                  {managerSelf?.overallRating
                    ? <span className="text-sm font-bold text-primary-600">{managerSelf.overallRating.toFixed(1)}</span>
                    : <span className="text-xs text-neutral-300">—</span>
                  }
                </div>
              </button>

              {/* 팀원 행 */}
              {isOpen && employees.map(employee => {
                const selfSub    = getSub(employee.id, employee.id, 'self');
                const managerSub = getSub(manager.id, employee.id, 'downward');
                const selfStatus    = selfSub?.status    || 'not_started';
                const managerStatus = managerSub?.status || 'not_started';

                return (
                  <button
                    key={employee.id}
                    onClick={() => navigate(`/reviews/team/${activeCycle.id}/${employee.id}`)}
                    className="w-full grid grid-cols-[1fr_100px_100px_100px] gap-3 px-5 py-2.5 bg-neutral-50/40 hover:bg-primary-50/30 transition-colors items-center border-t border-neutral-100/60"
                  >
                    <div className="flex items-center gap-2.5 pl-9">
                      <UserAvatar user={employee} size="sm" />
                      <div className="text-left">
                        <p className="text-sm text-neutral-800 font-medium leading-tight">{employee.name}</p>
                        <p className="text-xs text-neutral-400">{employee.position}</p>
                      </div>
                    </div>
                    {/* 자기평가 상태 */}
                    <div className="flex justify-center">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${STATUS_CLS[selfStatus]}`}>
                        {STATUS_LABEL[selfStatus]}
                      </span>
                    </div>
                    {/* 매니저 평가 상태 */}
                    <div className="flex justify-center">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${STATUS_CLS[managerStatus]}`}>
                        {STATUS_LABEL[managerStatus]}
                      </span>
                    </div>
                    {/* 자기평가 점수 */}
                    <div className="text-right">
                      {selfSub?.overallRating
                        ? <span className="text-sm font-bold text-neutral-700">{selfSub.overallRating.toFixed(1)}</span>
                        : <span className="text-xs text-neutral-300">—</span>
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
