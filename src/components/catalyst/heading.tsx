import { cn } from '../ui/cn'

type HeadingProps = { level?: 1 | 2 | 3 | 4; className?: string; children: React.ReactNode }

export function Heading({ level = 1, className, children }: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
  return (
    <Tag className={cn('text-2xl/8 font-semibold text-fg-default sm:text-xl/8', className)}>
      {children}
    </Tag>
  )
}

export function Subheading({ level = 2, className, children }: HeadingProps) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
  return (
    <Tag className={cn('text-base/7 font-semibold text-fg-default sm:text-base/6', className)}>
      {children}
    </Tag>
  )
}
