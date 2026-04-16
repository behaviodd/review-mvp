import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useAuthStore } from '../../stores/authStore';
import { MOCK_TEMPLATES, MOCK_USERS } from '../../data/mockData';
import { useShowToast } from '../../components/ui/Toast';
import { useFieldValidation } from '../../hooks/useFieldValidation';
import { Check, ChevronLeft, ChevronRight, FileText, Users, Calendar, Eye, Rocket, PartyPopper } from 'lucide-react';
import { LoadingButton } from '../../components/ui/LoadingButton';

const STEPS = [
  { label: '기본 정보', icon: FileText },
  { label: '평가 템플릿', icon: FileText },
  { label: '대상 구성원', icon: Users },
  { label: '일정 설정', icon: Calendar },
  { label: '검토 및 발행', icon: Eye },
];

const DEPARTMENTS = ['개발팀', '디자인팀', '마케팅팀', '영업팀', '인사팀'];

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

export function CycleNew() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { addCycle, addTemplate } = useReviewStore();
  const showToast = useShowToast();

  const [step, setStep] = useState(0);
  const [published, setPublished] = useState(false);
  const [publishedTitle, setPublishedTitle] = useState('');
  const [publishedId, setPublishedId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [form, setForm] = useState<FormState>({
    title: '',
    type: 'scheduled',
    templateId: MOCK_TEMPLATES[0].id,
    targetDepartments: ['개발팀'],
    selfReviewDeadline: addDays(today, 14),
    managerReviewDeadline: addDays(today, 21),
    calibrationDeadline: addDays(today, 28),
  });

  const selectedTemplate = MOCK_TEMPLATES.find(t => t.id === form.templateId);
  const targetMembers = MOCK_USERS.filter(u => form.targetDepartments.includes(u.department) && u.role !== 'admin');

  const validationRules = useMemo(() => ({
    title: (v: unknown) => (String(v ?? '').trim().length < 2 ? '리뷰 이름은 2자 이상 입력해주세요.' : null),
    managerReviewDeadline: (v: unknown) => {
      if (!form.selfReviewDeadline || !v) return null;
      return new Date(v as string) <= new Date(form.selfReviewDeadline)
        ? '매니저 리뷰 마감일은 자기평가 마감일 이후여야 합니다.'
        : null;
    },
  }), [form.selfReviewDeadline]);

  const { errors: formErrors, validate, touch, clearError, resetErrors } = useFieldValidation(
    form as unknown as Record<string, unknown>,
    validationRules as Parameters<typeof useFieldValidation>[1],
  );

  const canNext = () => {
    if (step === 0) return form.title.trim().length >= 2;
    if (step === 1) return !!form.templateId;
    if (step === 2) return form.targetDepartments.length > 0;
    if (step === 3) return form.selfReviewDeadline && form.managerReviewDeadline;
    return true;
  };

  const handlePublish = async () => {
    if (!currentUser || publishing) return;
    setPublishing(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      const id = `cyc_${Date.now()}`;
      addCycle({
        id,
        title: form.title,
        type: form.type,
        status: 'self_review',
        templateId: form.templateId,
        targetDepartments: form.targetDepartments,
        selfReviewDeadline: new Date(form.selfReviewDeadline).toISOString(),
        managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        completionRate: 0,
      });
      showToast('리뷰가 발행되었습니다!', 'success');
      setPublishedTitle(form.title);
      setPublishedId(id);
      setPublished(true);
    } finally {
      setPublishing(false);
    }
  };

  if (published) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mx-auto">
          <PartyPopper className="w-10 h-10 text-success-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-neutral-900">리뷰가 발행되었습니다!</h1>
          <p className="text-neutral-500 text-sm">
            <span className="font-semibold text-neutral-700">"{publishedTitle}"</span> 리뷰가 성공적으로 시작되었습니다.<br />
            대상 구성원들에게 자기평가 시작 알림이 발송됩니다.
          </p>
        </div>
        <div className="bg-neutral-50 rounded-lg p-5 text-left space-y-3">
          {[
            { label: '자기평가 마감', value: form.selfReviewDeadline },
            { label: '매니저 리뷰 마감', value: form.managerReviewDeadline },
            { label: '대상 구성원', value: `${targetMembers.length}명` },
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
            className="w-full px-5 py-2.5 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
          >
            사이클 상세 보기 →
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/cycles')}
              className="flex-1 px-5 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-semibold rounded hover:bg-neutral-200 transition-colors"
            >
              리뷰 목록 보기
            </button>
            <button
              onClick={() => { setPublished(false); setPublishedId(''); setStep(0); setForm({ title: '', type: 'scheduled', templateId: MOCK_TEMPLATES[0].id, targetDepartments: ['개발팀'], selfReviewDeadline: addDays(today, 14), managerReviewDeadline: addDays(today, 21), calibrationDeadline: addDays(today, 28) }); }}
              className="flex-1 px-5 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-semibold rounded hover:bg-neutral-200 transition-colors"
            >
              새 리뷰 만들기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const done = i < step;
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

      {/* Step content */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-6 mb-5 min-h-[320px]">
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-neutral-900">기본 정보를 입력하세요</h2>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">리뷰 이름 <span className="text-danger-500">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={e => { setForm(f => ({ ...f, title: e.target.value })); clearError('title'); }}
                onBlur={() => touch('title')}
                placeholder="예: 2025년 하반기 성과 리뷰"
                className={`w-full px-3.5 py-2.5 border rounded bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:bg-white ${
                  formErrors.title
                    ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-100'
                    : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
                }`}
              />
              {formErrors.title && (
                <p className="mt-1 text-xs text-danger-600">{formErrors.title}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">리뷰 유형</label>
              <div className="flex gap-3">
                {([['scheduled', '정기 리뷰', '분기/반기 정기 평가'], ['adhoc', '수시 리뷰', '프로젝트 완료 후 수시 평가']] as const).map(([val, label, desc]) => (
                  <button
                    key={val}
                    type="button"
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

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">평가 템플릿을 선택하세요</h2>
            {MOCK_TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, templateId: t.id }))}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${form.templateId === t.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${form.templateId === t.id ? 'text-primary-700' : 'text-neutral-700'}`}>{t.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{t.description}</p>
                  </div>
                  <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded flex-shrink-0 ml-2">{t.questions.length}문항</span>
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

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-900">대상 부서를 선택하세요</h2>
            <div className="space-y-2">
              {DEPARTMENTS.map(dept => {
                const selected = form.targetDepartments.includes(dept);
                const memberCount = MOCK_USERS.filter(u => u.department === dept && u.role !== 'admin').length;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      targetDepartments: selected
                        ? f.targetDepartments.filter(d => d !== dept)
                        : [...f.targetDepartments, dept]
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
            {form.targetDepartments.length > 0 && (
              <p className="text-xs text-neutral-500 bg-neutral-50 px-3 py-2 rounded-xl">
                총 <strong className="text-neutral-800">{targetMembers.length}명</strong>의 구성원이 대상에 포함됩니다.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-neutral-900">일정을 설정하세요</h2>
            {[
              { key: 'selfReviewDeadline', label: '자기평가 마감일', required: true },
              { key: 'managerReviewDeadline', label: '매니저 리뷰 마감일', required: true },
              { key: 'calibrationDeadline', label: '조율 마감일 (선택)', required: false },
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
                    className={`w-full px-3.5 py-2.5 border rounded bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:bg-white ${
                      hasErr
                        ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-100'
                        : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
                    }`}
                  />
                  {hasErr && (
                    <p className="mt-1 text-xs text-danger-600">{formErrors.managerReviewDeadline}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-neutral-900">최종 검토 후 발행하세요</h2>
            <div className="space-y-3">
              {[
                { label: '리뷰 이름', value: form.title },
                { label: '유형', value: form.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰' },
                { label: '템플릿', value: selectedTemplate?.name ?? '-' },
                { label: '대상 부서', value: form.targetDepartments.join(', ') },
                { label: '대상 구성원', value: `${targetMembers.length}명` },
                { label: '자기평가 마감', value: form.selfReviewDeadline },
                { label: '매니저 리뷰 마감', value: form.managerReviewDeadline },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2.5 border-b border-neutral-100 last:border-0">
                  <span className="text-xs text-neutral-500 w-32 flex-shrink-0">{label}</span>
                  <span className="text-sm text-neutral-800 font-medium">{value}</span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl">
              <p className="text-sm font-semibold text-primary-800 mb-1 flex items-center gap-2">
                <Rocket className="w-4 h-4" /> 발행하면 즉시 시작됩니다
              </p>
              <p className="text-xs text-primary-600">대상 구성원에게 자기평가 시작 알림이 발송됩니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 px-5 py-4">
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/cycles')}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 rounded transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> {step === 0 ? '취소' : '이전'}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => {
              if (step === 0) { touch('title'); if (!canNext()) return; }
              if (step === 3) { touch('managerReviewDeadline'); if (!canNext()) return; }
              resetErrors();
              setStep(s => s + 1);
            }}
            disabled={!canNext()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            다음 <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <LoadingButton
            onClick={handlePublish}
            loading={publishing}
            className="px-4 py-2 bg-success-600 text-white text-sm font-medium rounded hover:bg-success-700"
          >
            {!publishing && <Rocket className="w-4 h-4" />} 발행하기
          </LoadingButton>
        )}
      </div>
    </div>
  );
}
