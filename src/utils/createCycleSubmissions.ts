import type { OrgUnit, ReviewCycle, ReviewKind, ReviewSubmission, User } from '../types';

function makeId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function resolveManager(member: User, allUsers: User[], orgUnits: OrgUnit[]): User | undefined {
  let manager = allUsers.find(u => u.id === member.managerId);
  if (!manager || manager.role === 'admin') {
    const memberOrg = orgUnits.find(o =>
      o.headId &&
      o.headId !== member.id &&
      (o.name === member.department ||
       o.name === member.subOrg ||
       o.name === member.team ||
       o.name === member.squad)
    );
    if (memberOrg?.headId) manager = allUsers.find(u => u.id === memberOrg.headId);
  }
  if (!manager || manager.role === 'admin') return undefined;
  return manager;
}

/**
 * 리뷰 사이클 발행 시 submission 레코드를 일괄 생성.
 *
 * Phase 3.3b-1:
 *   - cycle.reviewKinds (없으면 ['self','downward'] 기본) 기준으로 각 유형별 생성.
 *   - self:     reviewer=reviewee=member 본인
 *   - downward: reviewer=manager, reviewee=member
 *   - upward:   reviewer=member, reviewee=manager (부하가 매니저를 평가)
 *   - peer:     생성하지 않음 — admin/leader/reviewee가 나중에 assignPeerReviewers로 배정
 *
 * 4번째 인자 cycle은 하위호환을 위해 optional. 없으면 기본 self+downward로 동작.
 */
export function createCycleSubmissions(
  cycleId: string,
  targetMembers: User[],
  allUsers: User[],
  orgUnits: OrgUnit[] = [],
  cycle?: Pick<ReviewCycle, 'reviewKinds'>,
): ReviewSubmission[] {
  const now = new Date().toISOString();
  const submissions: ReviewSubmission[] = [];
  const kinds: ReviewKind[] = cycle?.reviewKinds && cycle.reviewKinds.length > 0
    ? cycle.reviewKinds
    : ['self', 'downward'];
  const include = (k: ReviewKind) => kinds.includes(k);

  for (const member of targetMembers) {
    if (member.role === 'admin') continue;
    const manager = resolveManager(member, allUsers, orgUnits);

    if (include('self')) {
      submissions.push({
        id:          makeId(),
        cycleId,
        reviewerId:  member.id,
        revieweeId:  member.id,
        type:        'self',
        status:      'not_started',
        answers:     [],
        lastSavedAt: now,
      });
    }

    if (include('downward') && manager) {
      submissions.push({
        id:          makeId(),
        cycleId,
        reviewerId:  manager.id,
        revieweeId:  member.id,
        type:        'downward',
        status:      'not_started',
        answers:     [],
        lastSavedAt: now,
      });
    }

    if (include('upward') && manager) {
      submissions.push({
        id:          makeId(),
        cycleId,
        reviewerId:  member.id,
        revieweeId:  manager.id,
        type:        'upward',
        status:      'not_started',
        answers:     [],
        lastSavedAt: now,
      });
    }

    // peer — 이 단계에선 생성하지 않음. admin/leader/reviewee가 이후에 배정.
  }

  return submissions;
}
