import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../ui/cn'

export type ButtonColor =
  | 'dark/zinc' | 'white' | 'zinc'
  | 'indigo' | 'cyan' | 'sky' | 'blue'
  | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose' | 'red'
  | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal'

const solidColors: Record<string, string> = {
  'dark/zinc': 'bg-zinc-800 text-white border-transparent shadow-sm hover:bg-zinc-700 active:bg-zinc-900 focus-visible:outline-zinc-800',
  white:       'bg-white text-zinc-950 border-zinc-950/15 shadow-sm hover:bg-zinc-50 active:bg-zinc-100 focus-visible:outline-white',
  zinc:        'bg-zinc-600 text-white border-transparent shadow-sm hover:bg-zinc-500 active:bg-zinc-700 focus-visible:outline-zinc-600',
  indigo:      'bg-indigo-600 text-white border-transparent shadow-sm hover:bg-indigo-500 active:bg-indigo-700 focus-visible:outline-indigo-600',
  cyan:        'bg-cyan-300 text-cyan-950 border-transparent shadow-sm hover:bg-cyan-200 active:bg-cyan-400 focus-visible:outline-cyan-300',
  sky:         'bg-sky-500 text-white border-transparent shadow-sm hover:bg-sky-400 active:bg-sky-600 focus-visible:outline-sky-500',
  blue:        'bg-blue-600 text-white border-transparent shadow-sm hover:bg-blue-500 active:bg-blue-700 focus-visible:outline-blue-600',
  violet:      'bg-violet-600 text-white border-transparent shadow-sm hover:bg-violet-500 active:bg-violet-700 focus-visible:outline-violet-600',
  purple:      'bg-purple-600 text-white border-transparent shadow-sm hover:bg-purple-500 active:bg-purple-700 focus-visible:outline-purple-600',
  fuchsia:     'bg-fuchsia-500 text-white border-transparent shadow-sm hover:bg-fuchsia-400 active:bg-fuchsia-600 focus-visible:outline-fuchsia-500',
  pink:        'bg-pink-600 text-white border-transparent shadow-sm hover:bg-pink-500 active:bg-pink-700 focus-visible:outline-pink-600',
  rose:        'bg-rose-600 text-white border-transparent shadow-sm hover:bg-rose-500 active:bg-rose-700 focus-visible:outline-rose-600',
  red:         'bg-red-600 text-white border-transparent shadow-sm hover:bg-red-500 active:bg-red-700 focus-visible:outline-red-600',
  orange:      'bg-orange-500 text-white border-transparent shadow-sm hover:bg-orange-400 active:bg-orange-600 focus-visible:outline-orange-500',
  amber:       'bg-amber-400 text-amber-950 border-transparent shadow-sm hover:bg-amber-300 active:bg-amber-500 focus-visible:outline-amber-400',
  yellow:      'bg-yellow-300 text-yellow-950 border-transparent shadow-sm hover:bg-yellow-200 active:bg-yellow-400 focus-visible:outline-yellow-300',
  lime:        'bg-lime-400 text-lime-950 border-transparent shadow-sm hover:bg-lime-300 active:bg-lime-500 focus-visible:outline-lime-400',
  green:       'bg-green-600 text-white border-transparent shadow-sm hover:bg-green-500 active:bg-green-700 focus-visible:outline-green-600',
  emerald:     'bg-emerald-600 text-white border-transparent shadow-sm hover:bg-emerald-500 active:bg-emerald-700 focus-visible:outline-emerald-600',
  teal:        'bg-teal-600 text-white border-transparent shadow-sm hover:bg-teal-500 active:bg-teal-700 focus-visible:outline-teal-600',
}

const base = [
  'relative isolate inline-flex items-center justify-center gap-x-2',
  'rounded-lg border font-semibold',
  'text-base/6 sm:text-sm/6',
  'px-3.5 py-2.5 sm:px-3 sm:py-1.5',
  'cursor-pointer select-none whitespace-nowrap',
  'transition-colors duration-150',
  'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'disabled:opacity-50 disabled:pointer-events-none',
  // Icon sizing
  '[&_svg]:my-0.5 [&_svg]:size-5 [&_svg]:sm:size-4 [&_svg]:shrink-0 [&_svg]:-mx-0.5',
].join(' ')

const outlineBase = cn(
  base,
  'border-zinc-950/15 text-zinc-950 bg-transparent',
  'hover:bg-zinc-950/5 active:bg-zinc-950/10',
  'focus-visible:outline-zinc-950',
  '[&_svg]:text-zinc-500',
)

const plainBase = cn(
  base,
  'border-transparent text-zinc-950 bg-transparent',
  'hover:bg-zinc-950/5 active:bg-zinc-950/10',
  'focus-visible:outline-zinc-950',
  '[&_svg]:text-zinc-500',
)

type ButtonProps = {
  color?: ButtonColor
  outline?: boolean
  plain?: boolean
  href?: string
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
  title?: string
  'aria-label'?: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { color = 'dark/zinc', outline = false, plain = false, href, children, className, ...props },
  ref,
) {
  const classes = outline
    ? cn(outlineBase, className)
    : plain
      ? cn(plainBase, className)
      : cn(base, solidColors[color] ?? solidColors['dark/zinc'], className)

  if (href) {
    return (
      <Link to={href} className={classes} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
  }

  return (
    <button ref={ref} className={classes} {...props}>
      {children}
    </button>
  )
})
