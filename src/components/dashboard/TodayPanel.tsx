import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { MsAlertIcon, MsProfileIcon, MsSendIcon, MsCheckCircleIcon, MsChevronRightLineIcon } from '../ui/MsIcons';
import { Pill } from '../ui/Pill';
import { daysUntil } from '../../utils/dateUtils';
import { validateDistribution } from '../review/DistributionProgress';

type Variant = 'admin' | 'leader';

interface Props {
  variant: Variant;
}

/**
 * "오늘 할 일" 패널. admin/leader 각자 관점에 맞는 4가지 주요 카드.
 */
export function TodayPanel({ variant }: Props) {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const cycles = useReviewStore(s => s.cycles);
  const submissions = useReviewStore(s => s.submissions);
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);

  const activeCycles = useMemo(
    () => cycles.filter(c => !c.archivedAt && c.status !== 'draft' && c.status !== 'closed'),
    [cycles]
  );

  // 리마인드 필요: 진행 중 사이클의 미제출 + D-3 이내
  const remindCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return activeCycles.reduce((acc, c) => {
      const deadline = c.status === 'manager_review' ? c.managerReviewDeadline : c.selfReviewDeadline;
      if (daysUntil(deadline) > 3) return acc;
      const pending = submissions.filter(s =>
        s.cycleId === c.id && s.status !== 'submitted' && deadline.slice(0, 10) >= today
      ).length;
      return acc + pending;
    }, 0);
  }, [activeCycles, submissions]);

  // 승인 대기
  const approvalCount = useMemo(() => {
    if (!currentUser) return 0;
    if (variant === 'admin') {
      return submissions.filter(s => s.type === 'peer' && s.peerProposal?.status === 'pending').length;
    }
    // leader
    const byMgr = new Set(users.filter(u => u.managerId === currentUser.id).map(u => u.id));
    const headOrgs = new Set(orgUnits.filter(o => o.headId === currentUser.id).map(o => o.name));
    const orgMembers = new Set(users.filter(u =>
      headOrgs.has(u.department) || headOrgs.has(u.subOrg ?? '__') ||
      headOrgs.has(u.team ?? '__') || headOrgs.has(u.squad ?? '__')
    ).map(u => u.id));
    const leadeeIds = new Set([...byMgr, ...orgMembers]);
    return submissions.filter(s =>
      s.type === 'peer' && s.peerProposal?.status === 'pending' && leadeeIds.has(s.revieweeId)
    ).length;
  }, [submissions, users, orgUnits, currentUser, variant]);

  // 분포 조정 필요: distribution이 있는 사이클 중 hard 초과
  const distributionCycles = useMemo(() => {
    if (variant !== 'admin') return [];
    return activeCycles.filter(c => {
      if (!c.distribution || c.distribution.method !== 'hard') return false;
      // 각 조직장별 violation 존재 여부
      const reviewerIds = new Set(submissions.filter(s => s.cycleId === c.id && s.type === 'downward').map(s => s.reviewerId));
      for (const rid of reviewerIds) {
        const violations = validateDistribution(c.distribution, c.id, rid, submissions);
        if (violations.length > 0) return true;
      }
      return false;
    });
  }, [activeCycles, submissions, variant]);

  // 종료 임박
  const closingCount = useMemo(() => {
    return activeCycles.filter(c => {
      const d = daysUntil(c.managerReviewDeadline);
      return d >= 0 && d <= 7;
    }).length;
  }, [activeCycles]);

  type Tone = 'warning' | 'danger' | 'info' | 'purple';
  interface Card {
    key: string;
    label: string;
    count: number;
    tone: Tone;
    icon: React.ComponentType<{ size?: number | string; className?: string }>;
    onClick: () => void;
    show: boolean;
  }
  const cards: Card[] = ([

    {
      key: 'remind',
      label: '리마인드 필요',
      count: remindCount,
      tone: 'warning',
      icon: MsSendIcon,
      onClick: () => navigate('/cycles'),
      show: variant === 'admin' && remindCount > 0,
    },
    {
      key: 'approval',
      label: '승인 대기',
      count: approvalCount,
      tone: 'purple',
      icon: MsCheckCircleIcon,
      onClick: () => navigate('/reviews/team/peer-approvals'),
      show: approvalCount > 0,
    },
    {
      key: 'distribution',
      label: '분포 조정 필요',
      count: distributionCycles.length,
      tone: 'danger',
      icon: MsAlertIcon,
      onClick: () => distributionCycles[0] && navigate(`/cycles/${distributionCycles[0].id}`),
      show: variant === 'admin' && distributionCycles.length > 0,
    },
    {
      key: 'closing',
      label: '종료 임박',
      count: closingCount,
      tone: 'info',
      icon: MsProfileIcon,
      onClick: () => navigate('/cycles?status=in_progress&sort=deadline_asc'),
      show: closingCount > 0,
    },
  ] satisfies Card[]).filter(c => c.show);

  if (cards.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-050">오늘 할 일</h2>
        <Pill tone="neutral" size="xs">{cards.length}</Pill>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          const toneBg =
            card.tone === 'warning' ? 'bg-orange-005 border-orange-020' :
            card.tone === 'danger'  ? 'bg-red-005 border-red-020' :
            card.tone === 'info'    ? 'bg-blue-005 border-blue-020' :
            'bg-purple-005 border-purple-010';
          const toneText =
            card.tone === 'warning' ? 'text-orange-070' :
            card.tone === 'danger'  ? 'text-red-070' :
            card.tone === 'info'    ? 'text-blue-070' :
            'text-purple-060';
          return (
            <button
              key={card.key}
              type="button"
              onClick={card.onClick}
              className={cn('flex items-center gap-3 rounded-xl border p-4 text-left transition-shadow hover:shadow-card-hover', toneBg)}
            >
              <div className="size-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                <Icon size={20} className={toneText} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold', toneText)}>{card.label}</p>
                <p className="text-2xl font-bold text-gray-080 mt-0.5 tabular-nums">{card.count}</p>
              </div>
              <MsChevronRightLineIcon size={14} className={toneText} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
