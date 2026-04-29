import { cn } from '../../utils/cn';
import type { OpsKpis } from '../../utils/opsCenter';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}

const TONE: Record<Tone, { value: string; bar: string }> = {
  neutral: { value: 'text-gray-080', bar: 'bg-gray-010' },
  brand:   { value: 'text-pink-050', bar: 'bg-pink-020' },
  success: { value: 'text-green-060', bar: 'bg-green-020' },
  warning: { value: 'text-orange-060', bar: 'bg-orange-020' },
  danger:  { value: 'text-red-050', bar: 'bg-red-020' },
};

/**
 * Phase D-3.D-2: 카드 컨테이너 제거 — 평면 + 좌측 tone bar accent + 부모 grid 의 divide line.
 */
function Card({ label, value, sub, tone = 'neutral' }: KpiCard) {
  const t = TONE[tone];
  return (
    <div className="relative flex flex-col gap-1 px-4 py-3">
      <span className={cn('absolute left-0 top-3 h-5 w-1 rounded-r', t.bar)} />
      <span className="text-[11px] font-medium text-fg-subtle">{label}</span>
      <span className={cn('text-xl font-bold tabular-nums tracking-tight', t.value)}>{value}</span>
      {sub && <span className="text-[11px] text-fg-subtlest">{sub}</span>}
    </div>
  );
}

interface Props {
  kpis: OpsKpis;
}

export function OpsKpiStrip({ kpis }: Props) {
  const dDayTone: Tone =
    kpis.dDayDays === null ? 'neutral'
      : kpis.dDayDays < 0   ? 'danger'
      : kpis.dDayDays <= 2  ? 'warning'
      : 'brand';

  const cards: KpiCard[] = [
    { label: '전체 제출율', value: `${kpis.overallRate}%`, sub: `대상 ${kpis.totalPeople}명`, tone: 'brand' },
    { label: '자기평가', value: `${kpis.selfRate}%`, tone: 'neutral' },
    { label: '조직장 리뷰', value: `${kpis.managerRate}%`, tone: 'neutral' },
    ...(kpis.hasPeer ? [{ label: '동료 리뷰', value: `${kpis.peerRate}%`, tone: 'neutral' as Tone }] : []),
    ...(kpis.hasUpward ? [{ label: '상향 리뷰', value: `${kpis.upwardRate}%`, tone: 'neutral' as Tone }] : []),
    { label: '미시작', value: `${kpis.notStarted}`, sub: '건', tone: kpis.notStarted > 0 ? 'warning' : 'neutral' },
    { label: '지연', value: `${kpis.overdue}`, sub: '건 마감 초과', tone: kpis.overdue > 0 ? 'danger' : 'success' },
    { label: '남은 기간', value: kpis.dDayLabel, sub: `7일 내 독촉 ${kpis.remindersLast7d}회`, tone: dDayTone },
  ];

  const cols = cards.length <= 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-8';

  /* Phase D-3.D-2: grid 안 카드 사이 divide-x (md+) 로 line 구분, 위·아래 border-y */
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 ${cols} border-y border-bd-default md:divide-x md:divide-bd-default`}>
      {cards.map(card => <Card key={card.label} {...card} />)}
    </div>
  );
}
