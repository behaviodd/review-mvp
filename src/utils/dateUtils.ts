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

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '어제';
  if (days < 7)  return `${days}일 전`;
  return formatDate(iso);
}
