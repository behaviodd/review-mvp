import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { MsCancelIcon } from './MsIcons';

type Width = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const WIDTH: Record<Width, string> = {
  sm:   'max-w-md',
  md:   'max-w-xl',
  lg:   'max-w-2xl',
  xl:   'max-w-5xl',
  full: 'max-w-none',
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: Width;
  /** backdrop 클릭 시 닫힘 비활성 (위험한 작업용) */
  lockBackdrop?: boolean;
  /** 헤더 우측에 배치할 커스텀 액션 (닫기 버튼 옆) */
  headerExtras?: ReactNode;
}

export function SideDrawer({
  open, onClose, title, description, children, footer,
  width = 'md', lockBackdrop, headerExtras,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !lockBackdrop) onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, lockBackdrop]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-overlay-048"
        onClick={lockBackdrop ? undefined : onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-modal',
          WIDTH[width],
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-010 px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-080 truncate">{title}</h2>
            {description && <div className="mt-0.5 text-xs text-gray-040">{description}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerExtras}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-050 hover:bg-gray-005"
              aria-label="닫기"
            >
              <MsCancelIcon size={18} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-gray-010 bg-white px-5 py-3">
            {footer}
          </footer>
        )}
      </aside>
    </>,
    document.body,
  );
}
