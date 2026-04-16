import { cn } from '../ui/cn'

/* ── Fieldset ────────────────────────────────────────────────────── */

export function Fieldset({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <fieldset className={cn('space-y-6', className)}>
      {children}
    </fieldset>
  )
}

export function Legend({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <legend className={cn('text-base/6 font-semibold text-zinc-950 sm:text-sm/6', className)}>
      {children}
    </legend>
  )
}

/* ── Field ───────────────────────────────────────────────────────── */

export function Field({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-y-2', className)}>
      {children}
    </div>
  )
}

export function FieldGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('space-y-8', className)}>
      {children}
    </div>
  )
}

/* ── Label ───────────────────────────────────────────────────────── */

export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('cursor-default select-none text-base/6 font-medium text-zinc-950 sm:text-sm/6', className)}>
      {children}
    </label>
  )
}

/* ── Description ─────────────────────────────────────────────────── */

export function Description({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn('text-base/6 text-zinc-500 sm:text-sm/6', className)}>
      {children}
    </p>
  )
}

/* ── ErrorMessage ────────────────────────────────────────────────── */

export function ErrorMessage({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn('text-base/6 text-red-600 sm:text-sm/6', className)}>
      {children}
    </p>
  )
}
