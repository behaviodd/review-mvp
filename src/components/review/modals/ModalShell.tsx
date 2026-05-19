import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MsCancelIcon } from '../../ui/MsIcons';

/**
 * P1-C2 라운드 14 — Dialog/ModalShell size 표준화 (DS audit P2).
 * DS Dialog 의 5단계 size 와 매핑:
 *   xs ~320px → max-w-xs   (간단한 확인 모달)
 *   sm ~400px → max-w-md   (기본 — 단일 폼 / 알림)
 *   md ~600px → max-w-xl   (다단 폼)
 *   lg ~800px → max-w-3xl  (복잡한 폼 / 리스트)
 *   xl ~1200px → max-w-6xl (대형 — 미리보기 등)
 *
 * 기존 widthClass props 는 backwards-compat 으로 유지 (deprecated).
 * size 가 제공되면 size 우선. 둘 다 없으면 sm.
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_TO_MAX_W: Record<ModalSize, string> = {
  xs: 'max-w-xs',
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
};

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** @deprecated size prop 사용 권장. 기존 호출처 호환용 */
  widthClass?: string;
}

export function ModalShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size,
  widthClass,
}: Props) {
  // size 우선, 둘 다 없으면 sm 기본
  const resolvedWidth = size ? SIZE_TO_MAX_W[size] : (widthClass ?? SIZE_TO_MAX_W.sm);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-overlay-048" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={title}
        className={`relative flex w-full ${resolvedWidth} max-h-[90vh] flex-col rounded-2xl bg-white shadow-modal`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-010 px-5 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-080">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-fg-subtlest">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-subtle hover:bg-gray-005"
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
