import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../ui/cn'

export type ButtonColor =
  | 'dark/zinc' | 'white' | 'zinc'
  | 'indigo' | 'cyan' | 'sky' | 'blue'
  | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose' | 'red'
  | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal'

const solidColors: Record<string, string> = {
  'dark/zinc': 'bg-gray-080 text-white border-transparent shadow-sm hover:bg-gray-070 active:bg-gray-090 focus-visible:outline-gray-080',
  white:       'bg-white text-gray-099 border-gray-020 shadow-sm hover:bg-gray-005 active:bg-gray-010 focus-visible:outline-white',
  zinc:        'bg-gray-060 text-white border-transparent shadow-sm hover:bg-gray-050 active:bg-gray-070 focus-visible:outline-gray-060',
  indigo:      'bg-blue-060 text-white border-transparent shadow-sm hover:bg-blue-050 active:bg-blue-070 focus-visible:outline-blue-060',
  cyan:        'bg-blue-020 text-blue-070 border-transparent shadow-sm hover:bg-blue-010 active:bg-blue-040 focus-visible:outline-blue-020',
  sky:         'bg-blue-050 text-white border-transparent shadow-sm hover:bg-blue-040 active:bg-blue-060 focus-visible:outline-blue-050',
  blue:        'bg-blue-060 text-white border-transparent shadow-sm hover:bg-blue-050 active:bg-blue-070 focus-visible:outline-blue-060',
  violet:      'bg-purple-060 text-white border-transparent shadow-sm hover:bg-purple-050 active:bg-purple-060 focus-visible:outline-purple-060',
  purple:      'bg-purple-040 text-white border-transparent shadow-sm hover:bg-purple-050 active:bg-purple-060 focus-visible:outline-purple-040',
  fuchsia:     'bg-pink-040 text-white border-transparent shadow-sm hover:bg-pink-050 active:bg-pink-060 focus-visible:outline-pink-040',
  pink:        'bg-pink-050 text-white border-transparent shadow-sm hover:bg-pink-040 active:bg-pink-060 focus-visible:outline-pink-050',
  rose:        'bg-red-050 text-white border-transparent shadow-sm hover:bg-red-040 active:bg-red-060 focus-visible:outline-red-050',
  red:         'bg-red-040 text-white border-transparent shadow-sm hover:bg-red-050 active:bg-red-060 focus-visible:outline-red-040',
  orange:      'bg-orange-050 text-white border-transparent shadow-sm hover:bg-orange-040 active:bg-orange-060 focus-visible:outline-orange-050',
  amber:       'bg-yellow-005 text-yellow-070 border-transparent shadow-sm hover:bg-yellow-005 active:bg-yellow-060 focus-visible:outline-yellow-060',
  yellow:      'bg-yellow-005 text-yellow-070 border-transparent shadow-sm hover:bg-yellow-005 active:bg-yellow-060 focus-visible:outline-yellow-060',
  lime:        'bg-green-040 text-white border-transparent shadow-sm hover:bg-green-050 active:bg-green-060 focus-visible:outline-green-040',
  green:       'bg-green-060 text-white border-transparent shadow-sm hover:bg-green-050 active:bg-green-070 focus-visible:outline-green-060',
  emerald:     'bg-green-060 text-white border-transparent shadow-sm hover:bg-green-050 active:bg-green-070 focus-visible:outline-green-060',
  teal:        'bg-blue-060 text-white border-transparent shadow-sm hover:bg-blue-050 active:bg-blue-070 focus-visible:outline-blue-060',
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
  '[&_svg]:my-0.5 [&_svg]:size-5 [&_svg]:sm:size-4 [&_svg]:shrink-0 [&_svg]:-mx-0.5',
].join(' ')

const outlineBase = cn(
  base,
  'border-gray-020 text-gray-099 bg-transparent',
  'hover:bg-gray-005 active:bg-gray-010',
  'focus-visible:outline-gray-099',
  '[&_svg]:text-gray-050',
)

const plainBase = cn(
  base,
  'border-transparent text-gray-099 bg-transparent',
  'hover:bg-gray-005 active:bg-gray-010',
  'focus-visible:outline-gray-099',
  '[&_svg]:text-gray-050',
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
