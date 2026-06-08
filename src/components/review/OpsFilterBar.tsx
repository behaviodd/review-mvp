import { cn } from '../../utils/cn';
import { MsInput, MsSelect, MsCheckbox } from '../ui/MsControl';
import { SegmentControl } from '../ui/SegmentControl';
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
  { value: 'self', label: 'Self 리뷰' },
  { value: 'manager', label: '조직장' },
  { value: 'peer', label: '동료' },
  { value: 'upward', label: '상향' },
];

const STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: 'not_started', label: '미시작' },
  { value: 'in_progress', label: '작성 중' },
  { value: 'submitted', label: '제출 완료' },
];

/**
 * Phase D-3.D-2 → P1-C1 라운드 14: 공통 SegmentControl 컴포넌트 사용.
 * 자체 구현 제거, 동일 시각 패턴 (Figma 정합) 유지.
 */
function Segment<T extends string>(props: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return <SegmentControl {...props} />;
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
    /* Phase D-3.D-3: border-y → border-t (사용자 명시 — 가로 선 1줄만) */
    <div className={cn('flex flex-col gap-3 border-t border-bd-default px-2 py-3', disabled && 'opacity-60 pointer-events-none')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-fg-subtle">관점</span>
          <Segment
            ariaLabel="관점"
            value={filters.perspective}
            options={PERSPECTIVE_OPTIONS}
            onChange={v => update({ perspective: v })}
          />
        </div>
        <div className="h-5 w-px bg-gray-010" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-fg-subtle">단계</span>
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
              className="text-xs font-medium text-fg-subtle hover:text-gray-080 underline-offset-2 hover:underline"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-fg-subtle">조직</span>
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
          <span className="text-[11px] font-medium text-fg-subtle">상태</span>
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
            label={<span className="text-base text-red-060 font-medium">지연만 보기</span>}
          />
        </div>
      </div>
    </div>
  );
}
