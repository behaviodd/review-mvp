/**
 * 경량 SVG 일러스트. EmptyState의 icon 대체용.
 */

interface Props {
  size?: number;
  variant: 'empty-list' | 'empty-inbox' | 'empty-cycle';
  className?: string;
}

export function EmptyIllustration({ size = 80, variant, className }: Props) {
  if (variant === 'empty-list') {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" fill="none" className={className} aria-hidden>
        <rect x="12" y="16" width="56" height="48" rx="8" fill="#f0f3f4" />
        <rect x="20" y="26" width="40" height="4" rx="2" fill="#c4cdd4" />
        <rect x="20" y="36" width="28" height="4" rx="2" fill="#dfe4ea" />
        <rect x="20" y="46" width="34" height="4" rx="2" fill="#dfe4ea" />
        <rect x="20" y="56" width="24" height="4" rx="2" fill="#dfe4ea" />
        <circle cx="56" cy="58" r="10" fill="#fad1df" />
        <path d="M51 58 h10 M56 53 v10" stroke="#e5195e" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === 'empty-inbox') {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80" fill="none" className={className} aria-hidden>
        <path d="M14 34 L22 16 h36 l8 18" stroke="#8a99a8" strokeWidth="2" strokeLinejoin="round" />
        <path d="M14 34 v26 a6 6 0 0 0 6 6 h40 a6 6 0 0 0 6 -6 v-26 h-14 l-4 8 h-16 l-4 -8 z" fill="#f0f3f4" stroke="#8a99a8" strokeWidth="2" />
        <circle cx="62" cy="20" r="10" fill="#39c661" />
        <path d="M57 20 l4 4 l7 -8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // empty-cycle
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" className={className} aria-hidden>
      <circle cx="40" cy="40" r="26" stroke="#c4cdd4" strokeWidth="3" strokeDasharray="4 6" />
      <circle cx="40" cy="40" r="10" fill="#fad1df" />
      <path d="M40 36 v8 M36 40 h8" stroke="#e5195e" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
