import { cn } from '../ui/cn'

type DividerProps = { soft?: boolean; className?: string }

export function Divider({ soft = false, className }: DividerProps) {
  return (
    <hr
      className={cn(
        'w-full border-t',
        soft ? 'border-zinc-950/5' : 'border-zinc-950/10',
        className,
      )}
    />
  )
}
