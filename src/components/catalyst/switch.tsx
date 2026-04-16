import { cn } from '../ui/cn'

type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

export function Switch({ checked, onChange, disabled = false, className, 'aria-label': ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        // Track
        'relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full',
        'ring-1 ring-inset transition-colors duration-200 ease-in-out',
        'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        checked
          ? 'bg-indigo-600 ring-indigo-700/90'
          : 'bg-zinc-200 ring-zinc-950/10',
        className,
      )}
    >
      {/* Thumb */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none mt-1 inline-block size-4 rounded-full bg-white',
          'shadow ring-1 ring-zinc-950/10',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-1',
        )}
      />
    </button>
  )
}
