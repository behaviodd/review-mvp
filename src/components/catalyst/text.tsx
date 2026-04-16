import { cn } from '../ui/cn'

type TextProps = { className?: string; children: React.ReactNode }

export function Text({ className, children }: TextProps) {
  return (
    <p className={cn('text-base/6 text-zinc-500 sm:text-sm/6', className)}>
      {children}
    </p>
  )
}

export function Strong({ className, children }: TextProps) {
  return (
    <strong className={cn('font-medium text-zinc-950', className)}>
      {children}
    </strong>
  )
}

export function Code({ className, children }: TextProps) {
  return (
    <code className={cn('rounded border border-zinc-950/10 bg-zinc-950/[2.5%] px-0.5 text-sm font-medium text-zinc-950', className)}>
      {children}
    </code>
  )
}
