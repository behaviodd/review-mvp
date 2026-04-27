import type { OrgUnit, ReviewCycle, ReviewKind, ReviewSubmission, ReviewerAssignment, User } from '../types';

function makeId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * R1: 평가자 결정.
 * 1순위: ReviewerAssignment(rank=1, 활성) — useTeamStore.reviewerAssignments
 *        호출자가 assignments 를 전달하면 우선 사용.
 * 2순위: user.managerId (legacy)
 * 3순위: orgUnitId 또는 legacy 4단계 텍스트와 매칭되는 OrgUnit.headId
 *
 * R3 에서 `assignments` 를 필수 인자로 승격하고 2~3 순위 제거 예정.
 */
function resolveManager(
  member: User,
  allUsers: User[],
  orgUnits: OrgUnit[],
  assignments?: ReviewerAssignment[],
): User | undefined {
  // 1) ReviewerAssignment (rank=1) 활성 항목
  if (assignments) {
    const ra = assignments.find(a =>
      a.revieweeId === member.id && a.rank === 1 && !a.endDate
    );
    if (ra) {
      const reviewer = allUsers.find(u => u.id === ra.reviewerId);
      if (reviewer && reviewer.role !== 'admin') return reviewer;
    }
  }

  // 2) legacy: user.managerId
  let manager = allUsers.find(u => u.id === member.managerId);

  // 3) orgUnitId 트리에서 headId 탐색
  if (!manager || manager.role === 'admin') {
    let cursor = orgUnits.find(o => o.id === member.orgUnitId);
    while (cursor) {
      if (cursor.headId && cursor.headId !== member.id) {
        const head = allUsers.find(u => u.id === cursor!.headId);
        if (head && head.role !== 'admin') {
          manager = head;
          break;
        }
      }
      cursor = cursor.parentId ? orgUnits.find(o => o.id === cursor!.parentId) : undefined;
    }
  }

  // 4) legacy: dept/subOrg/team/squad 이름 매칭 (마이그 전 데이터 호환)
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
  assignments?: ReviewerAssignment[],
): ReviewSubmission[] {
  const now = new Date().toISOString();
  const submissions: ReviewSubmission[] = [];
  const kinds: ReviewKind[] = cycle?.reviewKinds && cycle.reviewKinds.length > 0
    ? cycle.reviewKinds
    : ['self', 'downward'];
  const include = (k: ReviewKind) => kinds.includes(k);

  for (const member of targetMembers) {
    if (member.role === 'admin') continue;
    const manager = resolveManager(member, allUsers, orgUnits, assignments);

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
