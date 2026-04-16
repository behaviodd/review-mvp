import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { MOCK_USERS, MOCK_TEMPLATES } from '../../data/mockData';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatDate } from '../../utils/dateUtils';
import { ChevronLeft, Bell, Users, Calendar, BarChart2, X, Pencil, Check, Download, RefreshCw } from 'lucide-react';
import { useShowToast } from '../../components/ui/Toast';
import { exportCycleToCSV } from '../../utils/exportUtils';
import { syncCycle } from '../../utils/sheetsSync';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';

const DEPARTMENTS = ['개발팀', '디자인팀', '마케팅팀', '영업팀', '인사팀'];

// ─── 편집 모달 ────────────────────────────────────────────────────────────────
function CycleEditModal({
  cycle,
  onSave,
  onClose,
}: {
  cycle: ReturnType<typeof import('../../stores/reviewStore').useReviewStore>['cycles'][0];
  onSave: (updates: Partial<typeof cycle>) => void;
  onClose: () => void;
}) {
  const toDateInput = (iso: string) => iso.slice(0, 10);

  const [form, setForm] = useState({
    title: cycle.title,
    type: cycle.type,
    templateId: cycle.templateId,
    targetDepartments: [...cycle.targetDepartments],
    selfReviewDeadline: toDateInput(cycle.selfReviewDeadline),
    managerReviewDeadline: toDateInput(cycle.managerReviewDeadline),
  });

  const targetMembers = MOCK_USERS.filter(
    u => form.targetDepartments.includes(u.department) && u.role !== 'admin'
  );

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({
      title: form.title,
      type: form.type,
      templateId: form.templateId,
      targetDepartments: form.targetDepartments,
      selfReviewDeadline: new Date(form.selfReviewDeadline).toISOString(),
      managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
    });
  };

  const toggleDept = (dept: string) =>
    setForm(f => ({
      ...f,
      targetDepartments: f.targetDepartments.includes(dept)
        ? f.targetDepartments.filter(d => d !== dept)
        : [...f.targetDepartments, dept],
    }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-modal w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">리뷰 편집</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* 리뷰 이름 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
              리뷰 이름 <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-200 rounded bg-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
            />
          </div>

          {/* 리뷰 유형 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">리뷰 유형</label>
            <div className="flex gap-2">
              {([['scheduled', '정기 리뷰'], ['adhoc', '수시 리뷰']] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: val }))}
                  className={`flex-1 py-2 rounded border-2 text-sm font-medium transition-all ${
                    form.type === val
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 평가 템플릿 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">평가 템플릿</label>
            <div className="space-y-2">
              {MOCK_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, templateId: t.id }))}
                  className={`w-full flex items-center justify-between p-3 rounded border-2 text-left transition-all ${
                    form.templateId === t.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${form.templateId === t.id ? 'text-primary-700' : 'text-neutral-700'}`}>
                      {t.name}
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">{t.questions.length}문항</span>
                    {form.templateId === t.id && <Check className="w-4 h-4 text-primary-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 대상 부서 */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">대상 부서</label>
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.map(dept => {
                const selected = form.targetDepartments.includes(dept);
                const count = MOCK_USERS.filter(u => u.department === dept && u.role !== 'admin').length;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all ${
                      selected
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {dept}
                    <span className="text-neutral-400">{count}명</span>
                  </button>
                );
              })}
            </div>
            {form.targetDepartments.length > 0 && (
              <p className="text-xs text-neutral-400 mt-2">
                총 <strong className="text-neutral-700">{targetMembers.length}명</strong> 포함
              </p>
            )}
          </div>

          {/* 일정 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                자기평가 마감일 <span className="text-danger-500">*</span>
              </label>
              <input
                type="date"
                value={form.selfReviewDeadline}
                onChange={e => setForm(f => ({ ...f, selfReviewDeadline: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-200 rounded bg-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                매니저 리뷰 마감일 <span className="text-danger-500">*</span>
              </label>
              <input
                type="date"
                value={form.managerReviewDeadline}
                onChange={e => setForm(f => ({ ...f, managerReviewDeadline: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-200 rounded bg-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim() || form.targetDepartments.length === 0}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}

export function CycleDetail() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const { cycles, submissions, updateCycle } = useReviewStore();
  const { addNotification } = useNotificationStore();
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showEdit, setShowEdit] = useState(searchParams.get('edit') === '1');
  const [syncing, setSyncing] = useState(false);
  const { scriptUrl, enabled, markSynced, lastSyncAt } = useSheetsSyncStore();

  useEffect(() => {
    if (searchParams.get('edit') === '1') {
      setShowEdit(true);
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cycle = cycles.find(c => c.id === cycleId);
  if (!cycle) {
    return <div className="text-center py-20 text-neutral-400">리뷰를 찾을 수 없습니다.</div>;
  }

  const targetMembers = MOCK_USERS.filter(u => cycle.targetDepartments.includes(u.department) && u.role !== 'admin');

  const getMemberStatus = (userId: string) => {
    const selfSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === userId && s.type === 'self');
    const managerSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === userId && s.type === 'downward');
    return { self: selfSub?.status ?? 'not_started', manager: managerSub?.status ?? 'not_started' };
  };

  const selfSubmitted = targetMembers.filter(m => getMemberStatus(m.id).self === 'submitted').length;
  const managerSubmitted = targetMembers.filter(m => getMemberStatus(m.id).manager === 'submitted').length;

  const byDept = cycle.targetDepartments.map(dept => {
    const members = targetMembers.filter(m => m.department === dept);
    const submitted = members.filter(m => getMemberStatus(m.id).self === 'submitted').length;
    return { dept, members, submitted, rate: members.length ? Math.round((submitted / members.length) * 100) : 0 };
  });

  const filteredMembers = selectedDept
    ? targetMembers.filter(m => m.department === selectedDept)
    : targetMembers;

  // Google Sheets 전체 동기화
  const handleSheetSync = async () => {
    if (!scriptUrl) {
      showToast('설정 > Google Sheets 연동에서 URL을 먼저 등록해주세요.', 'info');
      return;
    }
    const template = MOCK_TEMPLATES.find(t => t.id === cycle.templateId);
    if (!template) return;
    setSyncing(true);
    try {
      await syncCycle(cycle, submissions, template, MOCK_USERS, scriptUrl);
      markSynced(cycle.id);
      showToast('Google Sheets 동기화가 완료되었습니다.', 'success');
    } catch {
      showToast('동기화 중 오류가 발생했습니다.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // CSV 내보내기
  const handleExport = () => {
    const template = MOCK_TEMPLATES.find(t => t.id === cycle.templateId);
    if (!template) { showToast('템플릿 정보를 찾을 수 없습니다.', 'error'); return; }
    exportCycleToCSV(cycle, template, submissions, MOCK_USERS);
    showToast('스프레드시트로 내보내기를 시작합니다.', 'success');
  };

  // 전체 미완료자 일괄 독촉
  const handleNudgeAll = () => {
    const pending = filteredMembers.filter(m => getMemberStatus(m.id).self !== 'submitted');
    pending.forEach((m, i) => {
      const sub = submissions.find(
        s => s.cycleId === cycle.id && s.revieweeId === m.id && s.type === 'self'
      );
      addNotification({
        id: `nudge_${Date.now()}_${i}_${m.id}`,
        userId: m.id,
        title: '리뷰 작성 독촉',
        message: `${cycle.title} 마감이 다가오고 있습니다. 지금 바로 작성해 주세요!`,
        type: 'nudge',
        isRead: false,
        createdAt: new Date().toISOString(),
        actionUrl: sub ? `/reviews/me/${sub.id}` : '/reviews/me',
      });
    });
    showToast(`${pending.length}명에게 독촉 알림을 발송했습니다.`, 'success');
  };

  // 개별 독촉
  const handleNudgeMember = (memberId: string, memberName: string) => {
    const sub = submissions.find(
      s => s.cycleId === cycle.id && s.revieweeId === memberId && s.type === 'self'
    );
    addNotification({
      id: `nudge_${Date.now()}_${memberId}`,
      userId: memberId,
      title: '리뷰 작성 독촉',
      message: `${cycle.title} 마감이 다가오고 있습니다. 지금 바로 작성해 주세요!`,
      type: 'nudge',
      isRead: false,
      createdAt: new Date().toISOString(),
      actionUrl: sub ? `/reviews/me/${sub.id}` : '/reviews/me',
    });
    showToast(`${memberName}님에게 독촉 알림을 발송했습니다.`, 'success');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cycles')} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-neutral-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-neutral-900">{cycle.title}</h1>
          <p className="text-xs text-neutral-400">{cycle.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰'} · 생성 {formatDate(cycle.createdAt)}</p>
        </div>
        <StatusBadge type="review" value={cycle.status} />
        {enabled && (
          <button
            onClick={handleSheetSync}
            disabled={syncing}
            title={lastSyncAt[cycle.id] ? `마지막 동기화: ${new Date(lastSyncAt[cycle.id]).toLocaleString('ko-KR')}` : '시트 동기화'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-success-700 border border-success-200 bg-success-50 rounded hover:bg-success-100 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '동기화 중…' : '시트 동기화'}
          </button>
        )}
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> 내보내기
        </button>
        {cycle.status !== 'closed' && (
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> 편집
          </button>
        )}
      </div>

      {/* 편집 모달 */}
      {showEdit && (
        <CycleEditModal
          cycle={cycle}
          onSave={(updates) => {
            updateCycle(cycle.id, updates);
            showToast('리뷰가 수정되었습니다.', 'success');
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: '총 대상', value: `${targetMembers.length}명`, sub: `${cycle.targetDepartments.join(', ')}` },
          { icon: BarChart2, label: '자기평가 완료', value: `${selfSubmitted}/${targetMembers.length}`, sub: `${Math.round((selfSubmitted / (targetMembers.length || 1)) * 100)}%` },
          { icon: BarChart2, label: '매니저 리뷰 완료', value: `${managerSubmitted}/${targetMembers.length}`, sub: `${Math.round((managerSubmitted / (targetMembers.length || 1)) * 100)}%` },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-neutral-200 shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4 text-neutral-400" />
              <span className="text-xs text-neutral-500">{label}</span>
            </div>
            <p className="text-xl font-semibold text-neutral-900">{value}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> 일정</h2>
        <div className="space-y-3">
          {[
            { label: '자기평가 마감', date: cycle.selfReviewDeadline, highlight: cycle.status === 'self_review' },
            { label: '매니저 리뷰 마감', date: cycle.managerReviewDeadline, highlight: cycle.status === 'manager_review' },
          ].map(({ label, date, highlight }) => (
            <div key={label} className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${highlight ? 'bg-primary-50' : ''}`}>
              <span className={`text-sm ${highlight ? 'font-semibold text-primary-700' : 'text-neutral-600'}`}>{label}</span>
              <span className={`text-sm font-medium ${highlight ? 'text-primary-600' : 'text-neutral-500'}`}>{formatDate(date)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Department breakdown */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-700">부서별 진행 현황</h2>
          <p className="text-xs text-neutral-400">클릭하면 해당 부서 구성원만 표시됩니다</p>
        </div>
        <div className="space-y-3">
          {byDept.map(({ dept, members, submitted, rate }) => {
            const isSelected = selectedDept === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(d => d === dept ? null : dept)}
                className={`w-full text-left rounded-xl px-3 py-2.5 transition-all border ${
                  isSelected
                    ? 'bg-primary-50 border-primary-200'
                    : 'border-transparent hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-sm font-medium ${isSelected ? 'text-primary-700' : 'text-neutral-700'}`}>
                    {dept}
                  </span>
                  <span className="text-xs text-neutral-500">{submitted}/{members.length}명 완료</span>
                </div>
                <ProgressBar value={rate} showPercent />
              </button>
            );
          })}
        </div>
      </div>

      {/* Member list */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">구성원별 현황</h2>
            {selectedDept && (
              <span className="flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                {selectedDept}
                <button onClick={() => setSelectedDept(null)} className="hover:text-primary-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
          {cycle.status !== 'closed' && (
            <button
              onClick={handleNudgeAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
            >
              <Bell className="w-3.5 h-3.5" /> {selectedDept ? `${selectedDept} 독촉` : '미완료자 독촉'}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {filteredMembers.map(member => {
            const { self, manager } = getMemberStatus(member.id);
            const isPending = self !== 'submitted' && cycle.status !== 'closed';
            return (
              <div key={member.id} className="group flex items-center gap-3 py-2.5 border-b border-neutral-50 last:border-0 rounded-xl px-1 hover:bg-neutral-50 transition-colors">
                <UserAvatar user={member} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800">{member.name}</p>
                  <p className="text-xs text-neutral-400">{member.position} · {member.department}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-neutral-400">자기평가</span>
                    <StatusBadge type="submission" value={self} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-neutral-400">매니저</span>
                    <StatusBadge type="submission" value={manager} />
                  </div>
                  {isPending && (
                    <button
                      onClick={() => handleNudgeMember(member.id, member.name)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-all"
                    >
                      <Bell className="w-3 h-3" /> 독촉
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
