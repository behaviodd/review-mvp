import { forwardRef } from 'react'
import { cn } from '../ui/cn'

const textareaBase = [
  'relative block w-full appearance-none rounded-lg resize-y',
  'px-3.5 py-2.5 sm:px-3 sm:py-2',
  'text-base/6 text-gray-099 placeholder:text-gray-050 sm:text-sm/6',
  'border border-gray-020 bg-white',
  'transition-colors duration-150',
  'focus:outline-none focus:border-gray-030 focus:ring-4 focus:ring-gray-010',
  'invalid:border-red-040',
  'disabled:border-gray-020 disabled:bg-gray-005 disabled:text-gray-050 disabled:cursor-not-allowed',
].join(' ')

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(textareaBase, invalid && 'border-red-040 ring-red-010', className)}
      {...props}
    />
  )
})
