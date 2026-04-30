import { useMemo, useState } from 'react';
import { ModalShell } from '../review/modals/ModalShell';
import { MsButton } from '../ui/MsButton';
import { MsLockIcon } from '../ui/MsIcons';
import type { TemplateQuestion, TemplateSection } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  name: string;
  description: string;
  sections: TemplateSection[];
  questions: TemplateQuestion[];
}

type TargetFilter = 'self' | 'leader' | 'both';

const TARGET_TABS: { val: TargetFilter; label: string; help: string }[] = [
  { val: 'self',   label: '자기평가',  help: '평가 대상자 본인이 보는 화면 — self / both 질문' },
  { val: 'leader', label: '매니저 평가', help: '평가권자가 보는 화면 — leader / both 질문 (비공개 포함)' },
  { val: 'both',   label: '전체',      help: '모든 질문 (target 무관)' },
];

const RATING_LABELS = ['', '매우 미흡', '미흡', '보통', '우수', '매우 우수'];

export function TemplatePreviewModal({ open, onClose, name, description, sections, questions }: Props) {
  const [target, setTarget] = useState<TargetFilter>('self');

  const visibleQuestions = useMemo(() => {
    if (target === 'both') return questions;
    if (target === 'self')   return questions.filter(q => q.target === 'self'   || q.target === 'both');
    if (target === 'leader') return questions.filter(q => q.target === 'leader' || q.target === 'both');
    return questions;
  }, [questions, target]);

  const visibleSections = useMemo(() => {
    if (sections.length === 0) {
      return [{ id: 'fallback', name: '문항', order: 0, qs: visibleQuestions }];
    }
    return [...sections]
      .sort((a, b) => a.order - b.order)
      .map(sec => ({
        id: sec.id,
        name: sec.name,
        order: sec.order,
        qs: visibleQuestions.filter(q => q.sectionId === sec.id),
      }))
      .filter(s => s.qs.length > 0);
  }, [sections, visibleQuestions]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`미리보기 — ${name.trim() || '제목 없음'}`}
      description={description.trim() || undefined}
      widthClass="max-w-3xl"
      footer={<MsButton size="sm" variant="ghost" onClick={onClose}>닫기</MsButton>}
    >
      <div className="space-y-5">
        {/* target 토글 */}
        <div>
          <div className="inline-flex rounded-lg border border-bd-default bg-gray-005 p-0.5">
            {TARGET_TABS.map(tab => (
              <button
                key={tab.val}
                type="button"
                onClick={() => setTarget(tab.val)}
                className={`px-3 h-7 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  target === tab.val ? 'bg-white text-gray-080 shadow-sm' : 'text-fg-subtle hover:text-gray-070'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-subtlest">{TARGET_TABS.find(t => t.val === target)?.help}</p>
        </div>

        {/* 섹션·질문 read-only 렌더 */}
        {visibleSections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base text-fg-subtle">현재 필터에 해당하는 질문이 없습니다.</p>
            <p className="mt-1 text-xs text-fg-subtlest">다른 target 을 선택하거나 질문의 target 설정을 확인하세요.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleSections.map(section => (
              <section key={section.id}>
                <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-040 mr-2 align-middle" />
                  {section.name.trim() || '섹션 이름 없음'}
                </p>
                <div className="space-y-3">
                  {section.qs.map(q => (
                    <PreviewQuestion key={q.id} question={q} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function PreviewQuestion({ question }: { question: TemplateQuestion }) {
  return (
    <div className="rounded-lg border border-bd-default p-4">
      {question.isPrivate && (
        <div className="flex items-center gap-1.5 mb-2">
          <MsLockIcon size={12} className="text-fg-subtlest" />
          <span className="text-xs text-fg-subtlest">매니저 전용 (비공개)</span>
        </div>
      )}
      <p className="text-base font-semibold text-fg-default leading-snug mb-1">
        {question.text.trim() || <span className="italic text-fg-subtlest font-normal">질문 내용 없음</span>}
        {question.isRequired && <span className="text-red-050 ml-1">*</span>}
      </p>
      {question.helpText && (
        <p className="text-xs text-fg-subtlest leading-relaxed mb-3">{question.helpText}</p>
      )}

      {/* type 별 disabled 입력 */}
      {(question.type === 'rating' || question.type === 'competency') && (
        <div className="flex gap-1.5 mt-2">
          {[1, 2, 3, 4, 5].map(n => (
            <div
              key={n}
              className="flex-1 py-2 rounded border-2 border-gray-010 bg-gray-005 text-xs font-bold text-gray-030 text-center"
            >
              {n}
            </div>
          ))}
        </div>
      )}

      {question.type === 'multiple_choice' && (
        <div className="space-y-2 mt-2">
          {(question.options ?? []).filter(o => o.trim()).length === 0 ? (
            <p className="text-xs text-fg-subtlest italic">보기 미입력</p>
          ) : (
            (question.options ?? []).filter(o => o.trim()).map((opt, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-010 bg-gray-005 text-base text-fg-subtle"
              >
                <span className={`w-4 h-4 flex-shrink-0 border-2 border-gray-030 ${question.allowMultiple ? 'rounded' : 'rounded-full'}`} />
                {opt}
              </div>
            ))
          )}
        </div>
      )}

      {question.type === 'text' && (
        <textarea
          disabled
          rows={3}
          placeholder="긴 답변을 작성하는 영역입니다 (read-only 미리보기)"
          className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-010 bg-gray-005 text-base text-fg-subtle placeholder:text-fg-subtlest resize-none"
        />
      )}

      {/* type meta */}
      <p className="mt-3 text-[11px] text-fg-subtlest">
        {question.type === 'text' && '주관식'}
        {question.type === 'multiple_choice' && (question.allowMultiple ? '객관식 (복수 선택)' : '객관식 (단일 선택)')}
        {question.type === 'rating' && `평점 (1~5)`}
        {question.type === 'competency' && '역량 (1~5)'}
        {' · '}
        {question.target === 'self' ? '자기평가' : question.target === 'leader' ? '매니저' : '공통'}
        {RATING_LABELS.length > 0 && question.type === 'rating' && ` · ${RATING_LABELS[1]} ~ ${RATING_LABELS[5]}`}
      </p>
    </div>
  );
}
