import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { MsInput } from './MsControl';

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
                    ? 'border-gray-099 text-gray-099'
                    : 'border-transparent text-gray-030 hover:text-gray-050',
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
function SegmentPills({ options, value, onChange, ariaLabel }: SegmentPillsProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-lg border border-gray-010 bg-gray-005 p-0.5">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 h-7 text-xs font-semibold rounded-md transition-colors whitespace-nowrap',
              active
                ? 'bg-white text-gray-080 shadow-card'
                : 'text-gray-050 hover:text-gray-070',
            )}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className="ml-1 text-[11px] tabular-nums opacity-70">{opt.count}</span>
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
function SegmentSelect({ options, value, onChange, ariaLabel, className }: SegmentSelectProps) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'h-8 px-3 pr-8 text-xs font-medium rounded-lg border border-gray-010 bg-white text-gray-080 ' +
          'focus:outline-none focus:ring-2 focus:ring-gray-010 transition-colors appearance-none ' +
          "bg-[url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 12 12\\' fill=\\'none\\'><path d=\\'M3 4.5L6 7.5L9 4.5\\' stroke=\\'%23788396\\' stroke-width=\\'1.5\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'/></svg>')] " +
          'bg-no-repeat bg-[right_8px_center]',
        className,
      )}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
