import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useShowToast } from '../../components/ui/Toast';
import { useFieldValidation } from '../../hooks/useFieldValidation';
import { createCycleSubmissions } from '../../utils/createCycleSubmissions';
import {
  Check, ChevronLeft, ChevronRight, FileText, Users,
  Calendar, Eye, Rocket, PartyPopper, Plus, RefreshCw, ChevronDown,
} from 'lucide-react';
import { LoadingButton } from '../../components/ui/LoadingButton';

const STEPS = [
  { label: '기본 정보',    icon: FileText },
  { label: '리뷰 템플릿',  icon: FileText },
  { label: '대상 구성원',  icon: Users    },
  { label: '일정 설정',    icon: Calendar },
  { label: '검토 및 발행', icon: Eye      },
];

interface FormState {
  title: string;
  type: 'scheduled' | 'adhoc';
  templateId: string;
  targetDepartments: string[];
  selfReviewDeadline: string;
  managerReviewDeadline: string;
  calibrationDeadline: string;
}

const today = new Date();
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().slice(0, 10);
};

const DRAFT_KEY = 'cycleWizardDraft';

const TYPE_LABEL: Record<string, string> = {
  text: '주관식', rating: '평점', competency: '역량', multiple_choice: '객관식',
};

export function CycleNew() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuthStore();
  const { addCycle, upsertSubmission, templates } = useReviewStore();
  const { users, isLoading: usersLoading } = useTeamStore();
  const showToast = useShowToast();

  useSetPageHeader('리뷰 사이클 생성');

  const departments = useMemo(
    () => Array.from(new Set(
      users.filter(u => u.role !== 'admin').map(u => u.department)
    )).sort(),
    [users],
  );

  const fromTemplateId = searchParams.get('templateId') ?? '';
  const newTemplateId  = searchParams.get('newTemplateId') ?? '';

  // 새 템플릿 만들고 돌아왔을 때 sessionStorage에서 위저드 초안 복원
  const restoredDraft = useMemo(() => {
    if (!newTemplateId) return null;
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as { form: FormState; step: number } | null; }
    catch { return null; }
  }, [newTemplateId]);

  const initialTemplateId = newTemplateId || fromTemplateId || (templates[0]?.id ?? '');

  const [step,           setStep]           = useState(restoredDraft?.step ?? 0);
  const [published,      setPublished]      = useState(false);
  const [publishedTitle, setPublishedTitle] = useState('');
  const [publishedId,    setPublishedId]    = useState('');
  const [publishedCount, setPublishedCount] = useState({ members: 0, submissions: 0 });
  const [publishing,     setPublishing]     = useState(false);
  const [templateLocked, setTemplateLocked] = useState(!!fromTemplateId || !!newTemplateId);
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);

  const [form, setForm] = useState<FormState>(
    restoredDraft?.form ?? {
      title:                 '',
      type:                  'scheduled',
      templateId:            initialTemplateId,
      targetDepartments:     [],
      selfReviewDeadline:    addDays(today, 14),
      managerReviewDeadline: addDays(today, 21),
      calibrationDeadline:   addDays(today, 28),
    },
  );

  // 새 템플릿 복귀 시: 새 템플릿 자동 선택 + sessionStorage 정리
  useEffect(() => {
    if (newTemplateId && restoredDraft) {
      setForm(f => ({ ...f, templateId: newTemplateId }));
      sessionStorage.removeItem(DRAFT_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplate = templates.find(t => t.id === form.templateId);

  const targetMembers = useMemo(
    () => users.filter(u => form.targetDepartments.includes(u.department) && u.role !== 'admin'),
    [users, form.targetDepartments],
  );

  const previewSubmissions = useMemo(
    () => createCycleSubmissions('preview', targetMembers, users),
    [targetMembers, users],
  );
  const selfCount = previewSubmissions.filter(s => s.type === 'self').length;
  const downCount = previewSubmissions.filter(s => s.type === 'downward').length;

  /* ── 유효성 검사 ─────────────────────────────────────────── */
  const validationRules = useMemo(() => ({
    title: (v: unknown) =>
      String(v ?? '').trim().length < 2 ? '리뷰 이름은 2자 이상 입력해주세요.' : null,
    managerReviewDeadline: (v: unknown) => {
      if (!form.selfReviewDeadline || !v) return null;
      return new Date(v as string) <= new Date(form.selfReviewDeadline)
        ? '매니저 리뷰 마감일은 자기평가 마감일 이후여야 합니다.'
        : null;
    },
  }), [form.selfReviewDeadline]);

  const { errors: formErrors, touch, clearError, resetErrors } = useFieldValidation(
    form as unknown as Record<string, unknown>,
    validationRules as Parameters<typeof useFieldValidation>[1],
  );

  const canNext = () => {
    if (step === 0) return form.title.trim().length >= 2;
    if (step === 1) return !!form.templateId;
    if (step === 2) return form.targetDepartments.length > 0;
    if (step === 3) return !!(form.selfReviewDeadline && form.managerReviewDeadline);
    return true;
  };

  // 새 템플릿 만들기: 위저드 상태 저장 후 이동
  const handleGoCreateTemplate = () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step: 1 }));
    navigate('/templates/new?returnTo=cycle-wizard');
  };

  /* ── 발행 ─────────────────────────────────────────────────── */
  const handlePublish = async () => {
    if (!currentUser || publishing) return;
    setPublishing(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const cycleId = `cyc_${Date.now()}`;

      addCycle({
        id:                    cycleId,
        title:                 form.title,
        type:                  form.type,
        status:                'self_review',
        templateId:            form.templateId,
        targetDepartments:     form.targetDepartments,
        selfReviewDeadline:    new Date(form.selfReviewDeadline).toISOString(),
        managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
        createdBy:             currentUser.id,
        createdAt:             new Date().toISOString(),
        completionRate:        0,
      });

      const subs = createCycleSubmissions(cycleId, targetMembers, users);
      subs.forEach(sub => upsertSubmission(sub));

      showToast('success', `리뷰 발행 완료 · 제출 ${subs.length}건 생성`);
      setPublishedTitle(form.title);
      setPublishedId(cycleId);
      setPublishedCount({ members: targetMembers.length, submissions: subs.length });
      setPublished(true);
    } finally {
      setPublishing(false);
      setConfirmOpen(false);
    }
  };

  /* ── 발행 완료 화면 ──────────────────────────────────────── */
  if (published) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mx-auto">
          <PartyPopper className="w-10 h-10 text-success-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-neutral-900">리뷰가 발행되었습니다!</h1>
          <p className="text-neutral-500 text-sm">
            <span className="font-semibold text-neutral-700">"{publishedTitle}"</span> 리뷰가 성공적으로 시작되었습니다.
          </p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-5 text-left space-y-3">
          {[
            { label: '자기평가 마감',    value: form.selfReviewDeadline },
            { label: '매니저 리뷰 마감', value: form.managerReviewDeadline },
            { label: '대상 구성원',      value: `${publishedCount.members}명` },
            { label: '생성된 제출 건',   value: `자기평가 ${selfCount}건 · 매니저 평가 ${downCount}건` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="text-neutral-400 w-32 flex-shrink-0">{label}</span>
              <span className="font-medium text-neutral-800">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => navigate(`/cycles/${publishedId}`)}
            className="w-full px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            리뷰 상세보기 →
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/cycles')}
              className="flex-1 px-5 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
            >
              리뷰 목록 보기
            </button>
            <button
              onClick={() => {
                setPublished(false);
                setPublishedId('');
                setStep(0);
                setTemplateLocked(false);
                setForm({
                  title: '', type: 'scheduled', templateId: templates[0]?.id ?? '',
                  targetDepartments:     [],
                  selfReviewDeadline:    addDays(today, 14),
                  managerReviewDeadline: addDays(today, 21),
                  calibrationDeadline:   addDays(today, 28),
                });
              }}
              className="flex-1 px-5 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
            >
              새 리뷰 만들기
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 스텝 화면 ──────────────────────────────────────────── */
  return (
    <div className="w-full">
      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const done    = i < step;
          const current = i === step;
          return (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? 'bg-success-500 text-white' : current ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-400'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-xs whitespace-nowrap ${current ? 'text-primary-700 font-semibold' : done ? 'text-success-600' : 'text-neutral-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-5 mx-1 ${done ? 'bg-success-400' : 'bg-neutral-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* 스텝 콘텐츠 */}
      <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-6 mb-5 min-h-[320px]">

        {/* Step 0: 기본 정보 */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-neutral-900">기본 정보를 입력하세요</h2>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                리뷰 이름 <span className="text-danger-500">*</span>
              </label>
              <input
                type="text" value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); clearError('title'); }}
                onBlur={() => touch('title')}
                placeholder="예: 2025년 하반기 성과 리뷰"
                className={`w-full px-3.5 py-2.5 border rounded-lg bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:bg-white ${
                  formErrors.title
                    ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-100'
                    : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
                }`}
              />
              {formErrors.title && <p className="mt-1 text-xs text-danger-600">{formErrors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">리뷰 유형</label>
              <div className="flex gap-3">
                {([
                  ['scheduled', '정기 리뷰',  '분기/반기 정기 평가'],
                  ['adhoc',     '수시 리뷰',  '프로젝트 완료 후 수시 평가'],
                ] as const).map(([val, label, desc]) => (
                  <button
                    key={val} type="button"
                    onClick={() => setForm(f => ({ ...f, type: val }))}
                    className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${form.type === val ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    <p className={`text-sm font-semibold ${form.type === val ? 'text-primary-700' : 'text-neutral-700'}`}>{label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: 템플릿 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">리뷰 템플릿 선택</h2>
              <button
                type="button"
                onClick={handleGoCreateTemplate}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> 새 템플릿 만들기
              </button>
            </div>

            {/* 템플릿에서 진입: 선택된 템플릿 확인 카드 */}
            {templateLocked && selectedTemplate ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl border-2 border-primary-500 bg-primary-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-primary-800">{selectedTemplate.name}</p>
                        <p className="text-xs text-primary-600 mt-0.5">{selectedTemplate.description}</p>
                        <p className="text-xs text-primary-500 mt-1">{selectedTemplate.questions.length}문항</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTemplateLocked(false)}
                      className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 flex-shrink-0 ml-2"
                    >
                      <RefreshCw className="w-3 h-3" /> 변경
                    </button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-primary-100 space-y-1">
                    {selectedTemplate.questions.slice(0, 3).map(q => (
                      <p key={q.id} className="text-xs text-primary-600">• {q.text}</p>
                    ))}
                    {selectedTemplate.questions.length > 3 && (
                      <p className="text-xs text-primary-400">+{selectedTemplate.questions.length - 3}개 더...</p>
                    )}
                  </div>
                </div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <FileText className="w-10 h-10 text-neutral-200 mx-auto" />
                <p className="text-sm text-neutral-500 font-medium">저장된 템플릿이 없습니다</p>
                <p className="text-xs text-neutral-400">템플릿을 먼저 만들어야 리뷰를 생성할 수 있습니다.</p>
                <button
                  type="button"
                  onClick={handleGoCreateTemplate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> 새 템플릿 만들기
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map(t => (
                  <button
                    key={t.id} type="button"
                    onClick={() => { setForm(f => ({ ...f, templateId: t.id })); setTemplateLocked(false); }}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${form.templateId === t.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-sm font-semibold ${form.templateId === t.id ? 'text-primary-700' : 'text-neutral-700'}`}>{t.name}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{t.description}</p>
                      </div>
                      <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded flex-shrink-0 ml-2">
                        {t.questions.length}문항
                      </span>
                    </div>
                    {form.templateId === t.id && (
                      <div className="mt-3 pt-3 border-t border-primary-100 space-y-1">
                        {t.questions.slice(0, 3).map(q => (
                          <p key={q.id} className="text-xs text-primary-600">• {q.text}</p>
                        ))}
                        {t.questions.length > 3 && (
                          <p className="text-xs text-primary-400">+{t.questions.length - 3}개 더...</p>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: 대상 부서 */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">대상 부서를 선택하세요</h2>
            {departments.length === 0 && (
              <p className="text-sm text-neutral-400 py-4">등록된 부서가 없습니다. 팀 구성에서 구성원을 추가해주세요.</p>
            )}
            <div className="space-y-2">
              {departments.map(dept => {
                const selected    = form.targetDepartments.includes(dept);
                const memberCount = users.filter(u => u.department === dept && u.role !== 'admin').length;
                return (
                  <button
                    key={dept} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      targetDepartments: selected
                        ? f.targetDepartments.filter(d => d !== dept)
                        : [...f.targetDepartments, dept],
                    }))}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${selected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'}`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-primary-500' : 'border-2 border-neutral-300'}`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${selected ? 'text-primary-700' : 'text-neutral-700'}`}>{dept}</p>
                    </div>
                    <span className="text-xs text-neutral-400">{memberCount}명</span>
                  </button>
                );
              })}
            </div>
            {targetMembers.length > 0 && (
              <div className="bg-neutral-50 px-3 py-2.5 rounded-xl space-y-1">
                <p className="text-xs text-neutral-500">
                  총 <strong className="text-neutral-800">{targetMembers.length}명</strong> 대상
                </p>
                <p className="text-xs text-neutral-400">
                  자기평가 {selfCount}건 · 매니저 하향 평가 {downCount}건 자동 생성됩니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: 일정 */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-neutral-900">일정을 설정하세요</h2>
            {[
              { key: 'selfReviewDeadline',    label: '자기평가 마감일',       required: true  },
              { key: 'managerReviewDeadline', label: '매니저 리뷰 마감일',    required: true  },
              { key: 'calibrationDeadline',   label: '조율 마감일 (선택)',    required: false },
            ].map(({ key, label, required }) => {
              const hasErr = key === 'managerReviewDeadline' && !!formErrors.managerReviewDeadline;
              return (
                <div key={key}>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    {label} {required && <span className="text-danger-500">*</span>}
                  </label>
                  <input
                    type="date"
                    value={form[key as keyof FormState] as string}
                    onChange={e => {
                      setForm(f => ({ ...f, [key]: e.target.value }));
                      if (key === 'managerReviewDeadline') clearError('managerReviewDeadline');
                    }}
                    onBlur={() => { if (key === 'managerReviewDeadline') touch('managerReviewDeadline'); }}
                    className={`w-full px-3.5 py-2.5 border rounded-lg bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:bg-white ${
                      hasErr
                        ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-100'
                        : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
                    }`}
                  />
                  {hasErr && <p className="mt-1 text-xs text-danger-600">{formErrors.managerReviewDeadline}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Step 4: 최종 검토 */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-neutral-900">최종 검토 후 발행하세요</h2>
            <div className="space-y-0">
              {[
                { label: '리뷰 이름',        value: form.title },
                { label: '유형',             value: form.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰' },
                { label: '템플릿',           value: selectedTemplate?.name ?? '-' },
                { label: '대상 부서',        value: form.targetDepartments.join(', ') || '-' },
                { label: '대상 구성원',      value: `${targetMembers.length}명` },
                { label: '자기평가',         value: `${selfCount}건 생성` },
                { label: '매니저 평가',      value: `${downCount}건 생성` },
                { label: '자기평가 마감',    value: form.selfReviewDeadline },
                { label: '매니저 평가 마감', value: form.managerReviewDeadline },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-0">
                  <span className="text-xs text-neutral-500 w-32 flex-shrink-0">{label}</span>
                  <span className="text-sm text-neutral-800 font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* 템플릿 문항 미리보기 (접기/펼치기) */}
            {selectedTemplate && (
              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTemplatePreviewOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors text-sm font-medium text-neutral-700"
                >
                  <span>템플릿 문항 전체 보기 ({selectedTemplate.questions.length}개)</span>
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${templatePreviewOpen ? 'rotate-180' : ''}`} />
                </button>
                {templatePreviewOpen && (
                  <div className="divide-y divide-neutral-100">
                    {selectedTemplate.questions.map((q, idx) => (
                      <div key={q.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-neutral-400 w-5 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-800">{q.text}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                q.type === 'text' ? 'bg-blue-50 text-blue-600'
                                : q.type === 'rating' ? 'bg-amber-50 text-amber-600'
                                : q.type === 'competency' ? 'bg-purple-50 text-purple-600'
                                : 'bg-green-50 text-green-600'
                              }`}>
                                {TYPE_LABEL[q.type] ?? q.type}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${q.target === 'self' ? 'bg-neutral-100 text-neutral-500' : q.target === 'leader' ? 'bg-orange-50 text-orange-600' : 'bg-teal-50 text-teal-600'}`}>
                                {q.target === 'self' ? '자기평가' : q.target === 'leader' ? '리더 평가' : '공통'}
                              </span>
                              {q.isPrivate && <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-400">비공개</span>}
                              {q.isRequired && <span className="text-xs text-danger-400">필수</span>}
                            </div>
                            {q.type === 'rating' && q.ratingScale && (
                              <p className="text-xs text-neutral-400 mt-1">{q.ratingScale}점 척도</p>
                            )}
                            {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {q.options.map((opt, oi) => (
                                  <span key={oi} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">{opt}</span>
                                ))}
                                {q.allowMultiple && <span className="text-xs text-green-600 ml-1">복수 선택 가능</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl">
              <p className="text-sm font-semibold text-primary-800 mb-1 flex items-center gap-2">
                <Rocket className="w-4 h-4" /> 발행하면 즉시 시작됩니다
              </p>
              <p className="text-xs text-primary-600">
                {targetMembers.length}명의 자기평가 + {downCount}건의 매니저 평가가 자동으로 배정됩니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-zinc-950/5 px-5 py-4">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/cycles')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? '취소' : '이전'}
        </button>

        {step < STEPS.length - 1 ? (
          step === 1 && templates.length === 0 ? (
            <button
              type="button"
              onClick={handleGoCreateTemplate}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 템플릿 만들기
            </button>
          ) : (
            <button
              onClick={() => {
                if (step === 0) { touch('title'); if (!canNext()) return; }
                if (step === 3) { touch('managerReviewDeadline'); if (!canNext()) return; }
                resetErrors();
                setStep(s => s + 1);
              }}
              disabled={!canNext()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          )
        ) : (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={usersLoading || targetMembers.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-success-600 text-white text-sm font-medium rounded-lg hover:bg-success-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Rocket className="w-4 h-4" />
            {usersLoading ? '구성원 로딩 중...' : targetMembers.length === 0 ? '대상 구성원 없음' : '발행하기'}
          </button>
        )}
      </div>

      {/* 발행 확인 다이얼로그 */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-warning-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Rocket className="w-5 h-5 text-warning-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-900">리뷰를 발행하시겠습니까?</h3>
                <p className="text-xs text-neutral-500 mt-0.5">발행 후에는 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-neutral-400 w-28 flex-shrink-0">리뷰 이름</span>
                <span className="font-medium text-neutral-800">{form.title}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-neutral-400 w-28 flex-shrink-0">대상 구성원</span>
                <span className="font-medium text-neutral-800">{targetMembers.length}명</span>
              </div>
              <div className="flex gap-3">
                <span className="text-neutral-400 w-28 flex-shrink-0">생성될 제출 건</span>
                <span className="font-medium text-neutral-800">자기평가 {selfCount}건 · 매니저 평가 {downCount}건</span>
              </div>
            </div>
            <p className="text-xs text-danger-600 bg-danger-50 px-3 py-2 rounded-lg">
              ⚠ 발행된 리뷰는 즉시 구성원에게 배정되며 수정이 불가합니다.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors"
              >
                취소
              </button>
              <LoadingButton
                onClick={handlePublish}
                loading={publishing}
                className="flex-1 px-4 py-2.5 bg-success-600 text-white text-sm font-medium rounded-lg hover:bg-success-700"
              >
                {!publishing && <Rocket className="w-4 h-4" />}
                발행하기
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
