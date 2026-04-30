import { forwardRef } from 'react'
import { MsChevronDownLineIcon } from '../ui/MsIcons'
import { cn } from '../ui/cn'

const selectBase = [
  'relative block w-full appearance-none rounded-lg',
  'pl-3.5 pr-8 py-2.5 sm:pl-3 sm:pr-8 sm:py-1.5',
  'text-base/6 text-fg-default sm:text-base/6',
  'border border-gray-020 bg-white',
  'transition-colors duration-150',
  'focus:outline-none focus:border-gray-030 focus:ring-4 focus:ring-gray-010',
  'disabled:border-gray-020 disabled:bg-gray-005 disabled:text-fg-subtle disabled:cursor-not-allowed',
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
        className={cn(selectBase, invalid && 'border-red-040', className)}
        {...props}
      >
        {children}
      </select>
      <MsChevronDownLineIcon
        size={16}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtlest"
        aria-hidden="true"
      />
    </div>
  )
})
