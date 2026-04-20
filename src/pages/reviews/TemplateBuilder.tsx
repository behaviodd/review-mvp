import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useShowToast } from '../../components/ui/Toast';
import { useAuthStore } from '../../stores/authStore';
import { ChevronLeft, Plus, Trash2, GripVertical, Lock, Eye, HelpCircle } from 'lucide-react';
import { LoadingButton } from '../../components/ui/LoadingButton';

const inputCls = (hasErr: boolean) =>
  `w-full px-3.5 py-2.5 border rounded bg-neutral-50 text-sm focus:outline-none focus:ring-2 focus:bg-white ${
    hasErr
      ? 'border-danger-400 focus:border-danger-400 focus:ring-danger-100'
      : 'border-neutral-200 focus:border-primary-500 focus:ring-primary-100'
  }`;
import type { TemplateQuestion } from '../../types';

const newQuestion = (order: number): TemplateQuestion => ({
  id: `q_${Date.now()}_${order}`,
  text: '',
  type: 'text',
  target: 'both',
  isPrivate: false,
  isRequired: true,
  order,
});

export function TemplateBuilder() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { templates, addTemplate, updateTemplate } = useReviewStore();
  const showToast = useShowToast();

  const isNew = templateId === 'new';
  const existing = !isNew ? templates.find(t => t.id === templateId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [questions, setQuestions] = useState<TemplateQuestion[]>(
    existing?.questions ?? [newQuestion(1)]
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});

  const addQ = () => setQuestions(qs => [...qs, newQuestion(qs.length + 1)]);
  const removeQ = (id: string) => {
    setQuestions(qs => qs.filter(q => q.id !== id));
    setQuestionErrors(e => { const n = { ...e }; delete n[id]; return n; });
  };
  const updateQ = (id: string, patch: Partial<TemplateQuestion>) =>
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...patch } : q));

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
        addTemplate({
          id: `tmpl_${Date.now()}`,
          name,
          description,
          isDefault: false,
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          questions,
        });
        showToast('success', '템플릿이 생성되었습니다!');
      } else if (existing) {
        updateTemplate(existing.id, { name, description, questions });
        showToast('success', '템플릿이 저장되었습니다.');
      }
      navigate('/templates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-5 h-full">
      {/* Editor */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/templates')} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <h1 className="text-lg font-bold text-neutral-900 flex-1">{isNew ? '새 템플릿' : '템플릿 편집'}</h1>
          <button
            onClick={() => setPreviewOpen(o => !o)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl border transition-colors ${previewOpen ? 'bg-primary-50 border-primary-200 text-primary-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
          >
            <Eye className="w-4 h-4" /> 미리보기
          </button>
          <LoadingButton
            onClick={handleSave}
            loading={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            저장
          </LoadingButton>
        </div>

        {/* Template meta */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">템플릿 이름 *</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }}
              onBlur={() => { if (!name.trim()) setNameError('템플릿 이름을 입력해주세요.'); }}
              placeholder="예: 분기 성과 리뷰"
              className={inputCls(!!nameError)}
            />
            {nameError && <p className="mt-1 text-xs text-danger-600">{nameError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">설명</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="이 템플릿에 대한 간단한 설명"
              className="w-full px-3.5 py-2.5 border border-neutral-200 rounded bg-neutral-50 text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white"
            />
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
              <div className="flex items-start gap-3">
                <button className="mt-1 text-neutral-300 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4" />
                </button>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-neutral-400">Q{idx + 1}</span>
                    <div className="flex gap-1.5 ml-auto">
                      {([
                        ['text', '주관식'],
                        ['rating', '평점'],
                        ['competency', '역량'],
                      ] as const).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateQ(q.id, { type: val })}
                          className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${q.type === val ? 'bg-primary-600 text-white font-semibold' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={q.text}
                      onChange={e => {
                        updateQ(q.id, { text: e.target.value });
                        if (e.target.value.trim()) setQuestionErrors(er => { const n = { ...er }; delete n[q.id]; return n; });
                      }}
                      onBlur={() => { if (!q.text.trim()) setQuestionErrors(er => ({ ...er, [q.id]: '질문 내용을 입력해주세요.' })); }}
                      placeholder="질문 내용을 입력하세요"
                      className={inputCls(!!questionErrors[q.id])}
                    />
                    {questionErrors[q.id] && <p className="mt-1 text-xs text-danger-600">{questionErrors[q.id]}</p>}
                  </div>
                  <input
                    type="text"
                    value={q.helpText ?? ''}
                    onChange={e => updateQ(q.id, { helpText: e.target.value })}
                    placeholder="도움말 (선택) — 질문의 의도나 작성 가이드"
                    className="w-full px-3.5 py-2 border border-neutral-100 rounded-xl text-xs text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={q.isRequired} onChange={e => updateQ(q.id, { isRequired: e.target.checked })}
                        className="w-3.5 h-3.5 rounded accent-primary-500" />
                      <span className="text-neutral-600">필수</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={q.isPrivate} onChange={e => updateQ(q.id, { isPrivate: e.target.checked })}
                        className="w-3.5 h-3.5 rounded accent-primary-500" />
                      <Lock className="w-3 h-3 text-neutral-400" />
                      <span className="text-neutral-600">매니저 전용</span>
                    </label>
                    <div className="flex gap-1.5 ml-auto">
                      {(['both', 'self', 'leader'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => updateQ(q.id, { target: t })}
                          className={`px-2 py-0.5 rounded-lg transition-colors ${q.target === t ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-500'}`}
                        >
                          {t === 'both' ? '공통' : t === 'self' ? '자기평가' : '매니저'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => removeQ(q.id)}
                  disabled={questions.length <= 1}
                  className="mt-1 p-1.5 text-neutral-300 hover:text-danger-400 hover:bg-danger-50 rounded-xl transition-colors disabled:opacity-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={addQ}
            className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-xl text-sm text-neutral-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> 질문 추가
          </button>
        </div>
      </div>

      {/* Preview panel */}
      {previewOpen && (
        <div className="w-80 flex-shrink-0">
          <div className="sticky top-20 bg-white rounded-xl border border-neutral-200 shadow-card p-5 space-y-4 max-h-[calc(100vh-120px)] overflow-y-auto">
            <h2 className="text-sm font-semibold text-neutral-700">미리보기</h2>
            <div className="space-y-1 mb-2">
              <p className="text-base font-semibold text-neutral-800">{name || '(이름 없음)'}</p>
              {description && <p className="text-xs text-neutral-400">{description}</p>}
            </div>
            {questions.filter(q => q.text).map((q, i) => (
              <div key={q.id} className={`p-4 rounded-xl border ${q.isPrivate ? 'border-neutral-200 bg-neutral-50/50' : 'border-neutral-100'}`}>
                {q.isPrivate && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <Lock className="w-3 h-3 text-neutral-400" />
                    <span className="text-xs text-neutral-400">매니저 전용</span>
                  </div>
                )}
                <p className="text-xs font-semibold text-neutral-800 mb-2">
                  {i + 1}. {q.text}
                  {q.isRequired && <span className="text-danger-500 ml-1">*</span>}
                </p>
                {q.helpText && (
                  <div className="flex items-start gap-1 mb-2">
                    <HelpCircle className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-neutral-400">{q.helpText}</p>
                  </div>
                )}
                {q.type === 'text' ? (
                  <div className="w-full h-14 bg-neutral-50 rounded-lg border border-neutral-200" />
                ) : (
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(n => (
                      <div key={n} className="flex-1 h-8 bg-neutral-100 rounded-lg border border-neutral-200 flex items-center justify-center text-xs text-neutral-400">{n}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
