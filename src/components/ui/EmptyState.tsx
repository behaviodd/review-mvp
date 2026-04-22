import type { ComponentType } from 'react';
import { Button } from '../catalyst/button';

interface Props {
  icon: ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, actionLabel, onAction, compact }: Props) {
  const btn = action ?? (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-16'}`}>
      <div className="size-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-3">
        <Icon size={20} className="text-zinc-400" />
      </div>
      <p className="text-sm/6 font-semibold text-zinc-950 mb-1">{title}</p>
      {description && (
        <p className="text-sm/6 text-zinc-500 mb-5 max-w-xs">{description}</p>
      )}
      {btn && (
        <Button color="dark/zinc" onClick={btn.onClick}>
          {btn.label}
        </Button>
      )}
    </div>
  );
}
