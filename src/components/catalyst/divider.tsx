import { cn } from '../ui/cn'

type DividerProps = { soft?: boolean; className?: string }

export function Divider({ soft = false, className }: DividerProps) {
  return (
    <hr
      className={cn(
        'w-full border-t',
        soft ? 'border-gray-010' : 'border-gray-020',
        className,
      )}
    />
  )
}
