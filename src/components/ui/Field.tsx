import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface Props {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * 폼 필드 공통 쉘 — label · 필수 마크 · hint · error 위치를 표준화.
 * MsInput/MsSelect/MsTextarea 등 원자 컴포넌트를 children으로 받아 감싸서 사용.
 *
 * 기존 MsInput/MsSelect의 label/hint/error props와 공존합니다 — 일관성 이관은 점진적.
 */
export function Field({ label, hint, error, required, children, className, id }: Props) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-gray-060">
          {label}
          {required && <span className="ml-0.5 text-red-050">*</span>}
        </label>
      )}
      {children}
      {(hint || error) && (
        <p className={cn('text-xs', error ? 'text-red-050' : 'text-gray-040')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
