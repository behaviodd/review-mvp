import { cn } from '../ui/cn'

type TextProps = { className?: string; children: React.ReactNode }

export function Text({ className, children }: TextProps) {
  return (
    <p className={cn('text-base/6 text-gray-050 sm:text-sm/6', className)}>
      {children}
    </p>
  )
}

export function Strong({ className, children }: TextProps) {
  return (
    <strong className={cn('font-medium text-gray-099', className)}>
      {children}
    </strong>
  )
}

export function Code({ className, children }: TextProps) {
  return (
    <code className={cn('rounded border border-gray-020 bg-gray-005 px-0.5 text-sm font-medium text-gray-099', className)}>
      {children}
    </code>
  )
}
