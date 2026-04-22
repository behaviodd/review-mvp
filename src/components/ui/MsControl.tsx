import { type InputHTMLAttributes, type ReactNode, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

// ─── Checkbox ────────────────────────────────────────────────────────────────

interface MsCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'md' | 'lg';
  indeterminate?: boolean;
  label?: ReactNode;
}

export function MsCheckbox({ size = 'md', indeterminate, label, className, disabled, checked, ...props }: MsCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  const box = size === 'lg'
    ? 'size-6 rounded-[4px]'
    : 'size-5 rounded-[3px]';

  const track = checked || indeterminate
    ? disabled ? 'bg-primary-100 opacity-50' : 'bg-primary-500 border-primary-500'
    : disabled ? 'bg-[rgba(76,90,102,0.08)] border-[rgba(76,90,102,0.2)]' : 'bg-[#f8f9fa] border-[#dfe7e9]';

  const iconSize = size === 'lg' ? 13 : 11;

  return (
    <label className={cn('flex w-fit items-center gap-2 cursor-pointer', disabled && 'cursor-not-allowed', className)}>
      <span className={cn('relative inline-flex items-center justify-center flex-shrink-0 border transition-colors', box, track)}>
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        {(checked || indeterminate) && !disabled && (
          indeterminate ? (
            <svg width={iconSize} height={2} viewBox={`0 0 ${iconSize} 2`} fill="none">
              <path d={`M0 1 H${iconSize}`} stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width={iconSize} height={Math.round(iconSize * 10 / 13)} viewBox="0 0 13 10" fill="none">
              <path d="M1 5L5 9L12 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )
        )}
        {(checked || indeterminate) && disabled && (
          indeterminate ? (
            <svg width={iconSize} height={2} viewBox={`0 0 ${iconSize} 2`} fill="none">
              <path d={`M0 1 H${iconSize}`} stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width={iconSize} height={Math.round(iconSize * 10 / 13)} viewBox="0 0 13 10" fill="none">
              <path d="M1 5L5 9L12 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )
        )}
      </span>
      {label && <span className={cn('text-sm text-neutral-800', disabled && 'text-neutral-400')}>{label}</span>}
    </label>
  );
}

// ─── Radio ───────────────────────────────────────────────────────────────────

interface MsRadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  size?: 'md' | 'lg';
  label?: ReactNode;
}

export function MsRadio({ size = 'md', label, className, disabled, checked, ...props }: MsRadioProps) {
  const outer = size === 'lg' ? 'size-6' : 'size-5';
  const dot   = size === 'lg' ? 'size-[9.6px]' : 'size-[8px]';

  const borderColor = checked
    ? disabled ? 'border-primary-200' : 'border-primary-500'
    : disabled ? 'border-[rgba(76,90,102,0.2)]' : 'border-[#dfe7e9]';

  const dotColor = checked
    ? disabled ? 'bg-primary-200' : 'bg-primary-500'
    : '';

  return (
    <label className={cn('flex w-fit items-center gap-2 cursor-pointer', disabled && 'cursor-not-allowed', className)}>
      <span className={cn(
        'relative inline-flex items-center justify-center flex-shrink-0 rounded-full border-2 bg-[#f8f9fa] transition-colors',
        outer, borderColor,
        disabled && 'opacity-50',
      )}>
        <input
          type="radio"
          checked={checked}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        {checked && <span className={cn('rounded-full flex-shrink-0', dot, dotColor)} />}
      </span>
      {label && <span className={cn('text-sm text-neutral-800', disabled && 'text-neutral-400')}>{label}</span>}
    </label>
  );
}

// ─── Switch ──────────────────────────────────────────────────────────────────

interface MsSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'md' | 'lg';
  label?: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function MsSwitch({ checked, onChange, disabled, size = 'md', label, className, 'aria-label': ariaLabel }: MsSwitchProps) {
  const track = size === 'lg'
    ? 'h-6 w-[38px] rounded-[12px]'
    : 'h-5 w-8 rounded-[10px]';

  const thumbSize = size === 'lg' ? 'size-[18px]' : 'size-[14px]';
  const thumbTranslate = size === 'lg'
    ? checked ? 'translate-x-[17px]' : 'translate-x-[3px]'
    : checked ? 'translate-x-[15px]' : 'translate-x-[3px]';

  const trackColor = checked
    ? disabled ? 'bg-primary-100 opacity-50' : 'bg-primary-500'
    : disabled ? 'bg-[rgba(76,90,102,0.08)]' : 'bg-[#dfe7e9]';

  return (
    <label className={cn('flex w-fit items-center gap-2 cursor-pointer', disabled && 'cursor-not-allowed', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex flex-shrink-0 items-center transition-colors duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed',
          track, trackColor,
        )}
      >
        <span className={cn(
          'absolute inline-block rounded-full bg-white shadow-sm transition-transform duration-200',
          thumbSize, thumbTranslate,
        )} />
      </button>
      {label && <span className={cn('text-sm text-neutral-800', disabled && 'text-neutral-400')}>{label}</span>}
    </label>
  );
}
