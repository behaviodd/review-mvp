import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MsCancelIcon } from '../../ui/MsIcons';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;  // e.g. 'max-w-lg'
}

export function ModalShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  widthClass = 'max-w-lg',
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay-048" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={title}
        className={`relative flex w-full ${widthClass} max-h-[90vh] flex-col rounded-2xl bg-white shadow-modal`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-010 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-080">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-gray-040">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-050 hover:bg-gray-005"
            aria-label="닫기"
          >
            <MsCancelIcon size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-gray-010 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
