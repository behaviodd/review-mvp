import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type Tone = 'default' | 'subtle';

interface Props {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: Tone;
  padded?: boolean;
  className?: string;
}

const TONE: Record<Tone, string> = {
  default: 'bg-white border-gray-010',
  subtle:  'bg-gray-001 border-gray-010',
};

export function SectionCard({
  title, description, actions, children,
  tone = 'default', padded = true, className,
}: Props) {
  return (
    <section className={cn('rounded-xl border shadow-card', TONE[tone], className)}>
      {(title || description || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-gray-080">{title}</h3>}
            {description && <p className="mt-0.5 text-[11px] text-fg-subtlest">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded ? 'px-4 py-3' : '', (title || description || actions) && padded && 'pt-3')}>
        {children}
      </div>
    </section>
  );
}
