import type { User, ReviewSubmission, OrgUnit } from '../types';

function makeId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * 리뷰 사이클 발행 시 자기평가 + 하향평가 제출 레코드를 일괄 생성
 *
 * - admin을 제외한 대상 구성원 → 자기평가(self) 1건
 * - 각 구성원의 조직장(managerId 우선, 없으면 orgUnit.headId 폴백)이 있고 admin이 아닌 경우 → 하향평가(downward) 1건
 */
export function createCycleSubmissions(
  cycleId: string,
  targetMembers: User[],
  allUsers: User[],
  orgUnits: OrgUnit[] = [],
): ReviewSubmission[] {
  const now = new Date().toISOString();
  const submissions: ReviewSubmission[] = [];

  for (const member of targetMembers) {
    // admin은 셀프리뷰 대상에서 제외
    if (member.role === 'admin') continue;

    // 자기평가
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

    // 하향평가 — managerId 우선, 없으면 orgUnit headId 폴백
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
      if (memberOrg?.headId) {
        manager = allUsers.find(u => u.id === memberOrg.headId);
      }
    }
    if (!manager || manager.role === 'admin') continue;

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

  return submissions;
}
