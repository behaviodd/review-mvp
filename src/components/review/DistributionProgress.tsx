import { cn } from '../../utils/cn';
import type { DistributionBand, DistributionPolicy, ReviewSubmission } from '../../types';

interface Props {
  policy: DistributionPolicy;
  cycleId: string;
  reviewerId: string;       // 현재 조직장
  submissions: ReviewSubmission[];
}

function bandForRating(bands: DistributionBand[], rating: number): DistributionBand | undefined {
  // minRating/maxRating 구간이 설정된 경우 해당 구간에 속하면 그 band로 집계
  return bands.find(b =>
    (b.minRating == null || rating >= b.minRating) &&
    (b.maxRating == null || rating <= b.maxRating)
  );
}

/**
 * 조직장(reviewerId) 이 이 cycle에서 작성 중/작성 완료한 downward submissions의
 * overallRating 분포를 bands에 매핑해 진행 바를 렌더한다.
 */
export function DistributionProgress({ policy, cycleId, reviewerId, submissions }: Props) {
  const myDownwards = submissions.filter(s =>
    s.cycleId === cycleId && s.type === 'downward' && s.reviewerId === reviewerId
  );
  const totalAssigned = myDownwards.length;
  const withRating   = myDownwards.filter(s => s.overallRating != null);

  // 각 band의 현재 사용 수
  const usage: Record<string, number> = {};
  for (const band of policy.bands) usage[band.label] = 0;
  for (const sub of withRating) {
    const band = bandForRating(policy.bands, sub.overallRating!);
    if (band) usage[band.label] = (usage[band.label] ?? 0) + 1;
  }

  return (
    /* Phase D-3.D-3: border-y → border-t (가로 선 1줄, OpsCenter 내 일관 패턴) */
    <div className="border-t border-bd-default px-2 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-080">등급 분포 {policy.method === 'hard' ? '(강제)' : '(가이드)'}</h3>
          <p className="text-[11px] text-fg-subtlest">내 조직장 리뷰 {totalAssigned}건 중 {withRating.length}건 작성 완료</p>
        </div>
      </div>
      <div className="space-y-2">
        {policy.bands.map(band => {
          const target = Math.round((band.ratio / 100) * totalAssigned);
          const current = usage[band.label] ?? 0;
          const over = policy.method === 'hard' && current > target;
          const pct = totalAssigned === 0 ? 0 : Math.min(100, (current / totalAssigned) * 100);
          const targetPct = band.ratio;
          return (
            <div key={band.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-gray-080">{band.label}</span>
                <span className={cn('tabular-nums', over ? 'text-red-060' : 'text-fg-subtle')}>
                  {current}/{target}명 <span className="opacity-60">(목표 {targetPct}%)</span>
                  {over && <span className="ml-1 font-semibold text-red-060">초과</span>}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-gray-010 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', over ? 'bg-red-050' : 'bg-pink-040')}
                  style={{ width: `${pct}%` }}
                />
                {/* 목표 라인 */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-030"
                  style={{ left: `${targetPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * hard 모드에서 submit 전에 validation. violations (초과된 band 목록) 반환.
 */
export function validateDistribution(
  policy: DistributionPolicy,
  cycleId: string,
  reviewerId: string,
  submissions: ReviewSubmission[],
): string[] {
  if (policy.method !== 'hard') return [];
  const myDownwards = submissions.filter(s =>
    s.cycleId === cycleId && s.type === 'downward' && s.reviewerId === reviewerId && s.overallRating != null
  );
  const totalAssigned = submissions.filter(s =>
    s.cycleId === cycleId && s.type === 'downward' && s.reviewerId === reviewerId
  ).length;
  const usage: Record<string, number> = {};
  for (const sub of myDownwards) {
    const band = bandForRating(policy.bands, sub.overallRating!);
    if (band) usage[band.label] = (usage[band.label] ?? 0) + 1;
  }
  const violations: string[] = [];
  for (const band of policy.bands) {
    const target = Math.round((band.ratio / 100) * totalAssigned);
    const current = usage[band.label] ?? 0;
    if (current > target) violations.push(`${band.label} 등급 ${current}/${target}명 초과`);
  }
  return violations;
}
