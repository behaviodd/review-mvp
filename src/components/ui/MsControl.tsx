import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
  useRef,
  useEffect,
} from 'react';
import { cn } from '../../utils/cn';
import { MsChevronDownLineIcon } from './MsIcons';

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
    ? disabled ? 'bg-pink-010 opacity-50' : 'bg-pink-040 border-pink-040'
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
      {label && <span className={cn('text-sm text-gray-080', disabled && 'text-fg-subtlest')}>{label}</span>}
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
    ? disabled ? 'border-pink-020' : 'border-pink-040'
    : disabled ? 'border-[rgba(76,90,102,0.2)]' : 'border-[#dfe7e9]';

  const dotColor = checked
    ? disabled ? 'bg-pink-020' : 'bg-pink-040'
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
      {label && <span className={cn('text-sm text-gray-080', disabled && 'text-fg-subtlest')}>{label}</span>}
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
    ? disabled ? 'bg-pink-010 opacity-50' : 'bg-pink-040'
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
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-040 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed',
          track, trackColor,
        )}
      >
        <span className={cn(
          'absolute inline-block rounded-full bg-white shadow-sm transition-transform duration-200',
          thumbSize, thumbTranslate,
        )} />
      </button>
      {label && <span className={cn('text-sm text-gray-080', disabled && 'text-fg-subtlest')}>{label}</span>}
    </label>
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────

interface MsInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  size?: 'sm' | 'md';
}

const INPUT_BASE =
  'w-full border bg-gray-005 text-fg-default placeholder:text-fg-subtlest transition-colors ' +
  'focus:outline-none focus:ring-4 focus:ring-gray-010 focus:border-gray-030 focus:bg-white ' +
  'disabled:bg-gray-005 disabled:text-fg-subtlest disabled:cursor-not-allowed';

const INPUT_SIZE = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md',
  md: 'px-3 py-2 text-sm rounded-lg',
} as const;

export function MsInput({
  label, hint, error,
  leftSlot, rightSlot,
  size = 'md',
  className,
  id,
  ...props
}: MsInputProps) {
  const inputId = id ?? (label ? label.replace(/\s+/g, '-') : undefined);
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-gray-060">
          {label}
        </label>
      )}
      <div className="relative">
        {leftSlot && (
          <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtlest">
            {leftSlot}
          </div>
        )}
        <input
          id={inputId}
          className={cn(
            INPUT_BASE,
            INPUT_SIZE[size],
            leftSlot  && (size === 'sm' ? 'pl-7'  : 'pl-8'),
            rightSlot && (size === 'sm' ? 'pr-7'  : 'pr-9'),
            error ? 'border-red-040 focus:ring-red-005 focus:border-red-040' : 'border-gray-020',
            className,
          )}
          {...props}
        />
        {rightSlot && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtlest">
            {rightSlot}
          </div>
        )}
      </div>
      {(hint || error) && (
        <p className={cn('text-xs', error ? 'text-red-050' : 'text-fg-subtlest')}>{error ?? hint}</p>
      )}
    </div>
  );
}

// ─── Textarea ────────────────────────────────────────────────────────────────

interface MsTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  size?: 'sm' | 'md';
  autoResize?: boolean;
}

const TEXTAREA_BASE =
  'w-full border bg-gray-005 text-fg-default placeholder:text-fg-subtlest transition-colors resize-y ' +
  'focus:outline-none focus:ring-4 focus:ring-gray-010 focus:border-gray-030 focus:bg-white ' +
  'disabled:bg-gray-005 disabled:text-fg-subtlest disabled:cursor-not-allowed';

const TEXTAREA_SIZE = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md',
  md: 'px-3 py-2 text-sm rounded-lg',
} as const;

export function MsTextarea({
  label, hint, error,
  size = 'md',
  autoResize = false,
  className,
  value,
  onChange,
  id,
  ...props
}: MsTextareaProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoResize || !taRef.current) return;
    const el = taRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize, value]);

  const textareaId = id ?? (label ? label.replace(/\s+/g, '-') : undefined);
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-medium text-gray-060">
          {label}
        </label>
      )}
      <textarea
        ref={taRef}
        id={textareaId}
        value={value}
        onChange={onChange}
        className={cn(
          TEXTAREA_BASE,
          TEXTAREA_SIZE[size],
          autoResize && 'resize-none overflow-hidden',
          error ? 'border-red-040 focus:ring-red-005 focus:border-red-040' : 'border-gray-020',
          className,
        )}
        {...props}
      />
      {(hint || error) && (
        <p className={cn('text-xs', error ? 'text-red-050' : 'text-fg-subtlest')}>{error ?? hint}</p>
      )}
    </div>
  );
}

// ─── Select ──────────────────────────────────────────────────────────────────

interface MsSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const SELECT_BASE =
  'w-full appearance-none px-3 py-2 pr-8 text-sm rounded-lg border bg-gray-005 text-fg-default transition-colors ' +
  'focus:outline-none focus:ring-4 focus:ring-gray-010 focus:border-gray-030 focus:bg-white ' +
  'disabled:text-fg-subtlest disabled:cursor-not-allowed';

export function MsSelect({
  label, hint, error,
  className,
  children,
  id,
  ...props
}: MsSelectProps) {
  const selectId = id ?? (label ? label.replace(/\s+/g, '-') : undefined);
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-gray-060">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            SELECT_BASE,
            error ? 'border-red-040 focus:ring-red-005' : 'border-gray-020',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <MsChevronDownLineIcon
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtlest"
        />
      </div>
      {(hint || error) && (
        <p className={cn('text-xs', error ? 'text-red-050' : 'text-fg-subtlest')}>{error ?? hint}</p>
      )}
    </div>
  );
}
