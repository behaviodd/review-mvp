import { cn } from '../../utils/cn';
import { timeAgo } from '../../utils/dateUtils';
import type { SyncSummary } from '../../utils/syncQueue';

type Tone = 'idle' | 'healthy' | 'warning' | 'danger';

const TONE_STYLE: Record<Tone, string> = {
  idle:    'bg-gray-005 text-fg-subtle border-gray-010',
  healthy: 'bg-green-005 text-green-070 border-green-020',
  warning: 'bg-orange-005 text-orange-070 border-orange-020',
  danger:  'bg-red-005 text-red-070 border-red-020',
};

function toneOf(s: SyncSummary): Tone {
  if (s.failed > 0) return 'danger';
  if (s.pending > 0) return 'warning';
  if (s.lastSuccessAt) return 'healthy';
  return 'idle';
}

function label(s: SyncSummary): string {
  if (s.failed > 0) return `실패 ${s.failed}${s.pending > s.failed ? ` · 대기 ${s.pending - s.failed}` : ''}`;
  if (s.pending > 0) return `대기 ${s.pending}`;
  if (s.lastSuccessAt) return `동기화됨 · ${timeAgo(s.lastSuccessAt)}`;
  return '동기화 이력 없음';
}

interface Props {
  summary: SyncSummary;
  onOpen: () => void;
  disabled?: boolean;
}

export function SyncStatusBadge({ summary, onOpen, disabled }: Props) {
  const tone = toneOf(summary);
  const clickable = summary.pending > 0 || summary.lastSuccessAt || summary.failed > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || !clickable}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 h-7 text-[11px] font-semibold transition-colors',
        TONE_STYLE[tone],
        clickable && !disabled ? 'hover:brightness-95' : 'cursor-default opacity-80',
      )}
      title={summary.lastError ?? undefined}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'healthy' ? 'bg-green-050' :
          tone === 'warning' ? 'bg-orange-050' :
          tone === 'danger'  ? 'bg-red-050' : 'bg-gray-030',
        )}
      />
      {label(summary)}
    </button>
  );
}
