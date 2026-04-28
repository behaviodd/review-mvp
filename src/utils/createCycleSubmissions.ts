import type { OrgUnit, ReviewCycle, ReviewKind, ReviewSubmission, ReviewerAssignment, User } from '../types';
import { isSystemOperator } from './permissions';

function makeId() {
  return `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * R3: 특정 차수의 평가권자를 결정.
 *
 * 우선순위:
 * 1) ReviewerAssignment(rank=N, 활성) — 명시적 배정
 * 2) rank === 1 인 경우 only: legacy fallback (managerId / orgUnit head)
 *    rank ≥ 2 는 명시적 배정만 인정 (legacy 데이터 없음)
 *
 * 반환: reviewer User 또는 undefined (배정 없음)
 */
function resolveReviewerByRank(
  member: User,
  rank: number,
  allUsers: User[],
  orgUnits: OrgUnit[],
  assignments: ReviewerAssignment[] | undefined,
): User | undefined {
  // 1) 명시적 ReviewerAssignment
  if (assignments) {
    const ra = assignments.find(a =>
      a.revieweeId === member.id && a.rank === rank && !a.endDate
    );
    if (ra) {
      const reviewer = allUsers.find(u => u.id === ra.reviewerId);
      if (reviewer && !isSystemOperator(reviewer)) return reviewer;
    }
  }

  // 2) rank=1 fallback (R1/R2 호환)
  if (rank !== 1) return undefined;

  // legacy: user.managerId
  let manager = allUsers.find(u => u.id === member.managerId);

  // orgUnitId 트리에서 headId 탐색
  if (!manager || isSystemOperator(manager)) {
    let cursor = orgUnits.find(o => o.id === member.orgUnitId);
    while (cursor) {
      if (cursor.headId && cursor.headId !== member.id) {
        const head = allUsers.find(u => u.id === cursor!.headId);
        if (head && !isSystemOperator(head)) {
          manager = head;
          break;
        }
      }
      cursor = cursor.parentId ? orgUnits.find(o => o.id === cursor!.parentId) : undefined;
    }
  }

  // legacy: dept/subOrg/team/squad 이름 매칭 (마이그 전 데이터 호환)
  if (!manager || isSystemOperator(manager)) {
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

  if (!manager || isSystemOperator(manager)) return undefined;
  return manager;
}

/**
 * 리뷰 사이클 발행 시 submission 레코드를 일괄 생성.
 *
 * R3 변경
 * - downward 평가는 cycle.downwardReviewerRanks 의 각 차수마다 1건씩 생성.
 * - 미설정 시 [1] 기본 (R1/R2 호환).
 * - 각 downward submission 에 reviewerRank 부여.
 * - upward 는 1차 매니저(rank=1)만 평가 대상.
 *
 * 사용 예
 * - 1차 매니저만 평가: downwardReviewerRanks=[1] (또는 미설정)
 * - 2차 매니저까지 평가: downwardReviewerRanks=[1, 2]
 * - 2차만 평가: downwardReviewerRanks=[2]
 */
export function createCycleSubmissions(
  cycleId: string,
  targetMembers: User[],
  allUsers: User[],
  orgUnits: OrgUnit[] = [],
  cycle?: Pick<ReviewCycle, 'reviewKinds' | 'downwardReviewerRanks'>,
  assignments?: ReviewerAssignment[],
): ReviewSubmission[] {
  const now = new Date().toISOString();
  const submissions: ReviewSubmission[] = [];
  const kinds: ReviewKind[] = cycle?.reviewKinds && cycle.reviewKinds.length > 0
    ? cycle.reviewKinds
    : ['self', 'downward'];
  const include = (k: ReviewKind) => kinds.includes(k);
  const ranks = cycle?.downwardReviewerRanks && cycle.downwardReviewerRanks.length > 0
    ? cycle.downwardReviewerRanks
    : [1];

  for (const member of targetMembers) {
    if (isSystemOperator(member)) continue;

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

    if (include('downward')) {
      // 차수별 1건씩 생성 (중복 reviewer 는 제거)
      const seen = new Set<string>();
      for (const rank of ranks) {
        const reviewer = resolveReviewerByRank(member, rank, allUsers, orgUnits, assignments);
        if (!reviewer) continue;
        if (seen.has(reviewer.id)) continue; // 1차/2차가 동일인이면 1건만
        seen.add(reviewer.id);
        submissions.push({
          id:          makeId(),
          cycleId,
          reviewerId:  reviewer.id,
          revieweeId:  member.id,
          type:        'downward',
          status:      'not_started',
          answers:     [],
          lastSavedAt: now,
          reviewerRank: rank,
        });
      }
    }

    if (include('upward')) {
      // upward 는 1차 매니저(rank=1)만 평가 대상
      const primaryManager = resolveReviewerByRank(member, 1, allUsers, orgUnits, assignments);
      if (primaryManager) {
        submissions.push({
          id:          makeId(),
          cycleId,
          reviewerId:  member.id,
          revieweeId:  primaryManager.id,
          type:        'upward',
          status:      'not_started',
          answers:     [],
          lastSavedAt: now,
        });
      }
    }

    // peer — 이 단계에선 생성하지 않음. admin/leader/reviewee가 이후에 배정.
  }

  return submissions;
}
