import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Check, HelpCircle, Lock,
  PartyPopper, MessageSquare, Download, Calendar,
  ShieldCheck, Lightbulb, FileText, ChevronDown,
  Link2, Paperclip, ExternalLink, X, Plus, UserCheck,
} from 'lucide-react';
import { LoadingButton } from '../../components/ui/LoadingButton';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';
import { submissionWriter } from '../../utils/reviewSheetWriter';
import { exportSubmissionToCSV } from '../../utils/exportUtils';
import { DEFAULT_TEMPLATE } from '../../data/defaultTemplate';
import { AutoSaveIndicator } from '../../components/ui/AutoSaveIndicator';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useAutoSave } from '../../hooks/useAutoSave';
import { formatDate } from '../../utils/dateUtils';
import type { TemplateQuestion, Answer, ReviewCycle, ReviewSubmission, ReviewTemplate, User } from '../../types';

// ─── 별점 선택기 ──────────────────────────────────────────────────────────────
function RatingSelector({ question: _question, value, onChange, disabled }: {
  question: TemplateQuestion; value?: number; onChange: (v: number) => void; disabled?: boolean;
}) {
  const LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];
  return (
    <div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            aria-label={`${n}점: ${LABELS[n]}`}
            aria-pressed={value === n}
            className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
              value === n
                ? 'border-primary-500 bg-primary-600 text-white'
                : disabled
                  ? 'border-zinc-100 bg-zinc-50 text-zinc-300 cursor-not-allowed'
                  : 'border-zinc-200 hover:border-primary-300 text-zinc-600'
            }`}
          >
            {n}
          </button>
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

  const isUnanswered = showError && question.isRequired && !readOnly &&
    (question.type === 'text' ? !answer?.textValue?.trim() : !answer?.ratingValue);

  return (
    <div className={`bg-white rounded-xl border p-5 ${
      isUnanswered
        ? 'border-rose-300 bg-rose-50/20'
        : question.isPrivate
          ? 'border-zinc-200 bg-zinc-50/50'
          : 'border-zinc-950/5 shadow-card'
    }`}>
      {question.isPrivate && (
        <div className="flex items-center gap-1.5 mb-2">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-400">매니저 전용</span>
        </div>
      )}
      <div className="flex items-start gap-2 mb-3">
        <p className="text-sm font-semibold text-zinc-800 flex-1 leading-snug">
          {question.text}
          {question.isRequired && <span className="text-rose-500 ml-1">*</span>}
        </p>
        {question.helpText && (
          <button
            onClick={() => setHelpOpen(o => !o)}
            className="text-zinc-400 hover:text-zinc-600 flex-shrink-0 mt-0.5"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {helpOpen && question.helpText && (
        <div className="mb-3 p-3 bg-primary-50 rounded-xl border border-primary-100">
          <p className="text-xs text-primary-700 mb-1.5 font-medium">이 질문의 의도</p>
          <p className="text-xs text-primary-600">{question.helpText}</p>
          {question.exampleAnswer && (
            <>
              <p className="text-xs text-primary-700 font-medium mt-2 mb-1">예시 답변</p>
              <p className="text-xs text-primary-600 italic">{question.exampleAnswer}</p>
            </>
          )}
        </div>
      )}

      {(question.type === 'rating' || question.type === 'competency') && (
        <RatingSelector
          question={question}
          value={answer?.ratingValue}
          onChange={v => onChange({ questionId: question.id, ratingValue: v })}
          disabled={readOnly}
        />
      )}
      {question.type === 'text' && (
        <div>
          <textarea
            value={answer?.textValue || ''}
            onChange={e => onChange({ questionId: question.id, textValue: e.target.value })}
            disabled={readOnly}
            rows={5}
            maxLength={1000}
            placeholder={readOnly ? '' : '구체적인 사례와 수치를 포함해 작성하세요.'}
            className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg bg-zinc-50 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:bg-white disabled:bg-zinc-50 disabled:text-zinc-500 placeholder:text-zinc-300 resize-none"
          />
          <div className="flex justify-between mt-1">
            {!readOnly && answer?.textValue && answer.textValue.length < 50 && (
              <p className="text-xs text-primary-600">💡 좀 더 구체적으로 작성하면 더 좋아요!</p>
            )}
            {!readOnly && answer?.textValue && answer.textValue.length >= 50 && (
              <p className="text-xs text-emerald-600">잘 작성하고 계십니다!</p>
            )}
            {(!readOnly && !answer?.textValue) && <span />}
            <p className="text-xs text-zinc-400 ml-auto">{(answer?.textValue || '').length}/1000</p>
          </div>
        </div>
      )}
      {isUnanswered && (
        <p className="mt-2 text-xs text-rose-600">필수 항목입니다. 답변을 입력해주세요.</p>
      )}
    </div>
  );
}

// ─── 참고자료 타입 ────────────────────────────────────────────────────────────
type RefLink = { id: string; kind: 'link'; title: string; url: string };
type RefFile = { id: string; kind: 'file'; name: string; size: string };
type RefItem = RefLink | RefFile;

// ─── 병렬 보기용 공통 상수 ────────────────────────────────────────────────────
const FLAT_RATING_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

// ─── 병렬 보기 — 자기평가 셀 (zinc/neutral 톤, 읽기 전용) ────────────────────
function InputAnswerContent({ question, answer }: {
  question: TemplateQuestion;
  answer?: Answer;
}) {
  const rating = answer?.ratingValue;
  const text   = answer?.textValue;

  if (question.type === 'rating' || question.type === 'competency') {
    return rating ? (
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${
              n === rating ? 'bg-zinc-700 text-white'
              : n < rating  ? 'bg-zinc-200 text-zinc-500'
              : 'bg-zinc-100 text-zinc-300'
            }`}>{n}</span>
          ))}
        </div>
        <span className="text-sm font-semibold text-zinc-700">{rating}점</span>
        <span className="text-xs text-zinc-500 font-medium">{FLAT_RATING_LABELS[rating]}</span>
      </div>
    ) : (
      <p className="text-sm text-zinc-400 italic">미응답</p>
    );
  }

  return text?.trim()
    ? <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{text}</p>
    : <p className="text-sm text-zinc-400 italic">미응답</p>;
}

// ─── 병렬 보기 — 조직장 평가 셀 (primary 톤, 읽기 전용) ───────────────────────
function FlatAnswerContent({ question, answer }: {
  question: TemplateQuestion;
  answer?: Answer;
}) {
  const rating = answer?.ratingValue;
  const text   = answer?.textValue;

  if (question.type === 'rating' || question.type === 'competency') {
    return rating ? (
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <span key={n} className={`inline-flex w-5 h-5 rounded-full text-xs font-bold items-center justify-center ${
              n === rating ? 'bg-primary-600 text-white'
              : n < rating  ? 'bg-primary-100 text-primary-400'
              : 'bg-zinc-100 text-zinc-300'
            }`}>{n}</span>
          ))}
        </div>
        <span className="text-sm font-semibold text-zinc-700">{rating}점</span>
        <span className="text-xs text-primary-600 font-medium">{FLAT_RATING_LABELS[rating]}</span>
      </div>
    ) : (
      <p className="text-sm text-zinc-400 italic">미응답</p>
    );
  }

  return text?.trim()
    ? <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{text}</p>
    : <p className="text-sm text-zinc-400 italic">미응답</p>;
}

// ─── 우측 패널 ────────────────────────────────────────────────────────────────
const WRITING_TIPS = [
  '구체적인 수치와 사례를 들어 작성하면 더욱 설득력 있습니다.',
  '기간 내 실제 경험을 바탕으로 작성해주세요.',
  '잘한 점과 개선할 점을 균형 있게 서술하세요.',
  '다음 목표와 연결 지어 성장 계획을 작성하면 좋습니다.',
];

function RightPanel({
  cycle,
  isReadOnly,
  submission,
  template,
  currentUser,
  completedCount,
  totalSections,
  inReview,
  onSubmit,
  onCancelReview,
  submitting,
  refs,
  setRefs,
  isDownward,
  reviewerId,
}: {
  cycle: ReviewCycle | undefined;
  isReadOnly: boolean;
  submission: ReviewSubmission | undefined;
  template: ReviewTemplate | undefined;
  currentUser: User | null;
  completedCount: number;
  totalSections: number;
  inReview: boolean;
  onSubmit: () => void;
  onCancelReview: () => void;
  submitting: boolean;
  refs: RefItem[];
  setRefs: React.Dispatch<React.SetStateAction<RefItem[]>>;
  isDownward?: boolean;
  reviewerId?: string;
}) {
  const [tipsOpen, setTipsOpen] = useState(true);
  const [refsOpen, setRefsOpen] = useState(true);
  const [refTab, setRefTab] = useState<'link' | 'file'>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const safeUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    setRefs(prev => [...prev, { id: crypto.randomUUID(), kind: 'link', title: linkTitle.trim() || safeUrl, url: safeUrl }]);
    setLinkUrl('');
    setLinkTitle('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newItems: RefFile[] = files.map(f => ({
      id: crypto.randomUUID(),
      kind: 'file',
      name: f.name,
      size: f.size < 1024 * 1024
        ? `${(f.size / 1024).toFixed(0)} KB`
        : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
    }));
    setRefs(prev => [...prev, ...newItems]);
    e.target.value = '';
  };

  const removeRef = (id: string) => setRefs(prev => prev.filter(r => r.id !== id));

  return (
    <div className="hidden lg:flex w-72 bg-white border-l border-zinc-950/5 flex-col flex-shrink-0 overflow-y-auto">

      {/* 리뷰 정보 */}
      <div className="p-4 border-b border-zinc-950/5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-primary-50 flex items-center justify-center flex-shrink-0">
            <FileText className="size-3.5 text-primary-600" />
          </div>
          <p className="text-xs font-semibold text-zinc-950">리뷰 정보</p>
        </div>

        {/* 조직장 평가: 작성자 정보 */}
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

        {/* 리뷰 주기명 */}
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-0.5">리뷰 주기</p>
          <p className="text-xs font-medium text-zinc-700 leading-snug">{cycle?.title ?? '—'}</p>
        </div>

        {/* 마감일 */}
        <div className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg">
          <Calendar className="size-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-zinc-400">자기평가 마감</p>
            <p className="text-xs font-medium text-zinc-700">
              {cycle ? formatDate(cycle.selfReviewDeadline) : '—'}
            </p>
          </div>
        </div>

        {/* 개인정보 보호 */}
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-950/5">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="size-3.5 text-zinc-500" />
            <p className="text-xs font-semibold text-zinc-600">개인정보 보호</p>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            작성 내용은 제출 전까지 본인만 볼 수 있습니다. 제출 후에는 담당 매니저와 관리자만 열람합니다.
          </p>
        </div>

        {/* 진행률 */}
        {!isReadOnly && (
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">작성 진행률</p>
            <ProgressBar value={completedCount} max={totalSections} showPercent />
            <p className="text-xs text-zinc-400 mt-1.5">{completedCount}/{totalSections} 섹션 완료</p>
          </div>
        )}

        {/* 관리자용 CSV */}
        {isReadOnly && currentUser?.role === 'admin' && submission && template && cycle && (
          <button
            onClick={() => exportSubmissionToCSV(
              submission, template, cycle,
              users.find(u => u.id === submission.revieweeId) ?? currentUser,
              currentUser,
            )}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <Download className="size-3.5" /> CSV 내보내기
          </button>
        )}
      </div>

      {/* 전체 검토 제출 영역 */}
      {inReview && (
        <div className="p-4 border-b border-zinc-950/5 space-y-3">
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
            <Check className="size-4 text-emerald-600 flex-shrink-0" />
            <p className="text-xs text-emerald-700 font-medium">모든 항목을 검토했습니다.</p>
          </div>
          <LoadingButton
            loading={submitting}
            onClick={onSubmit}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors"
          >
            최종 제출하기
          </LoadingButton>
          <button
            onClick={onCancelReview}
            className="w-full py-2.5 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            수정하기
          </button>
        </div>
      )}

      {/* 참고자료 */}
      <div>
        <button
          onClick={() => setRefsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-950/5"
        >
          <div className="flex items-center gap-2">
            <Paperclip className="size-3.5 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-700">참고자료</span>
            {refs.length > 0 && (
              <span className="text-xs font-bold bg-primary-100 text-primary-600 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none">
                {refs.length}
              </span>
            )}
          </div>
          {refsOpen
            ? <ChevronDown className="size-3.5 text-zinc-400" />
            : <ChevronRight className="size-3.5 text-zinc-400" />
          }
        </button>
        {refsOpen && (
          <div className="px-4 py-3 space-y-3">
            {/* 추가된 항목 목록 */}
            {refs.length > 0 && (
              <ul className="space-y-1.5">
                {refs.map(item => (
                  <li key={item.id} className="flex items-center gap-2 group">
                    {item.kind === 'link' ? (
                      <Link2 className="size-3.5 text-primary-400 flex-shrink-0" />
                    ) : (
                      <Paperclip className="size-3.5 text-zinc-400 flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 text-xs text-zinc-600 truncate leading-snug">
                      {item.kind === 'link' ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary-600 hover:underline inline-flex items-center gap-0.5"
                        >
                          {item.title}
                          <ExternalLink className="size-2.5 flex-shrink-0 ml-0.5" />
                        </a>
                      ) : (
                        item.name
                      )}
                    </span>
                    {!isReadOnly && (
                      <button
                        onClick={() => removeRef(item.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-rose-500 transition-all flex-shrink-0"
                        aria-label="삭제"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* 추가 폼 (작성 중일 때만) */}
            {!isReadOnly && (
              <div className="space-y-2">
                {/* 탭 */}
                <div className="flex bg-zinc-100 rounded-lg p-0.5">
                  {(['link', 'file'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setRefTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        refTab === tab ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500'
                      }`}
                    >
                      {tab === 'link' ? <Link2 className="size-3" /> : <Paperclip className="size-3" />}
                      {tab === 'link' ? '링크' : '파일'}
                    </button>
                  ))}
                </div>

                {refTab === 'link' ? (
                  <div className="space-y-1.5">
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addLink()}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-zinc-50 text-xs focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 focus:bg-white placeholder:text-zinc-300"
                    />
                    <input
                      type="text"
                      value={linkTitle}
                      onChange={e => setLinkTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addLink()}
                      placeholder="제목 (선택)"
                      className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg bg-zinc-50 text-xs focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 focus:bg-white placeholder:text-zinc-300"
                    />
                    <button
                      onClick={addLink}
                      disabled={!linkUrl.trim()}
                      className="w-full flex items-center justify-center gap-1 py-1.5 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="size-3" /> 링크 추가
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="w-full flex flex-col items-center justify-center gap-1.5 py-3 border-2 border-dashed border-zinc-200 rounded-lg hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer transition-colors">
                      <Paperclip className="size-4 text-zinc-400" />
                      <span className="text-xs text-zinc-500 font-medium">파일 선택</span>
                      <span className="text-xs text-zinc-400">클릭하여 업로드</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {refs.length === 0 && isReadOnly && (
              <p className="text-xs text-zinc-400 text-center py-1">참고자료가 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* 작성 팁 (작성 중일 때만) */}
      {!isReadOnly && !inReview && (
        <div>
          <button
            onClick={() => setTipsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-950/5"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="size-3.5 text-amber-400" />
              <span className="text-xs font-medium text-zinc-700">작성 팁</span>
            </div>
            {tipsOpen
              ? <ChevronDown className="size-3.5 text-zinc-400" />
              : <ChevronRight className="size-3.5 text-zinc-400" />
            }
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
  const { reviewSyncEnabled } = useSheetsSyncStore();

  const submission = submissions.find(s => s.id === submissionId);
  const cycle = cycles.find(c => c.id === submission?.cycleId);
  const template = templates.find(t => t.id === cycle?.templateId) ?? DEFAULT_TEMPLATE;

  const [currentSection, setCurrentSection] = useState(0);
  const [inReview, setInReview] = useState(false);

  useEffect(() => {
    setCurrentSection(0);
    setInReview(false);
  }, [submissionId]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [refs, setRefs] = useState<RefItem[]>([]);

  // 조직장이 나에 대해 작성한 하향 리뷰 여부 (얼리 리턴 전에 선언해야 visibleQuestions에서 참조 가능)
  const isDownward = submission?.type === 'downward';

  // 셀프: 매니저 전용 질문 제외 / 하향(팀장이 작성): 비공개(매니저 전용) 질문 제외하고 공개 질문만 표시
  const visibleQuestions = isDownward
    ? (template?.questions.filter(q => !q.isPrivate) ?? [])
    : (template?.questions.filter(q => q.target !== 'leader') ?? []);

  const PAGE_SIZE = 2;
  const NAMED_SECTIONS = ['성과 돌아보기', '역량 자기평가', '성장 계획'];
  const totalSections = Math.max(1, Math.ceil(visibleQuestions.length / PAGE_SIZE));
  const sectionRanges: [number, number][] = Array.from({ length: totalSections }, (_, i) => [
    i * PAGE_SIZE,
    Math.min((i + 1) * PAGE_SIZE, visibleQuestions.length),
  ]);
  const sectionNames = Array.from({ length: totalSections }, (_, i) =>
    NAMED_SECTIONS[i] ?? `섹션 ${i + 1}`
  );

  const safeSection = Math.min(currentSection, totalSections - 1);
  const sectionQuestions = visibleQuestions.slice(sectionRanges[safeSection][0], sectionRanges[safeSection][1]);

  const getAnswer = (qId: string) => submission?.answers.find(a => a.questionId === qId);

  const onSave = useCallback(async () => {
    if (!submissionId || !reviewSyncEnabled) return;
    const latest = useReviewStore.getState().submissions.find(s => s.id === submissionId);
    if (latest) submissionWriter.upsert(latest);
  }, [submissionId, reviewSyncEnabled]);
  const { saveState, savedTime, triggerSave } = useAutoSave(onSave);

  const handleChange = useCallback((answer: Answer) => {
    if (!submissionId) return;
    saveAnswer(submissionId, answer);
    triggerSave();
  }, [submissionId, saveAnswer, triggerSave]);

  const completedSections = sectionRanges.map(([start, end]) =>
    visibleQuestions.slice(start, end).every(q => {
      if (!q.isRequired) return true;
      const a = getAnswer(q.id);
      return q.type === 'text' ? !!a?.textValue?.trim() : !!a?.ratingValue;
    })
  );
  const completedCount = completedSections.filter(Boolean).length;

  const handleSubmit = async () => {
    if (!submissionId || submitting) return;
    setSubmitting(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      const ratings = submission?.answers.filter(a => a.ratingValue).map(a => a.ratingValue!) || [];
      const avg = ratings.length ? ratings.reduce((s, v) => s + v, 0) / ratings.length : undefined;
      submitSubmission(submissionId, avg);
      setShowConfirm(false);
      setInReview(false);
      setShowSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!submission) {
    return <div className="text-center py-20 text-zinc-400">제출물을 찾을 수 없습니다.</div>;
  }

  // 하향 리뷰 접근 제어
  if (isDownward && submission.revieweeId !== currentUser?.id) {
    return <div className="text-center py-20 text-zinc-400">접근 권한이 없습니다.</div>;
  }

  // 사이클이 조직장 리뷰 또는 종료 단계에 진입하면 자기평가 잠금
  const cyclePastSelfReview =
    !isDownward &&
    submission.status !== 'submitted' &&
    (cycle?.status === 'manager_review' || cycle?.status === 'closed');

  const isReadOnly = submission.status === 'submitted' || isDownward || cyclePastSelfReview;

  // 셀프 리뷰를 보는 경우, 같은 주기에 제출 완료된 조직장 하향 평가 찾기
  const managerReview = (!isDownward && isReadOnly)
    ? submissions.find(s =>
        s.revieweeId === currentUser?.id &&
        s.cycleId === submission.cycleId &&
        s.type === 'downward' &&
        s.status === 'submitted'
      )
    : undefined;
  const managerReviewQuestions = managerReview
    ? (template.questions.filter(q => !q.isPrivate))
    : [];
  const getManagerAnswer = (qId: string) => managerReview?.answers.find(a => a.questionId === qId);
  const managerUser = managerReview ? users.find(u => u.id === managerReview.reviewerId) : undefined;

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
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
          >
            대시보드로 돌아가기
          </button>
          <div className="mt-8 text-left space-y-2">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 text-center">다음으로 할 수 있는 것들</p>
            <button
              onClick={() => navigate('/feedback')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-zinc-950/5 rounded-xl hover:border-primary-200 shadow-card hover:shadow-card-hover transition-all text-left"
            >
              <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-[18px] h-[18px] text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">받은 피드백 확인</p>
                <p className="text-xs text-zinc-400 mt-0.5">동료들의 피드백을 확인해보세요.</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/reviews/me')}
              className="w-full flex items-center gap-4 p-4 bg-white border border-zinc-950/5 rounded-xl hover:border-primary-200 shadow-card hover:shadow-card-hover transition-all text-left"
            >
              <div className="w-9 h-9 bg-zinc-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChevronLeft className="w-[18px] h-[18px] text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">내 리뷰 목록으로</p>
                <p className="text-xs text-zinc-400 mt-0.5">제출한 리뷰를 다시 확인할 수 있습니다.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 3단 레이아웃 ──
  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── 좌측: 섹션 내비게이션 ── */}
      <div className="hidden md:flex w-56 bg-white border-r border-zinc-950/5 flex-col flex-shrink-0">
        {/* 뒤로가기 */}
        <div className="px-4 py-4 border-b border-zinc-950/5">
          <button
            onClick={() => navigate('/reviews/me')}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 내 리뷰 목록
          </button>
        </div>

        {/* 섹션 목록 */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-2.5 mb-2">
            {isDownward ? '평가 내용' : '섹션'}
          </p>
          {sectionNames.slice(0, totalSections).map((name, i) => {
            const isActive = !inReview && currentSection === i;
            const isDone = completedSections[i];
            return (
              <button
                key={i}
                onClick={() => { setInReview(false); setCurrentSection(i); }}
                className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                }`}
              >
                <span className={`size-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isDone
                    ? 'border-emerald-500 bg-emerald-500'
                    : isActive
                      ? 'border-primary-500'
                      : 'border-zinc-300'
                }`}>
                  {isDone && <Check className="size-2.5 text-white stroke-[3]" />}
                </span>
                {name}
              </button>
            );
          })}

          {/* 전체 검토 버튼 */}
          {!isReadOnly && !isDownward && (
            <button
              onClick={() => { if (completedCount === totalSections) setInReview(true); }}
              className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-xs font-medium transition-colors mt-2 ${
                inReview
                  ? 'bg-primary-50 text-primary-700'
                  : completedCount === totalSections
                    ? 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
                    : 'text-zinc-300 cursor-not-allowed'
              }`}
              disabled={completedCount < totalSections}
              title={completedCount < totalSections ? '모든 섹션을 완료해야 합니다.' : undefined}
            >
              <span className={`size-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                inReview ? 'border-primary-500' : 'border-zinc-200'
              }`} />
              전체 검토
            </button>
          )}
        </nav>

        {/* 진행률 (하단) */}
        {!isReadOnly && (
          <div className="p-4 border-t border-zinc-950/5">
            <p className="text-xs text-zinc-400 mb-1.5">{completedCount}/{totalSections} 섹션 완료</p>
            <ProgressBar value={completedCount} max={totalSections} />
          </div>
        )}
      </div>

      {/* ── 중앙: 질문 영역 ── */}
      <div className="flex-1 overflow-y-auto bg-neutral-50">

        {/* 모바일 섹션 탭 */}
        <div className="flex md:hidden gap-2 overflow-x-auto px-4 py-3 bg-white border-b border-zinc-950/5 sticky top-0 z-10">
          {sectionNames.slice(0, totalSections).map((name, i) => (
            <button
              key={i}
              onClick={() => { setInReview(false); setCurrentSection(i); }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                !inReview && currentSection === i
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {completedSections[i] && <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
              {name}
            </button>
          ))}
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* 섹션 헤더 */}
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                {isDownward
                  ? `${users.find(u => u.id === submission.reviewerId)?.name ?? '조직장'}님의 평가`
                  : (isReadOnly && managerReview)
                    ? '리뷰 결과'
                    : isReadOnly
                      ? '제출한 리뷰'
                      : inReview
                        ? '전체 검토'
                        : sectionNames[currentSection]}
              </h2>
              {isDownward && (
                <p className="text-xs text-zinc-400 mt-0.5">조직장이 작성한 평가입니다. 수정할 수 없습니다.</p>
              )}
              {!isDownward && isReadOnly && managerReview && (
                <p className="text-xs text-zinc-400 mt-0.5">자기평가와 조직장 평가를 함께 확인하세요.</p>
              )}
              {!isDownward && isReadOnly && !managerReview && !cyclePastSelfReview && (
                <p className="text-xs text-zinc-400 mt-0.5">제출된 내용입니다. 수정할 수 없습니다.</p>
              )}
              {!isDownward && !isReadOnly && inReview && (
                <p className="text-xs text-zinc-400 mt-0.5">내용을 최종 확인하고 제출하세요.</p>
              )}
            </div>
          </div>

          {/* ── 자기평가 기간 마감 배너 ── */}
          {cyclePastSelfReview && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">자기평가 기간이 종료되었습니다</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  리뷰가 조직장 평가 단계로 전환되었습니다. 자기평가를 더 이상 수정하거나 제출할 수 없습니다.
                </p>
              </div>
            </div>
          )}

          {/* ── 셀프 + 조직장 평가 병렬 보기 ── */}
          {!isDownward && isReadOnly && managerReview && managerUser ? (
            <div className="rounded-xl overflow-hidden border border-zinc-950/5 shadow-card">
              {/* 컬럼 헤더 (데스크톱) */}
              <div className="hidden md:grid md:grid-cols-2">
                <div className="flex items-center gap-2.5 px-5 py-3 bg-zinc-50 border-b border-r border-zinc-950/5">
                  {currentUser && <UserAvatar user={currentUser} size="sm" />}
                  <div>
                    <p className="text-xs font-semibold text-zinc-700">내 자기평가</p>
                    <p className="text-xs text-zinc-400">읽기 전용</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 px-5 py-3 bg-primary-50/60 border-b border-zinc-950/5">
                  <UserAvatar user={managerUser} size="sm" />
                  <div>
                    <p className="text-xs font-semibold text-primary-700">{managerUser.name}님의 평가</p>
                    <p className="text-xs text-primary-500/70">조직장 평가</p>
                  </div>
                </div>
              </div>

              {/* 질문별 병렬 행 */}
              {managerReviewQuestions.map((q, idx) => {
                const selfAns = getAnswer(q.id);
                const mgrAns  = getManagerAnswer(q.id);
                const isLast  = idx === managerReviewQuestions.length - 1;
                return (
                  <div key={q.id}>
                    {/* 질문 타이틀 */}
                    <div className="px-5 py-3 bg-white flex items-start gap-1.5 border-t border-zinc-950/5">
                      <span className="text-sm text-zinc-400 flex-shrink-0 mt-px">{idx + 1}.</span>
                      <p className="text-sm font-semibold text-zinc-800">{q.text}</p>
                    </div>
                    {/* 답변 셀 */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 ${!isLast ? 'border-b border-zinc-950/5' : ''}`}>
                      {/* 셀프 답변 */}
                      <div className="px-5 py-4 bg-zinc-50/30 md:border-r border-zinc-950/5">
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2 md:hidden">내 자기평가</p>
                        <InputAnswerContent question={q} answer={selfAns} />
                      </div>
                      {/* 팀장 답변 */}
                      <div className="px-5 py-4 bg-white">
                        <p className="text-xs font-semibold text-primary-500 uppercase tracking-wide mb-2 md:hidden">{managerUser.name}님 평가</p>
                        <FlatAnswerContent question={q} answer={mgrAns} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 기존 단일 컬럼 렌더링 */
            <>
              {(isReadOnly || inReview) ? (
                visibleQuestions.map(q => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    answer={getAnswer(q.id)}
                    onChange={() => {}}
                    readOnly
                  />
                ))
              ) : (
                sectionQuestions.map(q => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    answer={getAnswer(q.id)}
                    onChange={handleChange}
                    showError={showValidation}
                  />
                ))
              )}
            </>
          )}

          {/* 제출 완료 배너 */}
          {isReadOnly && (
            <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-700">
                {isDownward ? '조직장이 작성한 평가입니다.' : '자기평가가 제출되었습니다.'}
              </p>
            </div>
          )}

          {/* 조직장 평가 대기 안내 */}
          {!isDownward && isReadOnly && !managerReview && (
            <div className="flex items-center gap-2.5 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
              <UserCheck className="w-5 h-5 text-zinc-400 flex-shrink-0" />
              <p className="text-sm text-zinc-500">조직장 평가가 제출되면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>

        {/* 하단 내비게이션 바 */}
        {!isReadOnly && !inReview && (
          <div className="sticky bottom-0 px-5 pb-5">
            <div className="flex items-center justify-between bg-white rounded-xl border border-zinc-950/5 px-4 py-3 shadow-raised">
              <button
                onClick={() => setCurrentSection(s => Math.max(s - 1, 0))}
                disabled={currentSection === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> 이전
              </button>

              <AutoSaveIndicator state={saveState} savedTime={savedTime} />

              {currentSection < totalSections - 1 ? (
                <button
                  onClick={() => { setShowValidation(false); setCurrentSection(s => Math.min(s + 1, totalSections - 1)); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
                >
                  다음 <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!completedSections[safeSection]) { setShowValidation(true); return; }
                    setShowValidation(false);
                    setInReview(true);
                  }}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors"
                >
                  전체 검토하기
                </button>
              )}
            </div>
          </div>
        )}

        {/* 모바일 전체 검토 제출 버튼 */}
        {inReview && (
          <div className="sticky bottom-0 px-5 pb-5 lg:hidden">
            <div className="flex gap-3 bg-white rounded-xl border border-zinc-950/5 p-3 shadow-raised">
              <button
                onClick={() => setInReview(false)}
                className="flex-1 py-2.5 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                수정하기
              </button>
              <LoadingButton
                loading={submitting}
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
              >
                최종 제출하기
              </LoadingButton>
            </div>
          </div>
        )}
      </div>

      {/* ── 우측 패널 ── */}
      <RightPanel
        cycle={cycle}
        isReadOnly={isReadOnly}
        submission={submission}
        template={template}
        currentUser={currentUser ?? null}
        completedCount={completedCount}
        totalSections={totalSections}
        inReview={inReview}
        onSubmit={handleSubmit}
        onCancelReview={() => setInReview(false)}
        submitting={submitting}
        refs={refs}
        setRefs={setRefs}
        isDownward={isDownward}
        reviewerId={submission.reviewerId}
      />

      {/* 제출 확인 모달 (읽기 전용 상태에서 직접 제출 시 fallback) */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-sm w-full p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-2">최종 제출하시겠습니까?</h3>
              <p className="text-sm text-zinc-500">제출 후에는 수정할 수 없습니다.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 py-2.5 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                취소
              </button>
              <LoadingButton
                loading={submitting}
                onClick={handleSubmit}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
              >
                제출
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
