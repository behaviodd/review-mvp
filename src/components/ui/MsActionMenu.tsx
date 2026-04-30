import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MsMoreIcon } from './MsIcons';

/**
 * 행 끝에 위치하는 더보기 메뉴 (overflow menu).
 *
 * 사용처:
 *  - CycleList row 의 hover 액션 (복제 / 편집 / 보관 / 삭제)
 *  - 추후 멤버 row, 템플릿 row 등 여러 곳에서 동일 패턴 재사용 가능
 *
 * 동작:
 *  - 아이콘(점 3개) 클릭 → 메뉴 펼침. 다시 클릭 / 외부 클릭 / ESC → 닫힘
 *  - 부모 row 의 onClick 으로 이벤트 전파 안 되도록 stopPropagation 자동 처리
 *  - 빈 items 또는 모두 hidden 이면 trigger 자체 렌더 X (조건부 사용 부담 감소)
 *
 * 부모가 hover 시에만 트리거 노출하고 싶으면 wrapper 에
 * `opacity-0 group-hover:opacity-100` 같은 클래스를 직접 적용.
 */

export interface MsActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  hidden?: boolean;
  disabled?: boolean;
}

interface MsActionMenuProps {
  items: MsActionMenuItem[];
  className?: string;
  triggerSize?: number;
  ariaLabel?: string;
  /** 'always' (default) — 항상 trigger 표시.
   *  'hover'  — 부모에 .group 클래스가 있을 때 group-hover 시에만 trigger 표시.
   *             메뉴 열림 (aria-expanded=true) 동안엔 hover 풀려도 강제 visible. */
  triggerVisibility?: 'always' | 'hover';
  /** 메뉴 열림/닫힘 상태 변경 콜백. 부모가 row 의 z-index 동적 부여 등에 활용
   *  (메뉴가 다음 row 의 hover bg / 구분선 위로 레이어되도록). */
  onOpenChange?: (open: boolean) => void;
}

export function MsActionMenu({
  items,
  className,
  triggerSize = 16,
  ariaLabel = '더보기',
  triggerVisibility = 'always',
  onOpenChange,
}: MsActionMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // open 변경 시 외부에 알림
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = items.filter(i => !i.hidden);
  if (visible.length === 0) return null;

  return (
    <div ref={wrapRef} className={`relative ${className ?? ''}`} data-action onClick={e => e.stopPropagation()}>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className={`size-7 inline-flex items-center justify-center rounded-md text-fg-subtle hover:bg-interaction-hovered transition-all ${
          triggerVisibility === 'hover'
            ? 'opacity-0 group-hover:opacity-100 aria-expanded:opacity-100'
            : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <MsMoreIcon size={triggerSize} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 min-w-[140px] rounded-md border border-bd-default bg-surface-overlay shadow-md py-1 z-50">
          {visible.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={e => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                item.variant === 'danger'
                  ? 'text-red-060 hover:bg-red-005'
                  : 'text-fg-default hover:bg-interaction-hovered'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
