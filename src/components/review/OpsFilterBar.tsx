import { cn } from '../../utils/cn';
import { MsInput, MsSelect, MsCheckbox } from '../ui/MsControl';
import type { OpsFilters, OpsPerspective, OpsStage } from '../../utils/opsCenter';
import type { SubmissionStatus } from '../../types';

interface Props {
  filters: OpsFilters;
  onChange: (next: OpsFilters) => void;
  orgs: string[];
  disabled?: boolean;
}

const PERSPECTIVE_OPTIONS: { value: OpsPerspective; label: string; hint: string }[] = [
  { value: 'reviewee', label: '대상자', hint: '리뷰를 받는 사람 기준' },
  { value: 'reviewer', label: '작성자', hint: '리뷰를 작성하는 사람 기준' },
];

const STAGE_OPTIONS: { value: OpsStage; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'self', label: '자기평가' },
  { value: 'manager', label: '조직장' },
  { value: 'peer', label: '동료' },
  { value: 'upward', label: '상향' },
];

const STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: 'not_started', label: '미시작' },
  { value: 'in_progress', label: '작성 중' },
  { value: 'submitted', label: '제출 완료' },
];

function Segment<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-gray-010 bg-gray-005 p-0.5"
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 h-7 text-xs font-semibold rounded-md transition-colors whitespace-nowrap',
              active
                ? 'bg-white text-gray-080 shadow-card'
                : 'text-gray-050 hover:text-gray-070',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function OpsFilterBar({ filters, onChange, orgs, disabled }: Props) {
  const update = (patch: Partial<OpsFilters>) => onChange({ ...filters, ...patch });

  const toggleStatus = (s: SubmissionStatus) => {
    const has = filters.statuses.includes(s);
    update({ statuses: has ? filters.statuses.filter(x => x !== s) : [...filters.statuses, s] });
  };

  const resetable =
    filters.stage !== 'all' ||
    filters.org !== null ||
    filters.statuses.length > 0 ||
    filters.onlyOverdue ||
    filters.query.trim().length > 0;

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border border-gray-010 bg-white px-4 py-3 shadow-card', disabled && 'opacity-60 pointer-events-none')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-050">관점</span>
          <Segment
            ariaLabel="관점"
            value={filters.perspective}
            options={PERSPECTIVE_OPTIONS}
            onChange={v => update({ perspective: v })}
          />
        </div>
        <div className="h-5 w-px bg-gray-010" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-050">단계</span>
          <Segment
            ariaLabel="단계"
            value={filters.stage}
            options={STAGE_OPTIONS}
            onChange={v => update({ stage: v })}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <MsInput
            value={filters.query}
            onChange={e => update({ query: e.target.value })}
            placeholder="이름·이메일·조직 검색"
            className="w-56"
          />
          {resetable && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, stage: 'all', org: null, statuses: [], onlyOverdue: false, query: '' })}
              className="text-xs font-medium text-gray-050 hover:text-gray-080 underline-offset-2 hover:underline"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-050">조직</span>
          <MsSelect
            value={filters.org ?? ''}
            onChange={e => update({ org: e.target.value || null })}
            className="min-w-[160px]"
          >
            <option value="">전체 조직</option>
            {orgs.map(o => <option key={o} value={o}>{o}</option>)}
          </MsSelect>
        </div>

        <div className="flex items-center gap-3 pl-2 border-l border-gray-010">
          <span className="text-[11px] font-medium text-gray-050">상태</span>
          {STATUS_OPTIONS.map(opt => (
            <MsCheckbox
              key={opt.value}
              checked={filters.statuses.includes(opt.value)}
              onChange={() => toggleStatus(opt.value)}
              label={opt.label}
            />
          ))}
        </div>

        <div className="pl-2 border-l border-gray-010">
          <MsCheckbox
            checked={filters.onlyOverdue}
            onChange={e => update({ onlyOverdue: e.target.checked })}
            label={<span className="text-sm text-red-060 font-medium">지연만 보기</span>}
          />
        </div>
      </div>
    </div>
  );
}
