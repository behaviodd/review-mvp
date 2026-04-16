import { forwardRef } from 'react'
import { cn } from '../ui/cn'

const inputBase = [
  'relative block w-full appearance-none rounded-lg',
  'px-3.5 py-2.5 sm:px-3 sm:py-1.5',
  'text-base/6 text-zinc-950 placeholder:text-zinc-500 sm:text-sm/6',
  'border border-zinc-950/10 bg-white',
  'transition-colors duration-150',
  'focus:outline-none focus:border-zinc-950/30 focus:ring-4 focus:ring-zinc-950/5',
  'invalid:border-red-500',
  'disabled:border-zinc-950/20 disabled:bg-zinc-950/[2.5%] disabled:text-zinc-950/50 disabled:cursor-not-allowed',
].join(' ')

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(inputBase, invalid && 'border-red-500 ring-red-500/10', className)}
      {...props}
    />
  )
})

/* ── InputGroup ──────────────────────────────────────────────────── */
// Wrapper that positions icon/addon on left or right side of an input

export function InputGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      'relative',
      // Left icon
      '[&>[data-slot=icon]:first-child]:absolute [&>[data-slot=icon]:first-child]:left-3 [&>[data-slot=icon]:first-child]:top-1/2 [&>[data-slot=icon]:first-child]:-translate-y-1/2 [&>[data-slot=icon]:first-child]:size-4 [&>[data-slot=icon]:first-child]:text-zinc-400 [&>[data-slot=icon]:first-child]:pointer-events-none',
      '[&>[data-slot=icon]:first-child+input]:pl-9 [&>[data-slot=icon]:first-child+input]:sm:pl-8',
      // Right icon
      '[&>input+[data-slot=icon]]:absolute [&>input+[data-slot=icon]]:right-3 [&>input+[data-slot=icon]]:top-1/2 [&>input+[data-slot=icon]]:-translate-y-1/2 [&>input+[data-slot=icon]]:size-4 [&>input+[data-slot=icon]]:text-zinc-400 [&>input+[data-slot=icon]]:pointer-events-none',
      className,
    )}>
      {children}
    </div>
  )
}
