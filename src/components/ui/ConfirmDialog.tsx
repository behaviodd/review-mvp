import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { MsButton } from './MsButton';
import { MsCancelIcon, MsWarningIcon, MsInfoIcon } from './MsIcons';
import { MsTextarea } from './MsControl';

export type ConfirmTone = 'danger' | 'default';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  /** true면 사유 입력 필드 노출 */
  requireReason?: boolean;
  reasonPlaceholder?: string;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'default',
  loading,
  requireReason,
  reasonPlaceholder,
}: Props) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) { setReason(''); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const Icon = tone === 'danger' ? MsWarningIcon : MsInfoIcon;
  const iconTone = tone === 'danger' ? 'text-red-050 bg-red-005' : 'text-blue-060 bg-blue-005';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-overlay-048"
        onClick={loading ? undefined : onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-modal"
      >
        <header className="flex items-start gap-3 px-5 py-4">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', iconTone)}>
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-080">{title}</h2>
            {description && <div className="mt-0.5 text-xs text-gray-050 leading-relaxed">{description}</div>}
          </div>
          <button
            type="button"
            onClick={loading ? undefined : onClose}
            className="rounded-lg p-1.5 text-gray-050 hover:bg-gray-005 disabled:opacity-40"
            disabled={loading}
            aria-label="닫기"
          >
            <MsCancelIcon size={16} />
          </button>
        </header>
        {requireReason && (
          <div className="px-5 pb-4">
            <MsTextarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={reasonPlaceholder ?? '사유 입력'}
              rows={3}
            />
          </div>
        )}
        <footer className="flex items-center justify-end gap-2 border-t border-gray-010 px-5 py-3 bg-gray-001 rounded-b-2xl">
          <MsButton variant="ghost" size="sm" onClick={onClose} disabled={loading}>{cancelLabel}</MsButton>
          <MsButton
            variant={tone === 'danger' ? 'red' : 'brand1'}
            size="sm"
            onClick={() => onConfirm(requireReason ? reason.trim() || undefined : undefined)}
            loading={loading}
            disabled={loading}
          >
            {confirmLabel}
          </MsButton>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
