import { useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useShowToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../stores/authStore';
import { AlignLeft, List, BarChart2, Brain } from 'lucide-react';
import {
  MsChevronLeftLineIcon, MsPlusIcon, MsDeleteIcon, MsGrabIcon,
  MsLockIcon, MsCancelIcon, MsCheckIcon, MsEditIcon,
} from '../../components/ui/MsIcons';
import type { TemplateQuestion, TemplateSection } from '../../types';
import { MsButton } from '../../components/ui/MsButton';
import { MsCheckbox, MsInput } from '../../components/ui/MsControl';

/* ── helpers ──────────────────────────────────────────────── */

const TYPES = [
  { val: 'text',            label: '주관식', icon: AlignLeft,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { val: 'multiple_choice', label: '객관식', icon: List,       color: 'text-green-600',  bg: 'bg-green-50'  },
  { val: 'rating',          label: '평점',   icon: BarChart2,  color: 'text-amber-600',  bg: 'bg-amber-50'  },
  { val: 'competency',      label: '역량',   icon: Brain,      color: 'text-purple-600', bg: 'bg-purple-50' },
] as const;

const TARGETS = [
  { val: 'both',   label: '공통'    },
  { val: 'self',   label: '자기평가' },
  { val: 'leader', label: '매니저'  },
] as const;

const typeInfo = (val: string) => TYPES.find(t => t.val === val) ?? TYPES[0];

const newQuestion = (order: number, sectionId: string): TemplateQuestion => ({
  id: `q_${Date.now()}_${order}`,
  text: '',
  type: 'text',
  target: 'both',
  isPrivate: false,
  isRequired: true,
  order,
  sectionId,
});

/* 섹션 default 이름은 빈 문자열 — 사용자가 직접 입력 (자동 "섹션 N" 으로 임의 설정되지 않도록).
   isInitial=true 시 첫 섹션은 default "섹션 1" 부여 (편의). */
const newSection = (order: number, isInitial = false): TemplateSection => ({
  id: `sec_${Date.now()}_${order}_${Math.random().toString(36).slice(2, 6)}`,
  name: isInitial ? `섹션 ${order}` : '',
  order,
});

/* ── Main component ───────────────────────────────────────── */

export function TemplateBuilder() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { currentUser } = useAuthStore();
  const { templates, cycles, addTemplate, updateTemplate } = useReviewStore();
  const showToast = useShowToast();

  const isNew = templateId === 'new';
  const existing = !isNew ? templates.find(t => t.id === templateId) : undefined;
  const activeUsingCount = !isNew && templateId
    ? cycles.filter(c => c.templateId === templateId && !c.archivedAt && c.status !== 'closed' && c.status !== 'draft').length
    : 0;
  const historicalCount = !isNew && templateId
    ? cycles.filter(c => c.templateId === templateId && (c.status === 'closed' || c.status === 'draft' || c.archivedAt)).length
    : 0;

  const [name,        setName]        = useState(existing?.name        ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [saving,      setSaving]      = useState(false);
  const [nameError,   setNameError]   = useState('');
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});

  // 섹션 편집 상태
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // 초기 섹션 구성: 기존 템플릿 sections 사용, 없으면 default 1개 생성 (isInitial=true)
  // T-1 fix: initSections / initQuestions 가 각각 newSection 호출하면 Math.random() 포함된
  //         id 가 서로 달라 첫 질문의 sectionId 매칭 실패 → 화면에서 "1번 hidden, 2번부터 시작".
  //         useRef 로 default section 1회만 생성, 두 initializer 가 같은 id 공유.
  const defaultSecRef = useRef<TemplateSection | null>(null);
  const getDefaultSec = (): TemplateSection => {
    if (!defaultSecRef.current) defaultSecRef.current = newSection(1, true);
    return defaultSecRef.current;
  };

  const initSections = (): TemplateSection[] => {
    if (existing?.sections && existing.sections.length > 0) {
      return [...existing.sections].sort((a, b) => a.order - b.order);
    }
    return [getDefaultSec()];
  };

  const initQuestions = (): TemplateQuestion[] => {
    if (existing?.questions && existing.questions.length > 0) {
      const qs = [...existing.questions];
      // legacy 호환: 기존 질문에 sectionId 없으면 첫 섹션 (또는 default sec) 에 배정
      const firstSectionId = (existing.sections?.[0] ?? { id: '' }).id || getDefaultSec().id;
      return qs.map(q => ({ ...q, sectionId: q.sectionId ?? firstSectionId }));
    }
    return [newQuestion(1, getDefaultSec().id)];
  };

  const [sections,  setSections]  = useState<TemplateSection[]>(initSections);
  const [questions, setQuestions] = useState<TemplateQuestion[]>(initQuestions);

  /* ── 섹션 조작 ──────────────────────────────────────────── */
  const addSection = () => {
    // order 중복 방지 — 기존 max(order) + 1 사용 (sections.length+1 은 삭제 후 추가 시 중복 위험)
    const maxOrder = sections.reduce((m, s) => Math.max(m, s.order), 0);
    const sec = newSection(maxOrder + 1);
    setSections(ss => [...ss, sec]);
    // 추가 직후 자동 편집 모드 — 사용자가 즉시 이름 입력
    setEditingSectionId(sec.id);
  };

  const renameSection = (id: string, name: string) =>
    setSections(ss => ss.map(s => s.id === id ? { ...s, name } : s));

  const deleteSection = (id: string) => {
    const count = questions.filter(q => q.sectionId === id).length;
    const msg = count > 0
      ? `이 섹션의 질문 ${count}개도 함께 삭제됩니다. 계속하시겠습니까?`
      : '이 섹션을 삭제하시겠습니까?';
    if (!confirm(msg)) return;
    setSections(ss => ss.filter(s => s.id !== id));
    if (count > 0) setQuestions(qs => qs.filter(q => q.sectionId !== id));
  };

  /* ── 질문 조작 ──────────────────────────────────────────── */
  const addQ = (sectionId: string) => {
    const order = questions.filter(q => q.sectionId === sectionId).length + 1;
    setQuestions(qs => [...qs, newQuestion(Date.now(), sectionId)]);
    void order;
  };

  const removeQ = (id: string) => {
    setQuestions(qs => qs.filter(q => q.id !== id));
    setQuestionErrors(e => { const n = { ...e }; delete n[id]; return n; });
  };

  const updateQ = (id: string, patch: Partial<TemplateQuestion>) =>
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q));

  /* ── 저장 ───────────────────────────────────────────────── */
  const handleSave = async () => {
    let valid = true;
    let firstErrorMsg = '';
    if (!name.trim()) {
      setNameError('템플릿 이름을 입력해주세요.');
      firstErrorMsg = '템플릿 이름을 입력해주세요.';
      valid = false;
    }
    const qErrs: Record<string, string> = {};
    questions.forEach(q => { if (!q.text.trim()) qErrs[q.id] = '질문 내용을 입력해주세요.'; });
    if (Object.keys(qErrs).length > 0) {
      setQuestionErrors(qErrs);
      if (!firstErrorMsg) firstErrorMsg = `질문 ${Object.keys(qErrs).length}개의 내용을 입력해주세요.`;
      valid = false;
    }
    if (!valid) {
      // 사용자 피드백 — 이전엔 화면 변화 없어 "저장 안 됨" 으로 보였음
      showToast('error', firstErrorMsg || '입력을 확인해주세요.');
      // 첫 에러 영역으로 자동 스크롤
      setTimeout(() => {
        const target = document.querySelector('[data-validation-error="true"]') ?? document.querySelector('input[aria-invalid="true"]');
        if (target instanceof HTMLElement) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    if (!currentUser || saving) return;

    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      if (isNew) {
        const newId = `tmpl_${Date.now()}`;
        addTemplate({
          id: newId, name, description,
          isDefault: false,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          questions,
          sections,
        });
        showToast('success', '템플릿이 생성되었습니다!');
        if (returnTo === 'cycle-wizard') {
          navigate(`/cycles/new?newTemplateId=${newId}`);
          return;
        }
      } else if (existing) {
        updateTemplate(existing.id, { name, description, questions, sections });
        showToast('success', '템플릿이 저장되었습니다.');
      }
      // 사용자 명시 (D-3.E flow): 템플릿 생성·수정 후 템플릿 목록으로 복귀.
      // cycle-wizard 분기는 위에서 별도 처리.
      navigate('/templates');
    } finally {
      setSaving(false);
    }
  };

  const totalQuestions = questions.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-005">

      {/* ── Top toolbar ───────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-3.5 bg-white border-b border-gray-020 flex-shrink-0 shadow-sm sticky top-0 z-20">
        <button
          onClick={() => navigate(returnTo === 'cycle-wizard' ? '/cycles/new' : '/templates')}
          className="p-1.5 hover:bg-gray-010 rounded-lg transition-colors text-gray-060"
        >
          <MsChevronLeftLineIcon size={20} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }}
              onBlur={() => { if (!name.trim()) setNameError('템플릿 이름을 입력해주세요.'); }}
              placeholder="템플릿 이름을 입력하세요"
              className={`text-base font-semibold bg-transparent border-0 border-b-2 focus:outline-none px-0 py-0.5 w-64 transition-colors ${
                nameError
                  ? 'border-red-040 text-red-060 placeholder:text-red-020'
                  : 'border-transparent hover:border-gray-030 focus:border-pink-040 text-gray-099 placeholder:text-gray-040'
              }`}
            />
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="설명 (선택)"
              className="text-sm bg-transparent border-0 border-b focus:outline-none px-0 py-0.5 w-56 border-transparent hover:border-gray-020 focus:border-pink-040 text-gray-050 placeholder:text-gray-030 transition-colors"
            />
          </div>
          {nameError && <p className="text-xs text-red-050 mt-0.5">{nameError}</p>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!isNew && (activeUsingCount > 0 || historicalCount > 0) && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                activeUsingCount > 0
                  ? 'bg-orange-005 text-orange-070 border-orange-020'
                  : 'bg-gray-005 text-gray-060 border-gray-010'
              }`}
              title={activeUsingCount > 0 ? '진행 중인 사이클이 있습니다. 변경 시 기존 사이클은 발행 시점 스냅샷을 그대로 사용하지만, 신규 발행 사이클부터 변경 내용이 반영됩니다.' : ''}
            >
              사용 중 진행 {activeUsingCount} · 과거 {historicalCount}
            </span>
          )}
          <span className="text-xs text-gray-040">{totalQuestions}개 문항</span>
          <MsButton onClick={handleSave} loading={saving} leftIcon={<MsCheckIcon size={16} />}>
            {returnTo === 'cycle-wizard' ? '저장 후 리뷰 작성' : '저장'}
          </MsButton>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-8">

        {sections.map((section) => {
          const sectionQs = questions.filter(q => q.sectionId === section.id);
          const isEditing = editingSectionId === section.id;

          return (
            <div key={section.id} className="space-y-3">

              {/* 섹션 헤더 */}
              <div className="flex items-center gap-2 group">
                <div className="flex-1 flex items-center gap-2">
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={section.name}
                      onChange={e => renameSection(section.id, e.target.value)}
                      onBlur={() => setEditingSectionId(null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingSectionId(null);
                      }}
                      className="text-sm font-semibold text-gray-099 bg-white border border-pink-040 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-010 w-64"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingSectionId(section.id)}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-080 hover:text-pink-050 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-pink-040 flex-shrink-0" />
                      {section.name.trim() || <span className="text-gray-040 font-normal italic">섹션 이름 입력</span>}
                      <MsEditIcon size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => deleteSection(section.id)}
                  disabled={sections.length <= 1}
                  className="p-1.5 text-gray-030 hover:text-red-040 hover:bg-red-005 rounded-lg transition-colors disabled:opacity-0 disabled:pointer-events-none"
                  title="섹션 삭제"
                >
                  <MsDeleteIcon size={12} />
                </button>
              </div>

              {/* 질문 카드들 */}
              {sectionQs.map((q, idx) => {
                const ti = typeInfo(q.type);
                const globalIdx = questions.findIndex(x => x.id === q.id);
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border ${
                      questionErrors[q.id] ? 'border-red-020' : 'border-bd-default'
                    }`}
                  >
                    {/* Question header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-010">
                      <button className="text-gray-030 cursor-grab active:cursor-grabbing hover:text-gray-040 transition-colors">
                        <MsGrabIcon size={16} />
                      </button>
                      <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center flex-shrink-0 ${ti.bg} ${ti.color}`}>
                        {globalIdx + 1}
                      </span>
                      {/* Type tabs */}
                      <div className="flex items-center gap-1 flex-1">
                        {TYPES.map(({ val, label, icon: Icon }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateQ(q.id, {
                              type: val as TemplateQuestion['type'],
                              options: val === 'multiple_choice' ? (q.options ?? ['', '']) : undefined,
                              allowMultiple: val === 'multiple_choice' ? (q.allowMultiple ?? false) : undefined,
                            })}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-colors ${
                              q.type === val
                                ? `${ti.bg} ${ti.color} font-semibold`
                                : 'text-gray-040 hover:bg-gray-010 hover:text-gray-060'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => removeQ(q.id)}
                        disabled={sectionQs.length <= 1 && sections.length <= 1}
                        className="p-1.5 text-gray-030 hover:text-red-040 hover:bg-red-005 rounded-lg transition-colors disabled:opacity-0"
                      >
                        <MsDeleteIcon size={12} />
                      </button>
                    </div>

                    {/* Question body */}
                    <div className="px-4 py-4 space-y-3">
                      <MsInput
                        type="text"
                        value={q.text}
                        onChange={e => {
                          updateQ(q.id, { text: e.target.value });
                          if (e.target.value.trim()) setQuestionErrors(er => { const n = { ...er }; delete n[q.id]; return n; });
                        }}
                        onBlur={() => { if (!q.text.trim()) setQuestionErrors(er => ({ ...er, [q.id]: '질문 내용을 입력해주세요.' })); }}
                        placeholder="질문 내용을 입력하세요"
                        error={questionErrors[q.id]}
                      />

                      {/* Multiple choice options */}
                      {q.type === 'multiple_choice' && (
                        <div className="space-y-2 pl-1">
                          <MsCheckbox
                            size="md"
                            checked={q.allowMultiple ?? false}
                            onChange={e => updateQ(q.id, { allowMultiple: e.target.checked })}
                            label={<span className="text-xs text-gray-060 font-medium">복수 선택 가능</span>}
                          />
                          <div className="space-y-1.5">
                            {(q.options ?? []).map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <span className={`w-4 h-4 flex-shrink-0 border border-gray-030 ${q.allowMultiple ? 'rounded' : 'rounded-full'}`} />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={e => {
                                    const next = [...(q.options ?? [])];
                                    next[oi] = e.target.value;
                                    updateQ(q.id, { options: next });
                                  }}
                                  placeholder={`보기 ${oi + 1}`}
                                  className="flex-1 px-3 py-1.5 border border-gray-020 rounded-lg bg-gray-005 text-xs focus:outline-none focus:ring-2 focus:ring-pink-010 focus:bg-white"
                                />
                                {(q.options ?? []).length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...(q.options ?? [])];
                                      next.splice(oi, 1);
                                      updateQ(q.id, { options: next });
                                    }}
                                    className="p-1 text-gray-030 hover:text-red-040 transition-colors"
                                  >
                                    <MsCancelIcon size={12} />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ''] })}
                              className="flex items-center gap-1 text-xs text-pink-050 hover:text-pink-060 transition-colors mt-1"
                            >
                              <MsPlusIcon size={12} /> 보기 추가
                            </button>
                          </div>
                        </div>
                      )}

                      {q.type === 'rating' && (
                        <p className="text-xs text-gray-040 pl-1">1–5점 척도로 표시됩니다.</p>
                      )}

                      <MsInput
                        size="sm"
                        type="text"
                        value={q.helpText ?? ''}
                        onChange={e => updateQ(q.id, { helpText: e.target.value })}
                        placeholder="도움말 (선택) — 질문의 의도나 작성 가이드"
                      />

                      <div className="flex items-center gap-4 pt-1">
                        <MsCheckbox
                          size="md"
                          checked={q.isRequired}
                          onChange={e => updateQ(q.id, { isRequired: e.target.checked })}
                          label={<span className="text-xs text-gray-060">필수</span>}
                        />
                        <MsCheckbox
                          size="md"
                          checked={q.isPrivate}
                          onChange={e => updateQ(q.id, { isPrivate: e.target.checked })}
                          label={<span className="flex items-center gap-1 text-xs text-gray-060"><MsLockIcon size={12} className="text-gray-040" />매니저 전용</span>}
                        />
                        <div className="flex gap-1 ml-auto">
                          {TARGETS.map(({ val, label }) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateQ(q.id, { target: val })}
                              className={`px-2.5 py-0.5 text-xs rounded-lg transition-colors ${
                                q.target === val
                                  ? 'bg-gray-080 text-white font-medium'
                                  : 'bg-gray-010 text-gray-050 hover:bg-gray-020'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                void idx;
              })}

              {/* 섹션 내 질문 추가 */}
              <button
                onClick={() => addQ(section.id)}
                className="w-full py-3 border-2 border-dashed border-gray-020 rounded-xl text-sm text-gray-040 hover:border-pink-030 hover:text-pink-050 hover:bg-pink-005/50 transition-all flex items-center justify-center gap-2 group"
              >
                <MsPlusIcon size={16} className="group-hover:scale-110 transition-transform" />
                질문 추가
              </button>
            </div>
          );
        })}

        {/* 섹션 추가 */}
        <button
          onClick={addSection}
          className="w-full py-3.5 border-2 border-dashed border-gray-030 rounded-xl text-sm text-gray-050 hover:border-pink-040 hover:text-pink-050 hover:bg-pink-005/30 transition-all flex items-center justify-center gap-2 font-medium"
        >
          <MsPlusIcon size={16} />
          섹션 추가
        </button>

        <div className="pb-10" />
      </div>
    </div>
  );
}
