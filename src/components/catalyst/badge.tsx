import { cn } from '../ui/cn'

export type BadgeColor =
  | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald'
  | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple'
  | 'fuchsia' | 'pink' | 'rose' | 'zinc'

const colors: Record<BadgeColor, string> = {
  red:     'bg-red-005     text-red-060    ring-red-060/20',
  orange:  'bg-orange-005  text-orange-060 ring-orange-060/20',
  amber:   'bg-yellow-005  text-yellow-060 ring-yellow-060/20',
  yellow:  'bg-yellow-005  text-yellow-060 ring-yellow-060/20',
  lime:    'bg-green-005   text-green-060  ring-green-060/20',
  green:   'bg-green-005   text-green-060  ring-green-060/20',
  emerald: 'bg-green-005   text-green-060  ring-green-060/20',
  teal:    'bg-blue-005    text-blue-060   ring-blue-060/20',
  cyan:    'bg-blue-005    text-blue-060   ring-blue-060/20',
  sky:     'bg-blue-005    text-blue-050   ring-blue-050/20',
  blue:    'bg-blue-005    text-blue-060   ring-blue-060/20',
  indigo:  'bg-blue-005    text-blue-060   ring-blue-060/20',
  violet:  'bg-purple-005  text-purple-060 ring-purple-060/20',
  purple:  'bg-purple-005  text-purple-060 ring-purple-060/20',
  fuchsia: 'bg-pink-005    text-pink-060   ring-pink-060/20',
  pink:    'bg-pink-005    text-pink-050   ring-pink-050/20',
  rose:    'bg-red-005     text-red-050    ring-red-050/20',
  zinc:    'bg-gray-010    text-gray-060   ring-gray-030',
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
