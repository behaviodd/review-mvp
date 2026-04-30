import { type ButtonHTMLAttributes, type ReactNode, isValidElement, cloneElement } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type Variant = 'brand1' | 'default' | 'ghost' | 'red' | 'outline-brand1' | 'outline-default' | 'outline-red';
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface MsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const SIZE: Record<Size, { base: string; icon: number; spin: number }> = {
  sm:  { base: 'h-6  min-w-6  px-[8px]  gap-0.5 rounded-[6px] text-xs   leading-4', icon: 14, spin: 12 },
  md:  { base: 'h-8  min-w-8  px-[8px]  gap-1   rounded-lg    text-base   leading-5', icon: 18, spin: 14 },
  lg:  { base: 'h-10 min-w-10 px-[10px] gap-1.5 rounded-lg    text-base leading-6', icon: 20, spin: 16 },
  xl:  { base: 'h-12 min-w-12 px-3      gap-2   rounded-xl    text-base leading-6', icon: 24, spin: 20 },
  xxl: { base: 'h-14 min-w-14 px-4      gap-2   rounded-xl    text-lg   leading-7', icon: 24, spin: 20 },
};

const VARIANT: Record<Variant, string> = {
  brand1:         'bg-pink-040 text-white hover:bg-pink-050 disabled:bg-pink-020 disabled:text-white',
  default:        'bg-[#c4cdd4] text-[#111417] hover:bg-[#b5c0c8] disabled:opacity-50',
  ghost:          'bg-transparent text-[#111417] hover:bg-gray-010 disabled:opacity-50',
  red:            'bg-[#e93939] text-white hover:bg-[#d42e2e] disabled:opacity-50',
  'outline-brand1':  'bg-transparent border border-pink-040 text-pink-040 hover:bg-pink-005 disabled:opacity-50',
  'outline-default': 'bg-transparent border border-gray-020 text-gray-060 hover:bg-gray-005 disabled:opacity-50',
  'outline-red':     'bg-transparent border border-red-020 text-red-050 hover:bg-red-005 disabled:opacity-50',
};

function sizeIcon(icon: ReactNode, iconSize: number) {
  if (!icon || !isValidElement(icon)) return icon;
  return cloneElement(icon as React.ReactElement<{ size?: number }>, { size: iconSize });
}

export function MsButton({
  variant = 'brand1',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className,
  ...props
}: MsButtonProps) {
  const s = SIZE[size];
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-bold tracking-[-0.3px] transition-colors select-none whitespace-nowrap',
        s.base,
        VARIANT[variant],
        'disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading
        ? <Loader2 size={s.spin} className="animate-spin" />
        : sizeIcon(leftIcon, s.icon)}
      {children}
      {!loading && sizeIcon(rightIcon, s.icon)}
    </button>
  );
}
