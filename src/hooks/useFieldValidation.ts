import { useState, useCallback } from 'react';

type Rules<T> = Partial<Record<keyof T, (v: unknown) => string | null>>;

export function useFieldValidation<T extends Record<string, unknown>>(
  values: T,
  rules: Rules<T>,
) {
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());

  const touch = useCallback((field: keyof T) => {
    setTouched(s => new Set(s).add(field));
    const rule = rules[field];
    if (rule) {
      const msg = rule(values[field]);
      setErrors(e => ({ ...e, [field]: msg ?? undefined }));
    }
  }, [rules, values]);

  const clearError = useCallback((field: keyof T) => {
    setErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }, []);

  const validate = useCallback(() => {
    const next: Partial<Record<keyof T, string>> = {};
    let valid = true;
    for (const field of Object.keys(rules) as (keyof T)[]) {
      const rule = rules[field];
      if (rule) {
        const msg = rule(values[field]);
        if (msg) { next[field] = msg; valid = false; }
      }
    }
    setErrors(next);
    setTouched(new Set(Object.keys(rules) as (keyof T)[]));
    return valid;
  }, [rules, values]);

  const resetErrors = useCallback(() => {
    setErrors({});
    setTouched(new Set());
  }, []);

  // Only expose errors for touched fields (or after validate() is called)
  const visibleErrors: Partial<Record<keyof T, string>> = {};
  for (const field of touched) {
    if (errors[field]) visibleErrors[field] = errors[field];
  }

  return { errors: visibleErrors, validate, touch, clearError, resetErrors };
}
