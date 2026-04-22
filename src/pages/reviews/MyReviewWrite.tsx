import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PartyPopper, ShieldCheck, Lightbulb, Save } from 'lucide-react';
import {
  MsChevronLeftIcon, MsChevronRightIcon, MsCheckIcon, MsHelpIcon, MsLockIcon,
  MsMessageIcon, MsDownloadIcon, MsCalendarIcon,
  MsArticleIcon, MsChevronDownIcon,
  MsLinkIcon, MsPaperclipIcon, MsOutlinkIcon, MsCancelIcon, MsPlusIcon, MsProfileIcon,
} from '../../components/ui/MsIcons';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { exportSubmissionToCSV } from '../../utils/exportUtils';
import { DEFAULT_TEMPLATE } from '../../data/defaultTemplate';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatDate } from '../../utils/dateUtils';
import type { TemplateQuestion, Answer, ReviewCycle, ReviewSubmission, ReviewTemplate, User } from '../../types';
import { MsButton } from '../../components/ui/MsButton';

// ─── 객관식 선택기 ────────────────────────────────────────────────────────────
function MultipleChoiceSelector({ question, selected, onChange, disabled }: {
  question: TemplateQuestion; selected: string[]; onChange: (v: string[]) => void; disabled?: boolean;
}) {
  const opts = (question.options ?? []).filter(o => o.trim());
  if (opts.length === 0) return <p className="text-xs text-zinc-300 italic">보기가 없습니다.</p>;
  const toggle = (opt: string) => {
    if (question.allowMultiple) {
      onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
    } else {
      onChange([opt]);
    }
  };
  return (
    <div className="space-y-2">
      {opts.map(opt => {
        const checked = selected.includes(opt);
        return (
          <button key={opt} type="button" disabled={disabled} onClick={() => toggle(opt)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-all ${
              checked ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
              : disabled ? 'border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed'
              : 'border-zinc-200 hover:border-primary-300 text-zinc-700'
            }`}
          >
            <span className={`w-4 h-4 flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
              question.allowMultiple ? 'rounded' : 'rounded-full'
            } ${checked ? 'border-primary-500 bg-primary-500' : 'border-zinc-300'}`}>
              {checked && <span className="w-2 h-2 bg-white rounded-sm" />}
            </span>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── 별점 선택기 ──────────────────────────────────────────────────────────────
function RatingSelector({ question: _q, value, onChange, disabled }: {
  question: TemplateQuestion; value?: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  const LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];
  return (
    <div>
      <div className="flex gap-2">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" disabled={disabled} onClick={() => onChange(n)}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
              value === n ? 'border-primary-500 bg-primary-600 text-white'
              : disabled ? 'border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed'
              : 'border-zinc-200 hover:border-primary-300 text-zinc-600'
            }`}
          >{n}</button>
        ))}
      </div>
      {value && <p className="text-xs text-primary-600 mt-1.5 font-medium">{LABELS[value]}</p>}
    </div>
  );
}

// ─── 질문 카드 ────────────────────────────────────────────────────────────────
function QuestionCard({ question, answer, onChange, readOnly, showError }: {
  question: TemplateQuestion; answer?: Answer; onChange: (a: Answer) => void;
  readOnly?: boolean; showError?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const isUnanswered = showError && question.isRequired && !readOnly && (() => {
    if (question.type === 'text') return !answer?.textValue?.trim();
    if (question.type === 'multiple_choice') return !answer?.selectedOptions?.length;
    return !answer?.ratingValue;
  })();

  return (
    <div className={`bg-white rounded-xl border p-5 ${
      isUnanswered ? 'border-rose-300 bg-rose-50/20'
      : question.isPrivate ? 'border-zinc-200 bg-zinc-50/50'
      : 'border-zinc-950/5 shadow-card'
    }`}>
      {question.isPrivate && (
        <div className="flex items-center gap-1.5 mb-2">
          <MsLockIcon size={12} className="text-zinc-400" />
          <span className="text-xs text-zinc-400">매니저 전용</span>
        </div>
      )}
      <div className="flex items-start gap-2 mb-3">
        <p className="text-sm font-semibold text-zinc-800 flex-1 leading-snug">
          {question.text}{question.isRequired && <span className="text-rose-500 ml-1">*</span>}
        </p>
        {question.helpText && (
          <button onClick={() => setHelpOpen(o => !o)} className="text-zinc-400 hover:text-zinc-600 flex-shrink-0 mt-0.5">
            <MsHelpIcon size={16} />
          </button>
        )}
      </div>
      {helpOpen && question.helpText && (
        <div className="mb-3 p-3 bg-primary-50 rounded-xl border border-primary-100">
          <p className="text-xs text-primary-700 mb-1.5 font-medium">이 질문의 의도</p>
          <p className="text-xs text-primary-600">{question.helpText}</p>
          {question.exampleAnswer && (
            <><p className="text-xs text-primary-700 font-medium mt-2 mb-1">예시 답변</p>
            <p className="text-xs text-primary-600 italic">{question.exampleAnswer}</p></>
          )}
        </div>
      )}
      {(question.type === 'rating' || question.type === 'competency') && (
        <RatingSelector question={question} value={answer?.ratingValue}
          onChange={v => onChange({ questionId: question.id, ratingValue: v })} disabled={readOnly} />
      )}
      {question.type === 'multiple_choice' && (
        <MultipleChoiceSelector question={question} selected={answer?.selectedOptions ?? []}
          onChange={v => onChange({ questionId: question.id, selectedOptions: v })} disabled={readOnly} />
      )}
      {question.type === 'text' && (
        <div>
          <textarea value={answer?.textValue || ''}
            onChange={e => onChange({ questionId: question.id, textValue: e.target.value })}
            disabled={readOnly} rows={5} maxLength={1000}
            placeholder={readOnly ? '' : '구체적인 사례와 수치를 포함해 작성하세요.'}
            className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:bg-white disabled:bg-zinc-50 disabled:text-zinc-500 placeholder:text-zinc-300 resize-none"
          />
          <div className="flex justify-between mt-1">
            {!readOnly && answer?.textValue && answer.textValue.length < 50 && <p className="text-xs text-primary-600">💡 좀 더 구체적으로 작성하면 더 좋아요!</p>}
            {!readOnly && answer?.textValue && answer.textValue.length >= 50 && <p className="text-xs text-emerald-600">잘 작성하고 계십니다!</p>}
            {(!readOnly && !answer?.textValue) && <span />}
            <p className="text-xs text-zinc-400 ml-auto">{(answer?.textValue || '').length}/1000</p>
          </div>
        </div>
      )}
      {isUnanswered && <p className="mt-2 text-xs text-rose-600">필수 항목입니다. 답변을 입력해주세요.</p>}
    </div>
  );
}

// ─── 병렬 보기 ────────────────────────────────────────────────────────────────
const RATING_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

function InputAnswerContent({ question, answer }: { question: TemplateQuestion; answer?: Answer }) {
  const r = answer?.ratingValue; const t = answer?.textValue;
  if (question.type === 'rating' || question.type === 'competency') {
    return r ? (
      <div className="flex items-center gap-3">
        <div className="flex gap-1">{[1,2,3,4,5].map(n => <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${n===r?'bg-zinc-700 text-white':n<r?'bg-zinc-200 text-zinc-500':'bg-zinc-100 text-zinc-300'}`}>{n}</span>)}</div>
        <span className="text-sm font-semibold text-zinc-700">{r}점</span>
        <span className="text-xs text-zinc-500 font-medium">{RATING_LABELS[r]}</span>
      </div>
    ) : <p className="text-sm text-zinc-400 italic">미응답</p>;
  }
  if (question.type === 'multiple_choice') {
    const opts = answer?.selectedOptions ?? [];
    return opts.length > 0 ? <div className="flex flex-wrap gap-1.5">{opts.map(o => <span key={o} className="text-xs px-2 py-1 bg-zinc-100 text-zinc-700 rounded-full">{o}</span>)}</div> : <p className="text-sm text-zinc-400 italic">미응답</p>;
  }
  return t?.trim() ? <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{t}</p> : <p className="text-sm text-zinc-400 italic">미응답</p>;
}

function FlatAnswerContent({ question, answer }: { question: TemplateQuestion; answer?: Answer }) {
  const r = answer?.ratingValue; const t = answer?.textValue;
  if (question.type === 'rating' || question.type === 'competency') {
    return r ? (
      <div className="flex items-center gap-3">
        <div className="flex gap-1">{[1,2,3,4,5].map(n => <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${n===r?'bg-primary-600 text-white':n<r?'bg-primary-100 text-primary-400':'bg-zinc-100 text-zinc-300'}`}>{n}</span>)}</div>
        <span className="text-sm font-semibold text-zinc-700">{r}점</span>
        <span className="text-xs text-primary-600 font-medium">{RATING_LABELS[r]}</span>
      </div>
    ) : <p className="text-sm text-zinc-400 italic">미응답</p>;
  }
  return t?.trim() ? <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{t}</p> : <p className="text-sm text-zinc-400 italic">미응답</p>;
}

// ─── 참고자료 타입 ────────────────────────────────────────────────────────────
type RefLink = { id: string; kind: 'link'; title: string; url: string };
type RefFile = { id: string; kind: 'file'; name: string; size: string };
type RefItem = RefLink | RefFile;

// ─── 우측 패널 ────────────────────────────────────────────────────────────────
const WRITING_TIPS = [
  '구체적인 수치와 사례를 들어 작성하면 더욱 설득력 있습니다.',
  '기간 내 실제 경험을 바탕으로 작성해주세요.',
  '잘한 점과 개선할 점을 균형 있게 서술하세요.',
  '다음 목표와 연결 지어 성장 계획을 작성하면 좋습니다.',
];

function RightPanel({
  cycle, isReadOnly, submission, template, currentUser,
  completedCount, totalSections, refs, setRefs,
  isDownward, reviewerId, users,
}: {
  cycle: ReviewCycle | undefined;
  isReadOnly: boolean;
  submission: ReviewSubmission | undefined;
  template: ReviewTemplate | undefined;
  currentUser: User | null;
  completedCount: number;
  totalSections: number;
  refs: RefItem[];
  setRefs: React.Dispatch<React.SetStateAction<RefItem[]>>;
  isDownward?: boolean;
  reviewerId?: string;
  users: User[];
}) {
  const [tipsOpen, setTipsOpen] = useState(true);
  const [refsOpen, setRefsOpen] = useState(true);
  const [refTab,   setRefTab]   = useState<'link' | 'file'>('link');
  const [linkUrl,  setLinkUrl]  = useState('');
  const [linkTitle, setLinkTitle] = useState('');

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const safe = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    setRefs(p => [...p, { id: crypto.randomUUID(), kind: 'link', title: linkTitle.trim() || safe, url: safe }]);
    setLinkUrl(''); setLinkTitle('');
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setRefs(p => [...p, ...files.map(f => ({ id: crypto.randomUUID(), kind: 'file' as const, name: f.name, size: f.size < 1048576 ? `${(f.size/1024).toFixed(0)} KB` : `${(f.size/1048576).toFixed(1)} MB` }))]);
    e.target.value = '';
  };
  const removeRef = (id: string) => setRefs(p => p.filter(r => r.id !== id));

  return (
    <div className="hidden lg:flex w-72 bg-white border-l border-zinc-950/5 flex-col flex-shrink-0 overflow-y-auto sticky top-0 h-full">

      {/* 리뷰 정보 */}
      <div className="p-4 border-b border-zinc-950/5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-primary-50 flex items-center justify-center flex-shrink-0">
            <MsArticleIcon size={12} className="text-primary-600" />
          </div>
          <p className="text-xs font-semibold text-zinc-950">리뷰 정보</p>
        </div>
        {isDownward && reviewerId && (() => {
          const reviewer = users.find(u => u.id === reviewerId);
          if (!reviewer) return null;
          return (
            <div className="flex items-center gap-2.5 p-2.5 bg-zinc-50 rounded-lg border border-zinc-950/5">
              <UserAvatar user={reviewer} size="sm" />
              <div className="min-w-0">
                <p className="text-xs text-zinc-400 leading-none mb-0.5">작성자</p>
                <p className="text-xs font-semibold text-zinc-700 truncate">{reviewer.name}</p>
                <p className="text-xs text-zinc-400 truncate">{reviewer.position}</p>
              </div>
            </div>
          );
        })()}
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">리뷰 주기</p>
          <p className="text-xs font-medium text-zinc-700 leading-snug">{cycle?.title ?? '—'}</p>
        </div>
        <div className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg">
          <MsCalendarIcon size={12} className="text-zinc-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-zinc-400">자기평가 마감</p>
            <p className="text-xs font-medium text-zinc-700">{cycle ? formatDate(cycle.selfReviewDeadline) : '—'}</p>
          </div>
        </div>
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-950/5">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="size-3.5 text-zinc-500" />
            <p className="text-xs font-semibold text-zinc-600">개인정보 보호</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">작성 내용은 제출 전까지 본인만 볼 수 있습니다. 제출 후에는 담당 매니저와 관리자만 열람합니다.</p>
        </div>
        {!isReadOnly && (
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">작성 진행률</p>
            <ProgressBar value={completedCount} max={totalSections} showPercent />
            <p className="text-xs text-zinc-400 mt-1.5">{completedCount}/{totalSections} 섹션 완료</p>
          </div>
        )}
        {isReadOnly && currentUser?.role === 'admin' && submission && template && cycle && (
          <button
            onClick={() => exportSubmissionToCSV(submission, template, cycle, users.find(u => u.id === submission.revieweeId) ?? currentUser, currentUser)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <MsDownloadIcon size={12} /> CSV 내보내기
          </button>
        )}
      </div>

      {/* 참고자료 */}
      <div>
        <button onClick={() => setRefsOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-950/5">
          <div className="flex items-center gap-2">
            <MsPaperclipIcon size={12} className="text-zinc-400" />
            <span className="text-xs font-medium text-zinc-700">참고자료</span>
            {refs.length > 0 && <span className="text-xs font-bold bg-primary-100 text-primary-600 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none">{refs.length}</span>}
          </div>
          {refsOpen ? <MsChevronDownIcon size={12} className="text-zinc-400" /> : <MsChevronRightIcon size={12} className="text-zinc-400" />}
        </button>
        {refsOpen && (
          <div className="px-4 py-3 space-y-3">
            {refs.length > 0 && (
              <ul className="space-y-1.5">
                {refs.map(item => (
                  <li key={item.id} className="flex items-center gap-2 group">
                    {item.kind === 'link' ? <MsLinkIcon size={12} className="text-primary-400 flex-shrink-0" /> : <MsPaperclipIcon size={12} className="text-zinc-400 flex-shrink-0" />}
                    <span className="flex-1 min-w-0 text-xs text-zinc-600 truncate">
                      {item.kind === 'link'
                        ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 hover:underline inline-flex items-center gap-0.5">{item.title}<MsOutlinkIcon size={12} className="ml-0.5" /></a>
                        : item.name}
                    </span>
                    {!isReadOnly && <button onClick={() => removeRef(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-rose-500 transition-all flex-shrink-0"><MsCancelIcon size={12} /></button>}
                  </li>
                ))}
              </ul>
            )}
            {!isReadOnly && (
              <div className="space-y-2">
                <div className="flex bg-zinc-100 rounded-lg p-0.5">
                  {(['link', 'file'] as const).map(tab => (
                    <button key={tab} onClick={() => setRefTab(tab)} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${refTab === tab ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500'}`}>
                      {tab === 'link' ? <MsLinkIcon size={12} /> : <MsPaperclipIcon size={12} />}
                      {tab === 'link' ? '링크' : '파일'}
                    </button>
                  ))}
                </div>
                {refTab === 'link' ? (
                  <div className="space-y-1.5">
                    <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="https://..." className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-zinc-50 text-xs focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 focus:bg-white placeholder:text-zinc-300" />
                    <input type="text" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="제목 (선택)" className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-zinc-50 text-xs focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 focus:bg-white placeholder:text-zinc-300" />
                    <MsButton onClick={addLink} disabled={!linkUrl.trim()} size="sm" className="w-full h-auto py-1.5" leftIcon={<MsPlusIcon size={12} />}>링크 추가</MsButton>
                  </div>
                ) : (
                  <label className="w-full flex flex-col items-center justify-center gap-1.5 py-3 border-2 border-dashed border-zinc-200 rounded-lg hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer transition-colors">
                    <MsPaperclipIcon size={16} className="text-zinc-400" />
                    <span className="text-xs text-zinc-500 font-medium">파일 선택</span>
                    <input type="file" multiple className="hidden" onChange={handleFileChange} />
                  </label>
                )}
              </div>
            )}
            {refs.length === 0 && isReadOnly && <p className="text-xs text-zinc-400 text-center py-1">참고자료가 없습니다.</p>}
          </div>
        )}
      </div>

      {/* 작성 팁 */}
      {!isReadOnly && (
        <div>
          <button onClick={() => setTipsOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-950/5">
            <div className="flex items-center gap-2">
              <Lightbulb className="size-3.5 text-amber-400" />
              <span className="text-xs font-medium text-zinc-700">작성 팁</span>
            </div>
            {tipsOpen ? <MsChevronDownIcon size={12} className="text-zinc-400" /> : <MsChevronRightIcon size={12} className="text-zinc-400" />}
          </button>
          {tipsOpen && (
            <ul className="px-4 py-3 space-y-2.5">
              {WRITING_TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-zinc-300 flex-shrink-0 mt-1.5" />
                  <p className="text-xs text-zinc-500 leading-relaxed">{tip}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function MyReviewWrite() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { submissions, saveAnswer, submitSubmission, cycles, templates } = useReviewStore();
  const { users } = useTeamStore();

  const submission = submissions.find(s => s.id === submissionId);
  const cycle      = cycles.find(c => c.id === submission?.cycleId);
  const template   = templates.find(t => t.id === cycle?.templateId) ?? DEFAULT_TEMPLATE;

  const [showSuccess,    setShowSuccess]    = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [refs, setRefs] = useState<RefItem[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const isDownward = submission?.type === 'downward';

  const visibleQuestions = isDownward
    ? (template?.questions.filter(q => !q.isPrivate) ?? [])
    : (template?.questions.filter(q => q.target !== 'leader') ?? []);

  // 섹션 구성: template.sections 있으면 사용, 없으면 PAGE_SIZE 기반 fallback
  const FALLBACK_SECTION_NAMES = ['성과 돌아보기', '역량 자기평가', '성장 계획'];
  const PAGE_SIZE = 2;

  type SectionGroup = { id: string; name: string; questions: TemplateQuestion[] };

  const sectionGroups: SectionGroup[] = (() => {
    if (template?.sections && template.sections.length > 0) {
      return [...template.sections]
        .sort((a, b) => a.order - b.order)
        .map(sec => ({
          id: sec.id,
          name: sec.name,
          questions: visibleQuestions.filter(q => q.sectionId === sec.id),
        }))
        .filter(g => g.questions.length > 0);
    }
    const total = Math.max(1, Math.ceil(visibleQuestions.length / PAGE_SIZE));
    return Array.from({ length: total }, (_, i) => ({
      id: `fallback_${i}`,
      name: FALLBACK_SECTION_NAMES[i] ?? `섹션 ${i + 1}`,
      questions: visibleQuestions.slice(i * PAGE_SIZE, Math.min((i + 1) * PAGE_SIZE, visibleQuestions.length)),
    }));
  })();

  const totalSections = sectionGroups.length;

  const getAnswer = (qId: string) => submission?.answers.find(a => a.questionId === qId);

  const handleChange = useCallback((answer: Answer) => {
    if (!submissionId) return;
    saveAnswer(submissionId, answer);
  }, [submissionId, saveAnswer]);

  const completedSections = sectionGroups.map(g =>
    g.questions.every(q => {
      if (!q.isRequired) return true;
      const a = getAnswer(q.id);
      if (q.type === 'text') return !!a?.textValue?.trim();
      if (q.type === 'multiple_choice') return !!a?.selectedOptions?.length;
      return !!a?.ratingValue;
    })
  );
  const completedCount = completedSections.filter(Boolean).length;

  const scrollToSection = (i: number) =>
    sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    sectionRefs.current = sectionRefs.current.slice(0, totalSections);
  }, [totalSections]);

  if (!submission) return <div className="text-center py-20 text-zinc-400">제출물을 찾을 수 없습니다.</div>;
  if (isDownward && submission.revieweeId !== currentUser?.id) return <div className="text-center py-20 text-zinc-400">접근 권한이 없습니다.</div>;

  const cyclePastSelfReview =
    !isDownward && submission.status !== 'submitted' &&
    (cycle?.status === 'manager_review' || cycle?.status === 'closed');

  const isReadOnly = submission.status === 'submitted' || isDownward || cyclePastSelfReview;

  const managerReview = (!isDownward && isReadOnly)
    ? submissions.find(s =>
        s.revieweeId === currentUser?.id && s.cycleId === submission.cycleId &&
        s.type === 'downward' && s.status === 'submitted')
    : undefined;
  const managerReviewQuestions = managerReview ? template.questions.filter(q => !q.isPrivate) : [];
  const getManagerAnswer = (qId: string) => managerReview?.answers.find(a => a.questionId === qId);
  const managerUser = managerReview ? users.find(u => u.id === managerReview.reviewerId) : undefined;

  const handleSubmit = async () => {
    if (!submissionId || submitting) return;
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      const ratings = submission?.answers.filter(a => a.ratingValue).map(a => a.ratingValue!) || [];
      const avg = ratings.length ? ratings.reduce((s, v) => s + v, 0) / ratings.length : undefined;
      submitSubmission(submissionId, avg);
      setShowConfirm(false);
      setShowSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    if (!completedSections.every(Boolean)) {
      setShowValidation(true);
      const first = completedSections.findIndex(d => !d);
      if (first >= 0) scrollToSection(first);
      return;
    }
    setShowConfirm(true);
  };

  // ── 제출 완료 화면 ──
  if (showSuccess) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <PartyPopper className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-3">수고하셨습니다! 🎉</h1>
          <p className="text-zinc-600 mb-2">성장 돌아보기를 완료했습니다.</p>
          <p className="text-sm text-zinc-400 mb-8">리뷰가 안전하게 제출되었습니다.</p>
          <MsButton onClick={() => navigate('/')} size="lg">대시보드로 돌아가기</MsButton>
          <div className="mt-8 text-left space-y-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 text-center">다음으로 할 수 있는 것들</p>
            <button onClick={() => navigate('/feedback')} className="w-full flex items-center gap-4 p-4 bg-white border border-zinc-950/5 rounded-xl hover:border-primary-200 shadow-card transition-all text-left">
              <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0"><MsMessageIcon size={16} className="text-primary-600" /></div>
              <div><p className="text-sm font-semibold text-zinc-800">받은 피드백 확인</p><p className="text-xs text-zinc-400 mt-0.5">동료들의 피드백을 확인해보세요.</p></div>
            </button>
            <button onClick={() => navigate('/reviews/me')} className="w-full flex items-center gap-4 p-4 bg-white border border-zinc-950/5 rounded-xl hover:border-primary-200 shadow-card transition-all text-left">
              <div className="w-9 h-9 bg-zinc-50 rounded-lg flex items-center justify-center flex-shrink-0"><MsChevronLeftIcon size={16} className="text-zinc-500" /></div>
              <div><p className="text-sm font-semibold text-zinc-800">내 리뷰 목록으로</p><p className="text-xs text-zinc-400 mt-0.5">제출한 리뷰를 다시 확인할 수 있습니다.</p></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 2단 레이아웃 (중앙 스크롤 + 우측 패널) ──
  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── 중앙 ── */}
      <div className="flex-1 overflow-y-auto bg-neutral-50">

        {/* 뒤로가기 헤더 */}
        <div className="px-6 py-4 bg-white border-b border-zinc-950/5">
          <button onClick={() => navigate('/reviews/me')} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
            <MsChevronLeftIcon size={16} /> 내 리뷰 목록
          </button>
        </div>

        <div className="px-6 py-6 space-y-10">

          {/* 자기평가 기간 마감 배너 */}
          {cyclePastSelfReview && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <MsLockIcon size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">자기평가 기간이 종료되었습니다</p>
                <p className="text-xs text-amber-700 mt-0.5">리뷰가 조직장 평가 단계로 전환되었습니다.</p>
              </div>
            </div>
          )}

          {/* 병렬 보기 (결과 화면) */}
          {!isDownward && isReadOnly && managerReview && managerUser ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">리뷰 결과</h2>
                <p className="text-sm text-zinc-400 mt-0.5">자기평가와 조직장 평가를 함께 확인하세요.</p>
              </div>
              <div className="rounded-xl overflow-hidden border border-zinc-950/5 shadow-card">
                <div className="hidden md:grid md:grid-cols-2">
                  <div className="flex items-center gap-2.5 px-5 py-3 bg-zinc-50 border-b border-r border-zinc-950/5">
                    {currentUser && <UserAvatar user={currentUser} size="sm" />}
                    <div><p className="text-xs font-semibold text-zinc-700">내 자기평가</p><p className="text-xs text-zinc-400">읽기 전용</p></div>
                  </div>
                  <div className="flex items-center gap-2.5 px-5 py-3 bg-primary-50/60 border-b border-zinc-950/5">
                    <UserAvatar user={managerUser} size="sm" />
                    <div><p className="text-xs font-semibold text-primary-700">{managerUser.name}님의 평가</p><p className="text-xs text-primary-500/70">조직장 평가</p></div>
                  </div>
                </div>
                {managerReviewQuestions.map((q, idx) => {
                  const isLast = idx === managerReviewQuestions.length - 1;
                  return (
                    <div key={q.id}>
                      <div className="px-5 py-3 bg-white flex items-start gap-1.5 border-t border-zinc-950/5">
                        <span className="text-sm text-zinc-400 flex-shrink-0 mt-px">{idx + 1}.</span>
                        <p className="text-sm font-semibold text-zinc-800">{q.text}</p>
                      </div>
                      <div className={`grid grid-cols-1 md:grid-cols-2 ${!isLast ? 'border-b border-zinc-950/5' : ''}`}>
                        <div className="px-5 py-4 bg-zinc-50/30 md:border-r border-zinc-950/5">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2 md:hidden">내 자기평가</p>
                          <InputAnswerContent question={q} answer={getAnswer(q.id)} />
                        </div>
                        <div className="px-5 py-4 bg-white">
                          <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-2 md:hidden">{managerUser.name}님 평가</p>
                          <FlatAnswerContent question={q} answer={getManagerAnswer(q.id)} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 섹션별 질문 (스크롤) */
            sectionGroups.map((group, sectionIdx) => (
              <section
                key={group.id}
                ref={el => { sectionRefs.current[sectionIdx] = el; }}
                className="scroll-mt-6 space-y-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                  <h2 className="text-base font-semibold text-zinc-900">
                    {isDownward
                      ? `${users.find(u => u.id === submission.reviewerId)?.name ?? '조직장'}님의 평가`
                      : group.name}
                  </h2>
                </div>
                {isReadOnly
                  ? group.questions.map(q => (
                      <QuestionCard key={q.id} question={q} answer={getAnswer(q.id)} onChange={() => {}} readOnly />
                    ))
                  : group.questions.map(q => (
                      <QuestionCard key={q.id} question={q} answer={getAnswer(q.id)} onChange={handleChange} showError={showValidation} />
                    ))
                }
              </section>
            ))
          )}

          {/* 제출 완료 배너 */}
          {isReadOnly && (
            <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <MsCheckIcon size={20} className="text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-700">
                {isDownward ? '조직장이 작성한 평가입니다.' : '자기평가가 제출되었습니다.'}
              </p>
            </div>
          )}

          {/* 조직장 평가 대기 */}
          {!isDownward && isReadOnly && !managerReview && (
            <div className="flex items-center gap-2.5 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <MsProfileIcon size={20} className="text-zinc-400 flex-shrink-0" />
              <p className="text-sm text-zinc-500">조직장 평가가 제출되면 여기에 표시됩니다.</p>
            </div>
          )}

          {/* 제출 버튼 */}
          {!isReadOnly && (
            <div className="pb-10 space-y-2">
              {showValidation && !completedSections.every(Boolean) && (
                <p className="text-sm text-rose-600 mb-3 text-center">필수 항목을 모두 작성한 후 제출해주세요.</p>
              )}
              <button
                onClick={() => {
                  setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
                  setTimeout(() => setSavedAt(null), 3000);
                }}
                className="w-full py-2.5 border border-zinc-200 bg-white text-zinc-600 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savedAt ? `✓ ${savedAt}에 저장됨` : '임시 저장'}
              </button>
              <MsButton onClick={handleSubmitClick} className="w-full h-auto py-3 rounded-xl">
                검토 및 제출하기
              </MsButton>
            </div>
          )}
        </div>
      </div>

      {/* ── 우측 패널 ── */}
      <RightPanel
        cycle={cycle} isReadOnly={isReadOnly} submission={submission}
        template={template} currentUser={currentUser ?? null}
        completedCount={completedCount} totalSections={totalSections}
        refs={refs} setRefs={setRefs}
        isDownward={isDownward} reviewerId={submission.reviewerId} users={users}
      />

      {/* 제출 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-sm w-full p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <MsCheckIcon size={24} className="text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">최종 제출하시겠습니까?</h3>
              <p className="text-sm text-zinc-500">제출 후에는 수정할 수 없습니다.</p>
            </div>
            <div className="flex gap-3">
              <MsButton variant="default" onClick={() => setShowConfirm(false)} disabled={submitting} className="flex-1 h-auto py-2.5">취소</MsButton>
              <MsButton loading={submitting} onClick={handleSubmit} className="flex-1 h-auto py-2.5">제출</MsButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
