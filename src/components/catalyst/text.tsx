import { cn } from '../ui/cn'

type TextProps = { className?: string; children: React.ReactNode }

export function Text({ className, children }: TextProps) {
  return (
    <p className={cn('text-base/6 text-fg-subtle sm:text-base/6', className)}>
      {children}
    </p>
  )
}

export function Strong({ className, children }: TextProps) {
  return (
    <strong className={cn('font-medium text-fg-default', className)}>
      {children}
    </strong>
  )
}

export function Code({ className, children }: TextProps) {
  return (
    <code className={cn('rounded border border-gray-020 bg-gray-005 px-0.5 text-base font-medium text-fg-default', className)}>
      {children}
    </code>
  )
}
