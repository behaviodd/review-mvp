import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGoalStore } from '../stores/goalStore';
import { useTeamStore } from '../stores/teamStore';
import { usePermission } from '../hooks/usePermission';
import { useShowToast } from '../components/ui/Toast';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDate } from '../utils/dateUtils';
import { Target } from 'lucide-react';
import { MsPlusIcon, MsCheckIcon, MsWarningIcon, MsClockIcon, MsCancelIcon } from '../components/ui/MsIcons';
import { MsButton } from '../components/ui/MsButton';
import type { GoalStatus } from '../types';

const STATUS_CONFIG: Record<GoalStatus, { label: string; icon: typeof MsCheckIcon; color: string; bg: string }> = {
  on_track: { label: '순조로움', icon: MsCheckIcon, color: 'text-success-600', bg: 'bg-success-50' },
  at_risk: { label: '주의 필요', icon: MsWarningIcon, color: 'text-primary-600', bg: 'bg-primary-50' },
  completed: { label: '완료', icon: MsCheckIcon, color: 'text-primary-600', bg: 'bg-primary-50' },
  cancelled: { label: '취소', icon: MsCancelIcon, color: 'text-neutral-400', bg: 'bg-neutral-100' },
};

interface GoalForm {
  title: string;
  description: string;
  dueDate: string;
  progress: number;
}

export function Goals() {
  const { currentUser } = useAuthStore();
  const { goals, addGoal, updateGoal } = useGoalStore();
  const { isLeader } = usePermission();
  const showToast = useShowToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id ?? '');
  const [form, setForm] = useState<GoalForm>({ title: '', description: '', dueDate: '', progress: 0 });

  const { users } = useTeamStore();
  const teamMembers = isLeader ? users.filter(u => u.managerId === currentUser?.id && u.isActive !== false) : [];
  const viewUserId = isLeader ? selectedUserId : currentUser?.id ?? '';
  const userGoals = goals.filter(g => g.userId === viewUserId);

  const handleAddGoal = () => {
    if (!form.title.trim()) { showToast('error', '목표 제목을 입력해주세요.'); return; }
    if (!form.dueDate) { showToast('error', '기한을 입력해주세요.'); return; }

    addGoal({
      id: `g_${Date.now()}`,
      userId: viewUserId,
      title: form.title,
      description: form.description,
      progress: form.progress,
      dueDate: form.dueDate,
      status: 'on_track',
    });
    showToast('success', '목표가 추가되었습니다!');
    setForm({ title: '', description: '', dueDate: '', progress: 0 });
    setShowForm(false);
  };

  const handleProgressUpdate = (id: string, progress: number) => {
    updateGoal(id, { progress, status: progress >= 100 ? 'completed' : 'on_track' });
  };

  const active = userGoals.filter(g => g.status !== 'completed' && g.status !== 'cancelled');
  const done = userGoals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">목표 관리</h1>
        <MsButton onClick={() => setShowForm(true)} leftIcon={<MsPlusIcon size={16} />}>목표 추가</MsButton>
      </div>

      {/* Manager: team member selector */}
      {isLeader && teamMembers.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedUserId(currentUser?.id ?? '')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${selectedUserId === currentUser?.id ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
          >
            내 목표
          </button>
          {teamMembers.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedUserId(m.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${selectedUserId === m.id ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Add goal form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-primary-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-800">새 목표 추가</h2>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-neutral-100 rounded-lg">
              <MsCancelIcon size={16} className="text-neutral-400" />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">목표 제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="달성하고 싶은 목표를 입력하세요"
              className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-lg bg-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">설명</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="목표에 대한 구체적인 설명 (선택)"
              className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-lg bg-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">기한 *</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-neutral-200 rounded-lg bg-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">초기 진행률: {form.progress}%</label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.progress}
                onChange={e => setForm(f => ({ ...f, progress: Number(e.target.value) }))}
                className="w-full mt-2.5 accent-primary-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <MsButton variant="default" onClick={() => setShowForm(false)} className="flex-1 h-auto py-2.5">취소</MsButton>
            <MsButton onClick={handleAddGoal} className="flex-1 h-auto py-2.5">추가</MsButton>
          </div>
        </div>
      )}

      {/* Goal list */}
      {userGoals.length === 0 ? (
        <EmptyState icon={Target} title="설정된 목표가 없습니다." description="목표를 추가하여 성장 방향을 설정해보세요." actionLabel="목표 추가" onAction={() => setShowForm(true)} />
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-500">진행 중 ({active.length})</h2>
              {active.map(goal => {
                const cfg = STATUS_CONFIG[goal.status];
                const Icon = cfg.icon;
                return (
                  <div key={goal.id} className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-3">
                        <h3 className="text-sm font-semibold text-neutral-900">{goal.title}</h3>
                        {goal.description && <p className="text-xs text-neutral-400 mt-0.5">{goal.description}</p>}
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 mb-3">
                      <MsClockIcon size={12} />
                      <span>기한: {formatDate(goal.dueDate)}</span>
                    </div>
                    <ProgressBar value={goal.progress} showPercent />
                    {viewUserId === currentUser?.id && (
                      <div className="mt-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={goal.progress}
                          onChange={e => handleProgressUpdate(goal.id, Number(e.target.value))}
                          className="w-full accent-primary-500"
                        />
                        <div className="flex justify-between text-xs text-neutral-300 mt-0.5">
                          <span>0%</span><span>50%</span><span>100%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-500">완료 ({done.length})</h2>
              {done.map(goal => (
                <div key={goal.id} className="bg-white rounded-xl border border-zinc-950/5 p-5 opacity-60">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-semibold text-neutral-600 line-through">{goal.title}</h3>
                    <span className="flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                      <MsCheckIcon size={12} /> 완료
                    </span>
                  </div>
                  <ProgressBar value={100} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
