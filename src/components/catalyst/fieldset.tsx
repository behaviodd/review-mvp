import { cn } from '../ui/cn'

export function Fieldset({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <fieldset className={cn('space-y-6', className)}>
      {children}
    </fieldset>
  )
}

export function Legend({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <legend className={cn('text-base/6 font-semibold text-fg-default sm:text-base/6', className)}>
      {children}
    </legend>
  )
}

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

export function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('cursor-default select-none text-base/6 font-medium text-fg-default sm:text-base/6', className)}>
      {children}
    </label>
  )
}

export function Description({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn('text-base/6 text-fg-subtle sm:text-base/6', className)}>
      {children}
    </p>
  )
}

export function ErrorMessage({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn('text-base/6 text-red-050 sm:text-base/6', className)}>
      {children}
    </p>
  )
}
