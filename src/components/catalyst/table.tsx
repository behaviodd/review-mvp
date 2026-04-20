import { cn } from '../ui/cn'

/* ── Table ──────────────────────────────────────────────────────── */

type TableProps = {
  dense?: boolean
  grid?: boolean
  striped?: boolean
  bleed?: boolean
  className?: string
  children: React.ReactNode
}

export function Table({ dense = false, grid = false, striped = false, bleed = false, className, children }: TableProps) {
  return (
    <div className={cn('flow-root', className)}>
      <div className={cn('-mx-[--gutter]', !bleed && '[--gutter:theme(spacing.5)]')}>
        <div className="inline-block min-w-full align-middle">
          <table
            className={cn(
              'min-w-full text-left text-sm/6 text-zinc-950',
              striped && '[&_tbody_tr:nth-child(even)]:bg-zinc-950/[2.5%]',
              grid && '[&_td]:border-l [&_td]:border-zinc-950/5 [&_td:first-child]:border-l-0 [&_th]:border-l [&_th:first-child]:border-l-0 [&_th]:border-zinc-950/5',
              dense && '[&_td]:py-2 [&_th]:py-2',
            )}
          >
            {children}
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── TableHead ──────────────────────────────────────────────────── */

export function TableHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <thead className={cn('text-zinc-500', className)}>
      {children}
    </thead>
  )
}

/* ── TableBody ──────────────────────────────────────────────────── */

export function TableBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tbody className={cn('', className)}>{children}</tbody>
}

/* ── TableRow ───────────────────────────────────────────────────── */

type TableRowProps = {
  href?: string
  className?: string
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLTableRowElement>
}

export function TableRow({ href, className, children, onClick }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-zinc-950/5 last:border-none',
        href || onClick ? 'cursor-pointer hover:bg-zinc-950/[2.5%] transition-colors' : '',
        className,
      )}
    >
      {children}
    </tr>
  )
}

/* ── TableHeader ─────────────────────────────────────────────────── */

export function TableHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th
      className={cn(
        'border-b border-b-zinc-950/10 px-5 py-2 font-medium',
        'first:pl-5 last:pr-5',
        className,
      )}
    >
      {children}
    </th>
  )
}

/* ── TableCell ───────────────────────────────────────────────────── */

export function TableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <td
      className={cn(
        'relative px-5 py-4 align-middle',
        'first:pl-5 last:pr-5',
        className,
      )}
    >
      {children}
    </td>
  )
}
