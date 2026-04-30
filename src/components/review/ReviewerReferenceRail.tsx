import { useMemo, useState } from 'react';
import { useGoalStore } from '../../stores/goalStore';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { getEffectiveTemplate } from '../../utils/effectiveTemplate';
import { formatDate } from '../../utils/dateUtils';
import { cn } from '../../utils/cn';
import { MsChevronDownLineIcon } from '../ui/MsIcons';
import type { ReviewCycle } from '../../types';

interface Props {
  cycle: ReviewCycle;
  revieweeId: string;
  variant?: 'self' | 'downward';
}

export function ReviewerReferenceRail({ cycle, revieweeId, variant = 'self' }: Props) {
  const goals = useGoalStore(s => s.goals);
  const submissions = useReviewStore(s => s.submissions);
  const cycles = useReviewStore(s => s.cycles);
  const templates = useReviewStore(s => s.templates);
  const users = useTeamStore(s => s.users);
  const [open, setOpen] = useState(true);

  const includeGoals = cycle.referenceInfo?.includeGoals;
  const includePrev = cycle.referenceInfo?.includePreviousReview;

  const revieweeGoals = useMemo(
    () => goals.filter(g => g.userId === revieweeId && g.status !== 'cancelled'),
    [goals, revieweeId],
  );

  const previousReview = useMemo(() => {
    const candidates = submissions
      .filter(s =>
        s.revieweeId === revieweeId &&
        s.status === 'submitted' &&
        s.cycleId !== cycle.id &&
        s.type === 'self'
      )
      .sort((a, b) => (b.submittedAt ?? b.lastSavedAt).localeCompare(a.submittedAt ?? a.lastSavedAt));
    const sub = candidates[0];
    if (!sub) return null;
    const prevCycle = cycles.find(c => c.id === sub.cycleId);
    if (!prevCycle) return null;
    const template = getEffectiveTemplate(prevCycle, templates);
    return { sub, cycle: prevCycle, template };
  }, [submissions, cycles, templates, revieweeId, cycle.id]);

  if (!includeGoals && !includePrev) return null;

  const reviewee = users.find(u => u.id === revieweeId);

  return (
    <section className="rounded-xl border border-gray-010 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5"
      >
        <div className="text-left">
          <p className="text-base font-semibold text-gray-080">
            작성 참고 정보
            {reviewee && variant === 'downward' && (
              <span className="ml-2 text-xs font-normal text-fg-subtlest">· {reviewee.name}</span>
            )}
          </p>
          <p className="text-[11px] text-fg-subtlest">
            {[includeGoals && '목표', includePrev && '직전 사이클'].filter(Boolean).join(' · ')}
          </p>
        </div>
        <MsChevronDownLineIcon size={14} className={cn('text-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-gray-010 px-4 py-3 space-y-3">
          {includeGoals && (
            <div>
              <p className="text-[11px] font-semibold text-gray-060 mb-1.5">목표 {revieweeGoals.length}개</p>
              {revieweeGoals.length === 0 ? (
                <p className="text-xs text-fg-subtlest">등록된 목표가 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {revieweeGoals.slice(0, 4).map(g => (
                    <li key={g.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 min-w-0 truncate text-gray-080">{g.title}</span>
                      <span className="tabular-nums text-fg-subtle w-10 text-right">{g.progress}%</span>
                      <div className="h-1 w-20 overflow-hidden rounded-full bg-gray-010">
                        <div className="h-full rounded-full bg-pink-040" style={{ width: `${g.progress}%` }} />
                      </div>
                    </li>
                  ))}
                  {revieweeGoals.length > 4 && (
                    <li className="text-[11px] text-fg-subtlest">+ {revieweeGoals.length - 4}개 더 있음</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {includePrev && (
            <div>
              <p className="text-[11px] font-semibold text-gray-060 mb-1.5">직전 사이클 요약</p>
              {!previousReview ? (
                <p className="text-xs text-fg-subtlest">이전에 제출된 자기평가가 없습니다.</p>
              ) : (
                <div className="rounded-lg border border-gray-005 bg-gray-001 px-3 py-2">
                  <p className="text-xs font-medium text-gray-080">
                    {previousReview.cycle.title}
                    <span className="ml-1 text-fg-subtlest font-normal">
                      · 제출 {formatDate(previousReview.sub.submittedAt ?? previousReview.sub.lastSavedAt)}
                    </span>
                  </p>
                  {previousReview.sub.overallRating != null && (
                    <p className="text-[11px] text-fg-subtle mt-0.5">
                      종합 평점 {previousReview.sub.overallRating.toFixed(1)}
                    </p>
                  )}
                  <ul className="mt-2 space-y-1">
                    {previousReview.template.questions
                      .filter(q => q.target !== 'leader' && !q.isPrivate)
                      .slice(0, 3)
                      .map(q => {
                        const a = previousReview.sub.answers.find(x => x.questionId === q.id);
                        const val = a?.textValue?.trim()
                          ? (a.textValue.length > 60 ? a.textValue.slice(0, 60) + '…' : a.textValue)
                          : a?.ratingValue != null
                            ? `평점 ${a.ratingValue}`
                            : '응답 없음';
                        return (
                          <li key={q.id} className="text-[11px] text-gray-060">
                            <span className="font-semibold text-gray-080">Q.</span> {q.text.slice(0, 40)}{q.text.length > 40 ? '…' : ''}
                            <br />
                            <span className="text-fg-subtle">{val}</span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
