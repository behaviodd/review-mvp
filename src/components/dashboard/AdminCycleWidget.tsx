import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { daysUntil, formatDate } from '../../utils/dateUtils';
import { filtersToParams, DEFAULT_CYCLE_FILTERS } from '../../utils/cycleFilter';
import { cn } from '../../utils/cn';
import type { ReviewCycle } from '../../types';

type Tone = 'brand' | 'warning' | 'danger' | 'info';

const TONE_STYLE: Record<Tone, { bar: string; badge: string }> = {
  brand:   { bar: 'bg-pink-020',   badge: 'bg-pink-005 text-pink-060' },
  warning: { bar: 'bg-orange-020', badge: 'bg-orange-005 text-orange-060' },
  danger:  { bar: 'bg-red-020',    badge: 'bg-red-005 text-red-060' },
  info:    { bar: 'bg-blue-020',   badge: 'bg-blue-005 text-blue-060' },
};

interface CardProps {
  title: string;
  hint: string;
  tone: Tone;
  cycles: ReviewCycle[];
  onClickAll: () => void;
  row: (c: ReviewCycle) => React.ReactNode;
}

/**
 * Phase D-3.A: 카드 컨테이너 제거 — 평면 + 좌측 tone bar 유지 (구분/강조).
 * 부모 grid 의 divide-x 로 가운데 line 구분.
 */
function Card({ title, hint, tone, cycles, onClickAll, row }: CardProps) {
  const t = TONE_STYLE[tone];
  return (
    <div className="relative p-4">
      <span className={cn('absolute left-0 top-4 h-6 w-1 rounded-r', t.bar)} />
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-fg-default">{title}</h3>
          <p className="text-[11px] text-fg-subtlest">{hint}</p>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', t.badge)}>
          {cycles.length}
        </span>
      </div>
      {cycles.length === 0 ? (
        <p className="py-4 text-center text-xs text-fg-subtlest">해당 없음</p>
      ) : (
        <ul className="space-y-1.5">
          {cycles.slice(0, 4).map(c => (
            <li key={c.id}>{row(c)}</li>
          ))}
        </ul>
      )}
      {cycles.length > 4 && (
        <button
          type="button"
          onClick={onClickAll}
          className="mt-3 text-[11px] font-semibold text-fg-subtle hover:text-fg-default underline-offset-2 hover:underline"
        >
          전체 {cycles.length}개 보기 →
        </button>
      )}
    </div>
  );
}

export function AdminCycleWidget() {
  const cycles = useReviewStore(s => s.cycles);
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const { urgent, overdue, scheduled } = useMemo(() => {
    const active = cycles.filter(c => !c.archivedAt && c.status !== 'closed' && c.status !== 'draft');
    const urgent = active.filter(c => {
      const d = daysUntil(c.selfReviewDeadline);
      return d >= 0 && d <= 7;
    }).sort((a, b) => a.selfReviewDeadline.localeCompare(b.selfReviewDeadline));
    const overdue = active.filter(c => {
      const self = c.selfReviewDeadline.slice(0, 10);
      const mgr = c.managerReviewDeadline.slice(0, 10);
      return (c.completionRate ?? 0) < 100 && (self < today || mgr < today);
    }).sort((a, b) => a.selfReviewDeadline.localeCompare(b.selfReviewDeadline));
    const scheduled = cycles.filter(c =>
      c.status === 'draft' && !!(c as { scheduledPublishAt?: string }).scheduledPublishAt
    );
    return { urgent, overdue, scheduled };
  }, [cycles, today]);

  const navWithFilter = (preset: 'deadline' | 'overdue' | 'draft') => {
    const p = filtersToParams({
      ...DEFAULT_CYCLE_FILTERS,
      sort: 'deadline_asc',
      folder: preset === 'overdue' ? { kind: 'overdue' } : { kind: 'all' },
      statuses: preset === 'draft' ? ['draft'] : [],
    });
    navigate(`/cycles?${p.toString()}`);
  };

  const RowItem = ({ c, detail, tone }: { c: ReviewCycle; detail: string; tone: Tone }) => (
    <button
      type="button"
      onClick={() => navigate(`/cycles/${c.id}`)}
      className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-005"
    >
      <span className="flex-1 min-w-0">
        <p className="truncate text-base font-medium text-gray-080">{c.title}</p>
        <p className="text-[11px] text-fg-subtlest">{detail}</p>
      </span>
      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', TONE_STYLE[tone].badge)}>
        {(c.completionRate ?? 0)}%
      </span>
    </button>
  );

  /* Phase D-3.A-fix2: 단조화 — md+ divide-x 만, mobile 은 gap-3.
     위·아래 border-y 제거 (큰 섹션 border-t 는 부모에서). */
  return (
    <div className="grid grid-cols-1 gap-3 md:gap-0 md:grid-cols-3 md:divide-x md:divide-bd-default">
      <Card
        title="D-7 이내 마감"
        hint="자기평가 마감이 임박한 사이클"
        tone="warning"
        cycles={urgent}
        onClickAll={() => navWithFilter('deadline')}
        row={c => <RowItem c={c} detail={`자기평가 마감 · ${formatDate(c.selfReviewDeadline)}`} tone="warning" />}
      />
      <Card
        title="지연"
        hint="마감 초과 · 미완료 사이클"
        tone="danger"
        cycles={overdue}
        onClickAll={() => navWithFilter('overdue')}
        row={c => <RowItem c={c} detail={`자기평가 마감 · ${formatDate(c.selfReviewDeadline)}`} tone="danger" />}
      />
      <Card
        title="예약 발행 대기"
        hint="자동 발행이 걸린 초안"
        tone="info"
        cycles={scheduled}
        onClickAll={() => navWithFilter('draft')}
        row={c => {
          const at = (c as { scheduledPublishAt?: string }).scheduledPublishAt ?? c.createdAt;
          return <RowItem c={c} detail={`예약 발행 · ${formatDate(at)}`} tone="info" />;
        }}
      />
    </div>
  );
}
