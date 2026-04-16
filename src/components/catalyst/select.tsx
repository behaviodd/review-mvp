import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../ui/cn'

const selectBase = [
  'relative block w-full appearance-none rounded-lg',
  'pl-3.5 pr-8 py-2.5 sm:pl-3 sm:pr-8 sm:py-1.5',
  'text-base/6 text-zinc-950 sm:text-sm/6',
  'border border-zinc-950/10 bg-white',
  'transition-colors duration-150',
  'focus:outline-none focus:border-zinc-950/30 focus:ring-4 focus:ring-zinc-950/5',
  'disabled:border-zinc-950/20 disabled:bg-zinc-950/[2.5%] disabled:text-zinc-950/50 disabled:cursor-not-allowed',
].join(' ')

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(selectBase, invalid && 'border-red-500', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400"
        aria-hidden="true"
      />
    </div>
  )
})
