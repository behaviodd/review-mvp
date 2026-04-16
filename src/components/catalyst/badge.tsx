import { cn } from '../ui/cn'

export type BadgeColor =
  | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald'
  | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple'
  | 'fuchsia' | 'pink' | 'rose' | 'zinc'

const colors: Record<BadgeColor, string> = {
  red:     'bg-red-400/10     text-red-700     ring-red-600/20',
  orange:  'bg-orange-400/10  text-orange-700  ring-orange-600/20',
  amber:   'bg-amber-400/10   text-amber-700   ring-amber-600/20',
  yellow:  'bg-yellow-400/10  text-yellow-800  ring-yellow-600/20',
  lime:    'bg-lime-400/10    text-lime-700    ring-lime-600/20',
  green:   'bg-green-400/10   text-green-700   ring-green-600/20',
  emerald: 'bg-emerald-400/10 text-emerald-700 ring-emerald-600/20',
  teal:    'bg-teal-400/10    text-teal-700    ring-teal-600/20',
  cyan:    'bg-cyan-400/10    text-cyan-700    ring-cyan-600/20',
  sky:     'bg-sky-400/10     text-sky-700     ring-sky-600/20',
  blue:    'bg-blue-400/10    text-blue-700    ring-blue-700/10',
  indigo:  'bg-indigo-400/10  text-indigo-700  ring-indigo-700/10',
  violet:  'bg-violet-400/10  text-violet-700  ring-violet-700/10',
  purple:  'bg-purple-400/10  text-purple-700  ring-purple-700/10',
  fuchsia: 'bg-fuchsia-400/10 text-fuchsia-700 ring-fuchsia-700/10',
  pink:    'bg-pink-400/10    text-pink-700    ring-pink-700/10',
  rose:    'bg-rose-400/10    text-rose-700    ring-rose-700/10',
  zinc:    'bg-zinc-400/10    text-zinc-600    ring-zinc-500/20',
}

type BadgeProps = {
  color?: BadgeColor
  className?: string
  children: React.ReactNode
}

export function Badge({ color = 'zinc', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  )
}
