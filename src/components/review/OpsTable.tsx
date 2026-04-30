import type { CSSProperties } from 'react';
import { cn } from '../../utils/cn';
import { MsCheckbox } from '../ui/MsControl';
import { StatusBadge } from '../ui/StatusBadge';
import { UserAvatar } from '../ui/UserAvatar';
import { EmptyState } from '../ui/EmptyState';
import { MsProfileIcon } from '../ui/MsIcons';
import { deadlineLabel, daysUntil, timeAgo } from '../../utils/dateUtils';
import type { OpsRow, OpsStageSummary } from '../../utils/opsCenter';

interface Props {
  rows: OpsRow[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onToggleAll: () => void;
  onRowOpen: (row: OpsRow) => void;
  deadlines: { self: string; manager: string };
  perspectiveLabel: string;
  showPeer?: boolean;
  showUpward?: boolean;
}

function StageCell({ summary, deadline }: { summary?: OpsStageSummary; deadline: string }) {
  if (!summary) {
    return <span className="text-xs text-gray-030">-</span>;
  }
  const multiple = summary.total > 1;
  const effective = summary.overrideUntil ?? deadline;
  const label = deadlineLabel(effective);
  const d = daysUntil(effective);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <StatusBadge type="submission" value={summary.status} />
      {multiple && (
        <span className="text-[11px] tabular-nums text-fg-subtle">
          {summary.submitted}/{summary.total}
        </span>
      )}
      {summary.overrideUntil && (
        <span
          className="inline-flex items-center rounded bg-blue-005 px-1.5 py-0.5 text-[10px] font-semibold text-blue-070"
          title={`연장 기한: ${summary.overrideUntil}`}
        >
          연장 · {label}
        </span>
      )}
      {summary.overdue ? (
        <span className="inline-flex items-center rounded bg-red-005 px-1.5 py-0.5 text-[10px] font-semibold text-red-060">
          지연 {label}
        </span>
      ) : (
        !summary.overrideUntil && summary.status !== 'submitted' && d <= 3 && d >= 0 && (
          <span className="inline-flex items-center rounded bg-orange-005 px-1.5 py-0.5 text-[10px] font-semibold text-orange-060">
            {label}
          </span>
        )
      )}
    </div>
  );
}

export function OpsTable({
  rows, selected, onToggle, onToggleAll, onRowOpen, deadlines, perspectiveLabel,
  showPeer = false, showUpward = false,
}: Props) {
  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.key));
  const someChecked = rows.some(r => selected.has(r.key));

  // 열 구성: 기본 자기평가 + 조직장 (+ peer, upward 옵션) — CSS Grid 변수 기반
  const stageColsTemplate = [
    'minmax(0,1.1fr)',  // self
    'minmax(0,1.1fr)',  // manager
    showPeer   ? 'minmax(0,1.1fr)' : '',
    showUpward ? 'minmax(0,1.1fr)' : '',
  ].filter(Boolean).join(' ');

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `40px minmax(0, 2fr) minmax(0, 1fr) ${stageColsTemplate} minmax(0, 0.8fr) minmax(0, 0.8fr)`,
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon={MsProfileIcon}
        title={`조건에 맞는 ${perspectiveLabel}가 없습니다.`}
        description="필터를 완화하거나 초기화해 보세요."
      />
    );
  }

  /* Phase D-3.D-3: border-y → border-t border-b (위 1줄 + 페이지 끝 1줄, 사이 line 중복 제거) */
  return (
    <div className="border-t border-b border-bd-default">
      <div
        className="hidden md:grid items-center gap-3 border-b border-bd-default px-2 py-2"
        style={gridStyle}
      >
        <MsCheckbox
          checked={allChecked}
          indeterminate={!allChecked && someChecked}
          onChange={onToggleAll}
          aria-label="전체 선택"
        />
        <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">{perspectiveLabel}</span>
        <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">조직</span>
        <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">자기평가</span>
        <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">조직장 리뷰</span>
        {showPeer && <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">동료 리뷰</span>}
        {showUpward && <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">상향 리뷰</span>}
        <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">마감</span>
        <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide">마지막 저장</span>
      </div>

      <ul className="divide-y divide-bd-default">
        {rows.map(row => {
          const isSelected = selected.has(row.key);
          const activeDeadline = row.manager ? deadlines.manager : deadlines.self;
          const dLabel = deadlineLabel(activeDeadline);
          return (
            <li
              key={row.key}
              style={gridStyle}
              className={cn(
                'md:grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 px-4 py-2.5 transition-colors',
                isSelected ? 'bg-pink-005/40' : 'hover:bg-gray-001 focus-within:bg-gray-001',
              )}
            >
              <MsCheckbox
                checked={isSelected}
                onChange={() => onToggle(row.key)}
                aria-label={`${row.user.name} 선택`}
              />
              <button
                type="button"
                onClick={() => onRowOpen(row)}
                className="flex min-w-0 items-center gap-3 text-left"
              >
                <UserAvatar user={row.user} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-080">{row.user.name}</p>
                  <p className="truncate text-[11px] text-fg-subtlest">{row.user.position} · {row.user.email}</p>
                </div>
              </button>
              <span className="truncate text-xs text-gray-060">{row.orgPath}</span>
              <div className="hidden md:block"><StageCell summary={row.self} deadline={deadlines.self} /></div>
              <div className="hidden md:block"><StageCell summary={row.manager} deadline={deadlines.manager} /></div>
              {showPeer && (
                <div className="hidden md:block"><StageCell summary={row.peer} deadline={deadlines.manager} /></div>
              )}
              {showUpward && (
                <div className="hidden md:block"><StageCell summary={row.upward} deadline={deadlines.manager} /></div>
              )}
              <span className="hidden md:inline text-xs font-semibold tabular-nums text-gray-070">{dLabel}</span>
              <span className="hidden md:inline text-xs text-fg-subtlest">
                {row.lastSavedAt ? timeAgo(row.lastSavedAt) : '-'}
              </span>

              <div className="col-start-2 flex flex-wrap items-center gap-2 md:hidden">
                <StageCell summary={row.self} deadline={deadlines.self} />
                <StageCell summary={row.manager} deadline={deadlines.manager} />
                {showPeer && <StageCell summary={row.peer} deadline={deadlines.manager} />}
                {showUpward && <StageCell summary={row.upward} deadline={deadlines.manager} />}
                <span className="ml-auto text-xs font-semibold tabular-nums text-gray-070">{dLabel}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
