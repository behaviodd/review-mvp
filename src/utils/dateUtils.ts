import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'yyyy. M. d', { locale: ko });
}

export function formatDateTime(dateStr: string) {
  return format(parseISO(dateStr), 'M월 d일 HH:mm', { locale: ko });
}

export function daysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

export function deadlineLabel(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0) return '마감';
  if (days === 0) return 'D-Day';
  return `D-${days}`;
}

export function isUrgent(dateStr: string): boolean {
  return daysUntil(dateStr) <= 3;
}
