import { cn } from '../ui/cn'

type AvatarProps = {
  src?: string | null
  initials?: string
  alt?: string
  color?: string          // CSS background color for initials fallback
  square?: boolean
  className?: string
}

export function Avatar({ src, initials, alt = '', color, square = false, className }: AvatarProps) {
  const rounded = square ? 'rounded-lg' : 'rounded-full'

  return (
    <span
      className={cn(
        'inline-grid shrink-0 align-middle [--avatar-radius:20%] *:col-start-1 *:row-start-1',
        square
          ? 'rounded-[--avatar-radius] *:rounded-[--avatar-radius]'
          : 'rounded-full *:rounded-full',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="size-full" />
      ) : initials ? (
        <svg
          className="size-full select-none fill-current text-white"
          viewBox="0 0 100 100"
          aria-hidden={alt ? undefined : 'true'}
          style={{ backgroundColor: color ?? '#18181b' }}
        >
          <text
            x="50%"
            y="50%"
            alignmentBaseline="middle"
            dominantBaseline="middle"
            textAnchor="middle"
            dy=".125em"
            fontSize={initials.length > 2 ? '35' : '42'}
            fontWeight="500"
            fontFamily="Inter, Pretendard, -apple-system, sans-serif"
          >
            {initials}
          </text>
        </svg>
      ) : (
        <span
          className={cn('size-full bg-zinc-200', rounded)}
          aria-hidden="true"
        />
      )}
    </span>
  )
}

/* ── AvatarButton ─────────────────────────────────────────────────── */

type AvatarButtonProps = AvatarProps & {
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  'aria-label'?: string
}

export function AvatarButton({ onClick, 'aria-label': ariaLabel, className, ...avatarProps }: AvatarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'relative focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
        avatarProps.square ? 'rounded-lg' : 'rounded-full',
        className,
      )}
    >
      <Avatar {...avatarProps} />
    </button>
  )
}
