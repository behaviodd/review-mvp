import { forwardRef } from 'react'
import { cn } from '../ui/cn'

const textareaBase = [
  'relative block w-full appearance-none rounded-lg resize-y',
  'px-3.5 py-2.5 sm:px-3 sm:py-2',
  'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6',
  'border border-zinc-950/10 bg-white',
  'transition-colors duration-150',
  'focus:outline-none focus:border-zinc-950/30 focus:ring-4 focus:ring-zinc-950/5',
  'invalid:border-red-500',
  'disabled:border-zinc-950/20 disabled:bg-zinc-950/[2.5%] disabled:text-zinc-950/50 disabled:cursor-not-allowed',
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
      className={cn(textareaBase, invalid && 'border-red-500 ring-red-500/10', className)}
      {...props}
    />
  )
})
