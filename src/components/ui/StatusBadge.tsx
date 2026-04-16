import { Badge } from '../catalyst/badge';
import type { BadgeColor } from '../catalyst/badge';
import type { SubmissionStatus, ReviewStatus, UserRole } from '../../types';
import { cn } from './cn';

const SUBMISSION_CONFIG: Record<SubmissionStatus, { label: string; color: BadgeColor }> = {
  not_started: { label: '미작성',    color: 'zinc'    },
  in_progress: { label: '작성 중',   color: 'indigo'  },
  submitted:   { label: '제출 완료', color: 'emerald' },
};

const REVIEW_CONFIG: Record<ReviewStatus, { label: string; color: BadgeColor }> = {
  draft:          { label: '초안',        color: 'zinc'    },
  active:         { label: '진행 중',     color: 'indigo'  },
  self_review:    { label: '자기평가',    color: 'indigo'  },
  manager_review: { label: '매니저 평가', color: 'violet'  },
  calibration:    { label: '조율 중',     color: 'amber'   },
  closed:         { label: '완료',        color: 'emerald' },
};

const ROLE_CONFIG: Record<UserRole, { label: string; color: BadgeColor }> = {
  admin:    { label: '관리자', color: 'indigo'  },
  manager:  { label: '팀장',   color: 'emerald' },
  employee: { label: '팀원',   color: 'zinc'    },
};

interface Props {
  type: 'submission' | 'review' | 'role';
  value: SubmissionStatus | ReviewStatus | UserRole;
  className?: string;
}

export function StatusBadge({ type, value, className }: Props) {
  const cfg =
    type === 'submission' ? SUBMISSION_CONFIG[value as SubmissionStatus] :
    type === 'review'     ? REVIEW_CONFIG[value as ReviewStatus] :
                            ROLE_CONFIG[value as UserRole];

  return <Badge color={cfg.color} className={cn(className)}>{cfg.label}</Badge>;
}
