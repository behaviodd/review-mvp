import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { MsInput } from './MsControl';
import { MsChevronDownMonoIcon } from './MsIcons';

/**
 * 리스트 페이지 공통 필터/툴바.
 *
 * 사용 규칙
 * - tabs: 1차 분류. border-b + bold + count chip. 보통 페이지에 1개.
 * - segments: 2차 분류. 세그먼트 컨트롤(pill 그룹) 또는 native select.
 * - search: 단일 검색 입력.
 * - rightSlot: 보조 액션(초기화 버튼 등). primary action은 PageHeader.actions 슬롯 사용.
 *
 * 레이아웃
 * - tabs 줄
 * - segments + search + rightSlot 줄 (모두 옵션)
 */

export interface ListTab<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

export interface SegmentOption {
  value: string;
  label: string;
  /** pill 우측에 작게 표시되는 수치. select 에는 미적용. */
  count?: number;
}

export type ListSegment =
  | {
      // pill 그룹 — 옵션 수가 적을 때 (≤4 권장).
      kind: 'pills';
      key: string;
      options: SegmentOption[];
      value: string;
      onChange: (v: string) => void;
      ariaLabel?: string;
    }
  | {
      // native select 드롭다운 — 옵션이 많거나 라벨이 길 때.
      kind: 'select';
      key: string;
      options: SegmentOption[];
      value: string;
      onChange: (v: string) => void;
      ariaLabel?: string;
      className?: string;
    };

export interface ListSearch {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** sm = 검색바를 다른 필터와 한 줄에. md = 단독 검색바 페이지에서. */
  width?: 'sm' | 'md';
}

interface Props<T extends string = string> {
  tabs?: ListTab<T>[];
  activeTab?: T;
  onTabChange?: (v: T) => void;

  segments?: ListSegment[];
  search?: ListSearch;
  rightSlot?: ReactNode;

  /** 추가 className (감싸는 wrapper에 적용). */
  className?: string;
}

export function ListToolbar<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  segments,
  search,
  rightSlot,
  className,
}: Props<T>) {
  const hasSecondRow = !!(segments?.length || search || rightSlot);

  return (
    <div className={cn('space-y-3', className)}>
      {tabs && tabs.length > 0 && (
        <div className="flex gap-6 border-b border-gray-020 overflow-x-auto" role="tablist">
          {tabs.map(({ value, label, count }) => {
            const isActive = activeTab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange?.(value)}
                className={cn(
                  'flex items-center gap-1.5 py-[10px] text-base font-bold tracking-[-0.3px] whitespace-nowrap transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-gray-099 text-fg-default'
                    : 'border-transparent text-gray-030 hover:text-fg-subtle',
                )}
              >
                {label}
                {typeof count === 'number' && (
                  <span
                    className={cn(
                      'text-xs font-bold px-1.5 py-0.5 rounded-full leading-none tabular-nums',
                      isActive ? 'bg-gray-099 text-white' : 'bg-gray-010 text-gray-030',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {hasSecondRow && (
        <div className="flex flex-wrap items-center gap-2">
          {segments?.map(seg =>
            seg.kind === 'pills' ? (
              <SegmentPills
                key={seg.key}
                options={seg.options}
                value={seg.value}
                onChange={seg.onChange}
                ariaLabel={seg.ariaLabel}
              />
            ) : (
              <SegmentSelect
                key={seg.key}
                options={seg.options}
                value={seg.value}
                onChange={seg.onChange}
                ariaLabel={seg.ariaLabel}
                className={seg.className}
              />
            ),
          )}

          {search && (
            <div
              className={cn(
                segments?.length ? 'ml-auto' : '',
                search.width === 'md' ? 'w-full md:w-80' : 'w-full md:w-56',
              )}
            >
              <MsInput
                value={search.value}
                onChange={e => search.onChange(e.target.value)}
                placeholder={search.placeholder}
              />
            </div>
          )}

          {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
        </div>
      )}
    </div>
  );
}

interface SegmentPillsProps {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}
/**
 * Phase D-3.C-1: Figma SegmentedControl (1143:13490) 정합
 *  - Track: bg-surface-sunken rounded-xl p-1 gap-1
 *  - Indicator (활성): bg-surface-default rounded-lg + drop-shadow inline +
 *    h-7 px-2.5 text-base font-bold text-fg-default
 *  - SegmentItem (비활성): rounded-lg h-7 px-2.5 text-base font-semibold text-fg-subtle
 *  - drop-shadow 는 Figma 의 0 2px 4px rgba(76,90,102,0.16) 직접 inline (alias 추가 X)
 */
function SegmentPills({ options, value, onChange, ariaLabel }: SegmentPillsProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-xl bg-surface-sunken p-1 gap-1">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1 h-7 px-2.5 text-base rounded-lg tracking-[-0.3px] leading-5 transition-colors whitespace-nowrap',
              active
                ? 'bg-surface-default text-fg-default font-bold shadow-[0_2px_4px_rgba(76,90,102,0.16)]'
                : 'text-fg-subtle font-semibold hover:text-fg-default',
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className="text-xs tabular-nums opacity-70">{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface SegmentSelectProps {
  options: SegmentOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  className?: string;
}
/**
 * Phase D-3.C-3: chevron 안 보이던 문제 해결.
 * 이전: bg-[url('data:image/svg+xml...')] arbitrary class — Tailwind JIT 가
 * escape 처리 실패로 background-image 누락.
 * 변경: wrapper div + absolute MsChevronDownMonoIcon — 토큰 색상 + 안정.
 */
function SegmentSelect({ options, value, onChange, ariaLabel, className }: SegmentSelectProps) {
  return (
    <div className={cn('relative inline-block', className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 pl-3 pr-7 text-xs font-medium rounded-lg border border-bd-default bg-bg-token-default text-fg-default focus:outline-none focus:ring-2 focus:ring-bd-default transition-colors appearance-none cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <MsChevronDownMonoIcon
        size={12}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
      />
    </div>
  );
}
