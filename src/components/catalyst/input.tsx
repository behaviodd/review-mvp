import { forwardRef } from 'react'
import { cn } from '../ui/cn'

const inputBase = [
  'relative block w-full appearance-none rounded-lg',
  'px-3.5 py-2.5 sm:px-3 sm:py-1.5',
  'text-base/6 text-gray-099 placeholder:text-gray-050 sm:text-sm/6',
  'border border-gray-020 bg-white',
  'transition-colors duration-150',
  'focus:outline-none focus:border-gray-030 focus:ring-4 focus:ring-gray-010',
  'invalid:border-red-040',
  'disabled:border-gray-020 disabled:bg-gray-005 disabled:text-gray-050 disabled:cursor-not-allowed',
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
      className={cn(inputBase, invalid && 'border-red-040 ring-red-010', className)}
      {...props}
    />
  )
})

export function InputGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      'relative',
      '[&>[data-slot=icon]:first-child]:absolute [&>[data-slot=icon]:first-child]:left-3 [&>[data-slot=icon]:first-child]:top-1/2 [&>[data-slot=icon]:first-child]:-translate-y-1/2 [&>[data-slot=icon]:first-child]:size-4 [&>[data-slot=icon]:first-child]:text-gray-040 [&>[data-slot=icon]:first-child]:pointer-events-none',
      '[&>[data-slot=icon]:first-child+input]:pl-9 [&>[data-slot=icon]:first-child+input]:sm:pl-8',
      '[&>input+[data-slot=icon]]:absolute [&>input+[data-slot=icon]]:right-3 [&>input+[data-slot=icon]]:top-1/2 [&>input+[data-slot=icon]]:-translate-y-1/2 [&>input+[data-slot=icon]]:size-4 [&>input+[data-slot=icon]]:text-gray-040 [&>input+[data-slot=icon]]:pointer-events-none',
      className,
    )}>
      {children}
    </div>
  )
}
