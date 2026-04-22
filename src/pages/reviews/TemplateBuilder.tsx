import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useShowToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../stores/authStore';
import {
  ChevronLeft, Plus, Trash2, GripVertical, Lock, X,
  AlignLeft, List, BarChart2, Brain, Check, Pencil,
} from 'lucide-react';
import { LoadingButton } from '../../components/ui/LoadingButton';
import type { TemplateQuestion, TemplateSection } from '../../types';

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

const newSection = (order: number): TemplateSection => ({
  id: `sec_${Date.now()}_${order}`,
  name: `섹션 ${order}`,
  order,
});

/* ── Main component ───────────────────────────────────────── */

export function TemplateBuilder() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { currentUser } = useAuthStore();
  const { templates, addTemplate, updateTemplate } = useReviewStore();
  const showToast = useShowToast();

  const isNew = templateId === 'new';
  const existing = !isNew ? templates.find(t => t.id === templateId) : undefined;

  const [name,        setName]        = useState(existing?.name        ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [saving,      setSaving]      = useState(false);
  const [nameError,   setNameError]   = useState('');
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});

  // 섹션 편집 상태
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // 초기 섹션 구성: 기존 템플릿 sections 사용, 없으면 default 1개 생성
  const initSections = (): TemplateSection[] => {
    if (existing?.sections && existing.sections.length > 0) {
      return [...existing.sections].sort((a, b) => a.order - b.order);
    }
    return [newSection(1)];
  };

  const initQuestions = (): TemplateQuestion[] => {
    if (existing?.questions && existing.questions.length > 0) {
      const qs = [...existing.questions];
      // 기존 질문에 sectionId 없으면 첫 섹션에 배정
      const firstSectionId = (existing.sections?.[0] ?? { id: '' }).id || `sec_${Date.now()}_1`;
      return qs.map(q => ({ ...q, sectionId: q.sectionId ?? firstSectionId }));
    }
    const sec = newSection(1);
    return [newQuestion(1, sec.id)];
  };

  const [sections,  setSections]  = useState<TemplateSection[]>(initSections);
  const [questions, setQuestions] = useState<TemplateQuestion[]>(initQuestions);

  /* ── 섹션 조작 ──────────────────────────────────────────── */
  const addSection = () => {
    const sec = newSection(sections.length + 1);
    setSections(ss => [...ss, sec]);
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
    if (!name.trim()) { setNameError('템플릿 이름을 입력해주세요.'); valid = false; }
    const qErrs: Record<string, string> = {};
    questions.forEach(q => { if (!q.text.trim()) qErrs[q.id] = '질문 내용을 입력해주세요.'; });
    if (Object.keys(qErrs).length > 0) { setQuestionErrors(qErrs); valid = false; }
    if (!valid) return;
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
      navigate('/cycles');
    } finally {
      setSaving(false);
    }
  };

  const totalQuestions = questions.length;

  return (
    <div className="flex flex-col min-h-full bg-neutral-50">

      {/* ── Top toolbar ───────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-3.5 bg-white border-b border-neutral-200 flex-shrink-0 shadow-sm sticky top-0 z-20">
        <button
          onClick={() => navigate('/cycles')}
          className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-600"
        >
          <ChevronLeft className="w-5 h-5" />
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
                  ? 'border-danger-400 text-danger-700 placeholder:text-danger-300'
                  : 'border-transparent hover:border-neutral-300 focus:border-primary-500 text-neutral-900 placeholder:text-neutral-400'
              }`}
            />
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="설명 (선택)"
              className="text-sm bg-transparent border-0 border-b focus:outline-none px-0 py-0.5 w-56 border-transparent hover:border-neutral-200 focus:border-primary-400 text-neutral-500 placeholder:text-neutral-300 transition-colors"
            />
          </div>
          {nameError && <p className="text-xs text-danger-600 mt-0.5">{nameError}</p>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-neutral-400">{totalQuestions}개 문항</span>
          <LoadingButton
            onClick={handleSave}
            loading={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            {!saving && <Check className="w-4 h-4" />}
            {returnTo === 'cycle-wizard' ? '저장 후 리뷰 작성' : '저장'}
          </LoadingButton>
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
                      className="text-sm font-semibold text-neutral-900 bg-white border border-primary-400 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-100 w-64"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingSectionId(section.id)}
                      className="flex items-center gap-2 text-sm font-semibold text-neutral-800 hover:text-primary-600 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                      {section.name}
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => deleteSection(section.id)}
                  disabled={sections.length <= 1}
                  className="p-1.5 text-neutral-300 hover:text-danger-400 hover:bg-danger-50 rounded-lg transition-colors disabled:opacity-0 disabled:pointer-events-none"
                  title="섹션 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 질문 카드들 */}
              {sectionQs.map((q, idx) => {
                const ti = typeInfo(q.type);
                const globalIdx = questions.findIndex(x => x.id === q.id);
                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-xl border shadow-sm transition-shadow hover:shadow-md ${
                      questionErrors[q.id] ? 'border-danger-300' : 'border-neutral-200'
                    }`}
                  >
                    {/* Question header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
                      <button className="text-neutral-300 cursor-grab active:cursor-grabbing hover:text-neutral-400 transition-colors">
                        <GripVertical className="w-4 h-4" />
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
                                : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600'
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
                        className="p-1.5 text-neutral-300 hover:text-danger-400 hover:bg-danger-50 rounded-lg transition-colors disabled:opacity-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Question body */}
                    <div className="px-4 py-4 space-y-3">
                      <input
                        type="text"
                        value={q.text}
                        onChange={e => {
                          updateQ(q.id, { text: e.target.value });
                          if (e.target.value.trim()) setQuestionErrors(er => { const n = { ...er }; delete n[q.id]; return n; });
                        }}
                        onBlur={() => { if (!q.text.trim()) setQuestionErrors(er => ({ ...er, [q.id]: '질문 내용을 입력해주세요.' })); }}
                        placeholder="질문 내용을 입력하세요"
                        className={`w-full px-3.5 py-2.5 border rounded-lg bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-colors ${
                          questionErrors[q.id]
                            ? 'border-danger-400 focus:ring-danger-100'
                            : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
                        }`}
                      />
                      {questionErrors[q.id] && (
                        <p className="text-xs text-danger-600 -mt-1">{questionErrors[q.id]}</p>
                      )}

                      {/* Multiple choice options */}
                      {q.type === 'multiple_choice' && (
                        <div className="space-y-2 pl-1">
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none w-fit">
                            <input
                              type="checkbox"
                              checked={q.allowMultiple ?? false}
                              onChange={e => updateQ(q.id, { allowMultiple: e.target.checked })}
                              className="w-3.5 h-3.5 rounded accent-primary-500"
                            />
                            <span className="text-neutral-600 font-medium">복수 선택 가능</span>
                          </label>
                          <div className="space-y-1.5">
                            {(q.options ?? []).map((opt, oi) => (
                              <div key={oi} className="flex items-center gap-2">
                                <span className={`w-4 h-4 flex-shrink-0 border border-neutral-300 ${q.allowMultiple ? 'rounded' : 'rounded-full'}`} />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={e => {
                                    const next = [...(q.options ?? [])];
                                    next[oi] = e.target.value;
                                    updateQ(q.id, { options: next });
                                  }}
                                  placeholder={`보기 ${oi + 1}`}
                                  className="flex-1 px-3 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 text-xs focus:outline-none focus:ring-2 focus:ring-primary-100 focus:bg-white"
                                />
                                {(q.options ?? []).length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...(q.options ?? [])];
                                      next.splice(oi, 1);
                                      updateQ(q.id, { options: next });
                                    }}
                                    className="p-1 text-neutral-300 hover:text-danger-400 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ''] })}
                              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors mt-1"
                            >
                              <Plus className="w-3 h-3" /> 보기 추가
                            </button>
                          </div>
                        </div>
                      )}

                      {q.type === 'rating' && (
                        <p className="text-xs text-neutral-400 pl-1">1–5점 척도로 표시됩니다.</p>
                      )}

                      <input
                        type="text"
                        value={q.helpText ?? ''}
                        onChange={e => updateQ(q.id, { helpText: e.target.value })}
                        placeholder="도움말 (선택) — 질문의 의도나 작성 가이드"
                        className="w-full px-3.5 py-2 border border-neutral-100 rounded-lg text-xs text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-neutral-300"
                      />

                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={q.isRequired}
                            onChange={e => updateQ(q.id, { isRequired: e.target.checked })}
                            className="w-3.5 h-3.5 rounded accent-primary-500"
                          />
                          <span className="text-xs text-neutral-600">필수</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={q.isPrivate}
                            onChange={e => updateQ(q.id, { isPrivate: e.target.checked })}
                            className="w-3.5 h-3.5 rounded accent-primary-500"
                          />
                          <Lock className="w-3 h-3 text-neutral-400" />
                          <span className="text-xs text-neutral-600">매니저 전용</span>
                        </label>
                        <div className="flex gap-1 ml-auto">
                          {TARGETS.map(({ val, label }) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => updateQ(q.id, { target: val })}
                              className={`px-2.5 py-0.5 text-xs rounded-lg transition-colors ${
                                q.target === val
                                  ? 'bg-neutral-800 text-white font-medium'
                                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
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
                className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50 transition-all flex items-center justify-center gap-2 group"
              >
                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                질문 추가
              </button>
            </div>
          );
        })}

        {/* 섹션 추가 */}
        <button
          onClick={addSection}
          className="w-full py-3.5 border-2 border-dashed border-neutral-300 rounded-xl text-sm text-neutral-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Plus className="w-4 h-4" />
          섹션 추가
        </button>

        <div className="pb-10" />
      </div>
    </div>
  );
}
