import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTeamStore } from '../../stores/teamStore';
import { createCycleSubmissions } from '../../utils/createCycleSubmissions';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatDate } from '../../utils/dateUtils';
import { ChevronLeft, Users, Calendar, BarChart2, X, Pencil, Check, Download, RefreshCw, AlertTriangle, Eye, Star, Trash2 } from 'lucide-react';
import { useShowToast } from '../../components/ui/Toast';
import { LoadingButton } from '../../components/ui/LoadingButton';
import { exportCycleToCSV } from '../../utils/exportUtils';
import { syncCycle } from '../../utils/sheetsSync';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';
import type { ReviewCycle, ReviewStatus, ReviewSubmission, ReviewTemplate, User } from '../../types';

// 상태 전환 정의
const STATUS_TRANSITIONS: Partial<Record<ReviewStatus, {
  next: ReviewStatus;
  label: string;
  isDanger: boolean;
  msg: string;
}>> = {
  draft: {
    next: 'self_review',
    label: '발행하기',
    isDanger: false,
    msg: '발행하면 대상 구성원들이 자기평가를 시작할 수 있습니다.',
  },
  self_review: {
    next: 'manager_review',
    label: '조직장 리뷰 시작',
    isDanger: false,
    msg: '자기평가 단계를 마감하고 조직장 하향리뷰 단계로 전환합니다.',
  },
  manager_review: {
    next: 'closed',
    label: '리뷰 종료',
    isDanger: true,
    msg: '모든 리뷰를 종료합니다. 종료 후에는 되돌릴 수 없습니다.',
  },
  active: {
    next: 'closed',
    label: '리뷰 종료',
    isDanger: true,
    msg: '모든 리뷰를 종료합니다. 종료 후에는 되돌릴 수 없습니다.',
  },
};

// ─── 편집 모달 ────────────────────────────────────────────────────────────────
function CycleEditModal({
  cycle,
  onSave,
  onClose,
}: {
  cycle: ReviewCycle;
  onSave: (updates: Partial<typeof cycle>) => void;
  onClose: () => void;
}) {
  const { users } = useTeamStore();
  const { templates } = useReviewStore();
  const departments = Array.from(new Set(users.filter(u => u.role !== 'admin').map(u => u.department))).sort();
  const toDateInput = (iso: string) => iso.slice(0, 10);

  const [form, setForm] = useState({
    title: cycle.title,
    type: cycle.type,
    templateId: cycle.templateId,
    targetDepartments: [...cycle.targetDepartments],
    selfReviewDeadline: toDateInput(cycle.selfReviewDeadline),
    managerReviewDeadline: toDateInput(cycle.managerReviewDeadline),
  });

  const targetMembers = users.filter(
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
              {templates.map(t => (
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
              {departments.map(dept => {
                const selected = form.targetDepartments.includes(dept);
                const count = users.filter(u => u.department === dept && u.role !== 'admin').length;
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

// ─── 제출 리뷰 조회 모달 ─────────────────────────────────────────────────────
const RATING_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

function SubmissionViewModal({
  member,
  selfSub,
  managerSub,
  reviewer,
  template,
  onClose,
}: {
  member: User;
  selfSub: ReviewSubmission | undefined;
  managerSub: ReviewSubmission | undefined;
  reviewer: User | undefined;
  template: ReviewTemplate | undefined;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'self' | 'manager'>(
    selfSub?.status === 'submitted' ? 'self' : 'manager'
  );

  const sub = tab === 'self' ? selfSub : managerSub;
  const questions = template?.questions ?? [];
  const visibleQuestions = questions.filter(q =>
    tab === 'self' ? q.target !== 'leader' : q.target !== 'self'
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-modal w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <UserAvatar user={member} size="sm" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">{member.name}</p>
              <p className="text-xs text-neutral-400">{member.position} · {member.department}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 px-5 py-2.5 border-b border-neutral-100 flex-shrink-0">
          {([
            { key: 'self', label: '자기평가', sub: selfSub },
            { key: 'manager', label: '매니저 리뷰', sub: managerSub },
          ] as const).map(({ key, label, sub: s }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === key
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {label}
              {s?.status === 'submitted'
                ? <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                : <span className="w-1.5 h-1.5 rounded-full bg-neutral-200" />}
            </button>
          ))}
          {tab === 'manager' && reviewer && (
            <span className="ml-auto text-xs text-neutral-400 self-center">작성자: {reviewer.name}</span>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {!sub || sub.status !== 'submitted' ? (
            <div className="py-12 text-center text-sm text-neutral-400">
              {sub?.status === 'in_progress' ? '작성 중입니다.' : '아직 제출되지 않았습니다.'}
            </div>
          ) : (
            <>
              {sub.overallRating != null && (
                <div className="flex items-center gap-2 px-4 py-3 bg-primary-50 rounded-xl">
                  <Star className="w-4 h-4 text-primary-500" />
                  <span className="text-sm font-semibold text-primary-700">
                    종합 평점 {sub.overallRating}점 — {RATING_LABELS[sub.overallRating] ?? ''}
                  </span>
                </div>
              )}
              {visibleQuestions.map((q, idx) => {
                const ans = sub.answers.find(a => a.questionId === q.id);
                return (
                  <div key={q.id} className="space-y-1.5">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                      Q{idx + 1}
                    </p>
                    <p className="text-sm font-medium text-neutral-800">{q.text}</p>
                    {q.type === 'rating' ? (
                      ans?.ratingValue != null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(n => (
                              <div
                                key={n}
                                className={`w-8 h-8 rounded-lg text-sm font-bold flex items-center justify-center ${
                                  n === ans.ratingValue
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-neutral-100 text-neutral-300'
                                }`}
                              >
                                {n}
                              </div>
                            ))}
                          </div>
                          <span className="text-xs text-neutral-500">{RATING_LABELS[ans.ratingValue]}</span>
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-300 italic">미응답</p>
                      )
                    ) : q.type === 'multiple_choice' ? (
                      ans?.textValue ? (
                        <div className="flex flex-wrap gap-1.5">
                          {ans.textValue.split(',').map(v => (
                            <span key={v} className="px-2.5 py-1 text-xs font-medium bg-primary-50 text-primary-700 rounded-full">
                              {v.trim()}
                            </span>
                          ))}
                        </div>
                      ) : <p className="text-sm text-neutral-300 italic">미응답</p>
                    ) : (
                      ans?.textValue
                        ? <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed bg-neutral-50 rounded-xl px-4 py-3">{ans.textValue}</p>
                        : <p className="text-sm text-neutral-300 italic">미응답</p>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-neutral-300 text-right">
                제출 {sub.submittedAt ? formatDate(sub.submittedAt) : '—'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CycleDetail() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const { cycles, submissions, updateCycle, deleteCycle, upsertSubmission, templates } = useReviewStore();
  const { users, orgUnits } = useTeamStore();
  const { addNotification } = useNotificationStore();
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showEdit, setShowEdit] = useState(searchParams.get('edit') === '1');
  const [syncing, setSyncing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  const targetMembers = users.filter(u => cycle.targetDepartments.includes(u.department) && u.role !== 'admin');

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
      showToast('info', '설정 > Google Sheets 연동에서 URL을 먼저 등록해주세요.');
      return;
    }
    const template = templates.find(t => t.id === cycle.templateId);
    if (!template) return;
    setSyncing(true);
    try {
      await syncCycle(cycle, submissions, template, users, scriptUrl);
      markSynced(cycle.id);
      showToast('success', 'Google Sheets 동기화가 완료되었습니다.');
    } catch {
      showToast('error', '동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncing(false);
    }
  };

  // CSV 내보내기
  const handleExport = () => {
    const template = templates.find(t => t.id === cycle.templateId);
    if (!template) { showToast('error', '템플릿 정보를 찾을 수 없습니다.'); return; }
    exportCycleToCSV(cycle, template, submissions, users);
    showToast('success', '스프레드시트로 내보내기를 시작합니다.');
  };

  // 사이클 상태 전환
  const transition = STATUS_TRANSITIONS[cycle.status];

  const handleTransition = async () => {
    if (!transition || transitioning) return;
    setTransitioning(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      // draft 발행 시 submission 일괄 생성
      if (cycle.status === 'draft') {
        const subs = createCycleSubmissions(cycle.id, targetMembers, users, orgUnits);
        subs.forEach(sub => upsertSubmission(sub));
      }
      // self_review → manager_review: 조직장에게 알림 발송
      if (cycle.status === 'self_review') {
        const leaderIds = new Set<string>();
        for (const m of targetMembers) {
          const mgr = users.find(u => u.id === m.managerId && u.role !== 'admin');
          if (mgr) { leaderIds.add(mgr.id); continue; }
          const org = orgUnits.find(o =>
            o.headId && o.headId !== m.id &&
            (o.name === m.department || o.name === m.subOrg || o.name === m.team || o.name === m.squad)
          );
          if (org?.headId) leaderIds.add(org.headId);
        }
        leaderIds.forEach((leaderId, i) => {
          addNotification({
            id: `mgr_review_${Date.now()}_${i}_${leaderId}`,
            userId: leaderId,
            title: '조직장 리뷰 단계 시작',
            message: `${cycle.title} 리뷰가 조직장 리뷰 단계로 전환되었습니다. 지금 팀원 평가를 작성해주세요.`,
            type: 'system',
            isRead: false,
            createdAt: new Date().toISOString(),
            actionUrl: '/reviews/team',
          });
        });
      }
      updateCycle(cycle.id, { status: transition.next });
      showToast('success', `${transition.label} 완료`);
      setShowConfirm(false);
    } finally {
      setTransitioning(false);
    }
  };

  // 제출 누락 구성원에게 재생성
  const handleRegenerateSubmissions = async () => {
    if (!cycle || regenerating) return;
    setRegenerating(true);
    await new Promise(r => setTimeout(r, 300));
    const subs = createCycleSubmissions(cycle.id, targetMembers, users, orgUnits);
    let added = 0;
    subs.forEach(sub => {
      const exists = submissions.some(s => s.id === sub.id);
      if (!exists) { upsertSubmission(sub); added++; }
    });
    setRegenerating(false);
    showToast('success', added > 0 ? `${added}건의 제출이 추가되었습니다.` : '누락된 제출이 없습니다.');
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
        {transition && (
          <button
            onClick={() => setShowConfirm(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
              transition.isDanger
                ? 'text-danger-600 border-danger-200 hover:bg-danger-50'
                : 'text-primary-600 border-primary-200 hover:bg-primary-50'
            }`}
          >
            {transition.label}
          </button>
        )}
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
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> 편집
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-danger-600 border border-danger-200 rounded hover:bg-danger-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      </div>

      {/* 상태 전환 확인 배너 */}
      {showConfirm && transition && (
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${
          transition.isDanger
            ? 'bg-danger-50 border-danger-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${transition.isDanger ? 'text-danger-500' : 'text-amber-500'}`} />
            <p className={`text-sm ${transition.isDanger ? 'text-danger-800' : 'text-amber-800'}`}>
              {transition.msg}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              취소
            </button>
            <LoadingButton
              loading={transitioning}
              onClick={handleTransition}
              className={`px-3 py-1.5 text-sm font-semibold text-white rounded transition-colors ${
                transition.isDanger
                  ? 'bg-danger-600 hover:bg-danger-700'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {transition.label}
            </LoadingButton>
          </div>
        </div>
      )}

      {/* 삭제 확인 배너 */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border bg-danger-50 border-danger-200">
          <div className="flex items-center gap-2 min-w-0">
            <Trash2 className="w-4 h-4 shrink-0 text-danger-500" />
            <p className="text-sm text-danger-800">
              <strong>"{cycle.title}"</strong> 리뷰와 모든 제출 데이터({submissions.filter(s => s.cycleId === cycle.id).length}건)가 영구 삭제됩니다. 되돌릴 수 없습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => {
                deleteCycle(cycle.id);
                showToast('success', '리뷰가 삭제되었습니다.');
                navigate('/cycles');
              }}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-danger-600 hover:bg-danger-700 rounded transition-colors"
            >
              삭제 확정
            </button>
          </div>
        </div>
      )}

      {/* 리뷰 조회 모달 */}
      {viewingMemberId && (() => {
        const member = users.find(u => u.id === viewingMemberId);
        if (!member) return null;
        const template = templates.find(t => t.id === cycle.templateId);
        const selfSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === viewingMemberId && s.type === 'self');
        const managerSub = submissions.find(s => s.cycleId === cycle.id && s.revieweeId === viewingMemberId && s.type === 'downward');
        const reviewer = managerSub ? users.find(u => u.id === managerSub.reviewerId) : undefined;
        return (
          <SubmissionViewModal
            member={member}
            selfSub={selfSub}
            managerSub={managerSub}
            reviewer={reviewer}
            template={template}
            onClose={() => setViewingMemberId(null)}
          />
        );
      })()}

      {/* 편집 모달 */}
      {showEdit && (
        <CycleEditModal
          cycle={cycle}
          onSave={(updates) => {
            updateCycle(cycle.id, updates);
            showToast('success', '리뷰가 수정되었습니다.');
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
          <div className="flex items-center gap-2">
            <p className="text-xs text-neutral-400">클릭하면 해당 부서 구성원만 표시됩니다</p>
            <button
              onClick={handleRegenerateSubmissions}
              disabled={regenerating}
              title="구성원 제출 누락 시 재생성"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-500 border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} />
              제출 재생성
            </button>
          </div>
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
        </div>
        <div className="space-y-1">
          {filteredMembers.map(member => {
            const { self, manager } = getMemberStatus(member.id);
            const hasAny = self === 'submitted' || manager === 'submitted' || self === 'in_progress' || manager === 'in_progress';
            return (
              <div
                key={member.id}
                className="group flex items-center gap-3 py-2.5 border-b border-neutral-50 last:border-0 rounded-xl px-1 hover:bg-neutral-50 transition-colors"
              >
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
                </div>
                {hasAny && (
                  <button
                    onClick={() => setViewingMemberId(member.id)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 border border-primary-200 bg-primary-50 hover:bg-primary-100 rounded-lg transition-all"
                  >
                    <Eye className="w-3 h-3" /> 리뷰 보기
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
