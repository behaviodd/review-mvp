import type { OrgUnit, ReviewCycle, ReviewTemplate, ReviewerAssignment, User } from '../types';
import { resolveTargetMembers, resolveTargetIds } from './resolveTargets';
import { isUserActive, shouldAutoExcludeFromCycle } from './userCompat';

export type PreflightSeverity = 'block' | 'warn';

export interface PreflightCheck {
  id: string;
  severity: PreflightSeverity;
  title: string;
  detail: string;
  affectedIds?: string[];  // userId 또는 cycleId 등
}

export interface PreflightResult {
  checks: PreflightCheck[];
  blocked: boolean;
  warnings: number;
}

function isWeekend(iso: string): boolean {
  const d = new Date(iso).getDay();
  return d === 0 || d === 6;
}

/**
 * R3: 차수별 평가권자 결정 (preflight 전용).
 * - rank=1 일 때만 legacy fallback (managerId / orgUnit head / dept name)
 * - rank≥2 는 명시적 ReviewerAssignment 만 인정
 * - 비활성 사용자는 제외
 */
function resolveReviewerByRankForPreflight(
  member: User,
  rank: number,
  allUsers: User[],
  orgUnits: OrgUnit[],
  assignments?: ReviewerAssignment[],
): User | undefined {
  // 1) ReviewerAssignment(rank=N) 활성
  if (assignments) {
    const ra = assignments.find(a =>
      a.revieweeId === member.id && a.rank === rank && !a.endDate
    );
    if (ra) {
      const reviewer = allUsers.find(u => u.id === ra.reviewerId);
      if (reviewer && isUserActive(reviewer)) return reviewer;
    }
  }

  if (rank !== 1) return undefined; // 2차 이상은 명시적 배정만

  // 2) legacy: managerId
  let mgr = allUsers.find(u => u.id === member.managerId);
  if (mgr && isUserActive(mgr)) return mgr;

  // 3) orgUnitId 트리에서 headId
  let cursor = orgUnits.find(o => o.id === member.orgUnitId);
  while (cursor) {
    if (cursor.headId && cursor.headId !== member.id) {
      const head = allUsers.find(u => u.id === cursor!.headId);
      if (head && isUserActive(head)) return head;
    }
    cursor = cursor.parentId ? orgUnits.find(o => o.id === cursor!.parentId) : undefined;
  }

  // 4) legacy: 부서명 매칭
  const memberOrg = orgUnits.find(o =>
    o.headId &&
    o.headId !== member.id &&
    (o.name === member.department ||
     o.name === member.subOrg ||
     o.name === member.team ||
     o.name === member.squad)
  );
  if (memberOrg?.headId) {
    mgr = allUsers.find(u => u.id === memberOrg.headId);
    if (mgr && isUserActive(mgr)) return mgr;
  }
  return undefined;
}

/**
 * 사이클 발행 전 체크. 체크 7종.
 */
export function runPreflight(params: {
  cycle: ReviewCycle;
  allCycles: ReviewCycle[];
  users: User[];
  orgUnits: OrgUnit[];
  template: ReviewTemplate | undefined;
  assignments?: ReviewerAssignment[];
}): PreflightResult {
  const { cycle, allCycles, users, orgUnits, template, assignments } = params;
  const checks: PreflightCheck[] = [];

  const targetMembers = resolveTargetMembers(cycle, users);
  const today = new Date().toISOString().slice(0, 10);

  // 1. 비활성/퇴사 분리 — R1: shouldAutoExcludeFromCycle 사용 (terminated/leave_long)
  const inactive = targetMembers.filter(u =>
    shouldAutoExcludeFromCycle(u) || (u.leaveDate && u.leaveDate <= today)
  );
  if (inactive.length > 0) {
    checks.push({
      id: 'inactive_targets',
      severity: 'warn',
      title: '대상자 중 비활성/퇴사 예정자 포함',
      detail: `${inactive.length}명이 퇴사 또는 장기휴직 상태입니다. 발행 시 자동 제외되지 않으므로 수동으로 대상에서 빼주세요.`,
      affectedIds: inactive.map(u => u.id),
    });
  }

  // 2. 매니저 미배정 (경고) — R3: cycle.downwardReviewerRanks 의 모든 차수에 대해 체크
  // 해당 차수 reviewer 가 없는 멤버는 createCycleSubmissions 가 graceful skip → self 등 다른 종류만 생성됨
  const activeMembers = targetMembers.filter(u => !inactive.includes(u));
  const ranks = cycle.downwardReviewerRanks && cycle.downwardReviewerRanks.length > 0
    ? cycle.downwardReviewerRanks
    : [1];
  const includesDownward = !cycle.reviewKinds || cycle.reviewKinds.includes('downward');
  if (includesDownward) {
    for (const rank of ranks) {
      const missing = activeMembers.filter(u => !resolveReviewerByRankForPreflight(u, rank, users, orgUnits, assignments));
      if (missing.length > 0) {
        const rankLabel = rank === 1 ? '1차(직속)' : `${rank}차`;
        checks.push({
          id: `missing_reviewer_rank_${rank}`,
          severity: 'warn',
          title: `${rankLabel} 평가권자가 없는 대상자 존재`,
          detail: `${missing.length}명에게 ${rankLabel} 평가권자가 배정되지 않았습니다. 해당 멤버는 ${rankLabel} 조직장 리뷰가 생성되지 않습니다 (자기평가 등 다른 종류는 정상 생성).`,
          affectedIds: missing.map(u => u.id),
        });
      }
    }
  }

  // 3. 템플릿 유효성
  if (!template) {
    checks.push({
      id: 'template_missing',
      severity: 'block',
      title: '템플릿을 찾을 수 없습니다.',
      detail: '선택된 템플릿이 삭제되었거나 접근할 수 없습니다.',
    });
  } else {
    const noQuestions = template.questions.length === 0;
    const unlinked = template.sections && template.sections.length > 0
      ? template.questions.filter(q => !q.sectionId).length
      : 0;
    if (noQuestions) {
      checks.push({
        id: 'template_empty',
        severity: 'block',
        title: '템플릿에 질문이 없습니다.',
        detail: '템플릿에 최소 1개 이상의 질문이 필요합니다.',
      });
    }
    if (unlinked > 0) {
      checks.push({
        id: 'template_section_unlinked',
        severity: 'warn',
        title: '섹션에 연결되지 않은 질문 존재',
        detail: `${unlinked}개의 질문이 섹션에 속하지 않았습니다. 작성 화면에서 fallback 섹션으로 표시됩니다.`,
      });
    }
  }

  // 4. 일정 논리
  const sd = cycle.selfReviewDeadline;
  const md = cycle.managerReviewDeadline;
  if (sd && md && new Date(sd) >= new Date(md)) {
    checks.push({
      id: 'schedule_order',
      severity: 'block',
      title: '일정 순서 오류',
      detail: `자기평가 마감(${sd})이 조직장 리뷰 마감(${md})과 같거나 이후입니다.`,
    });
  }
  if (sd && new Date(sd) < new Date(today)) {
    checks.push({
      id: 'schedule_past',
      severity: 'block',
      title: '자기평가 마감이 과거 날짜',
      detail: `${sd}는 오늘 이전입니다. 미래 날짜로 수정하세요.`,
    });
  }

  // 5. 주말/공휴일 (경고)
  if (sd && isWeekend(sd)) {
    checks.push({
      id: 'weekend_self',
      severity: 'warn',
      title: '자기평가 마감이 주말',
      detail: `${sd}는 주말입니다. 제출율 저하 가능성.`,
    });
  }
  if (md && isWeekend(md)) {
    checks.push({
      id: 'weekend_manager',
      severity: 'warn',
      title: '조직장 리뷰 마감이 주말',
      detail: `${md}는 주말입니다.`,
    });
  }

  // 6. 진행중 사이클과 대상 중복
  const myTargetIds = resolveTargetIds(cycle, users);
  const activeOthers = allCycles.filter(c =>
    c.id !== cycle.id &&
    !c.archivedAt &&
    c.status !== 'closed' && c.status !== 'draft'
  );
  if (activeOthers.length > 0) {
    const overlapIds = new Set<string>();
    const relevantOthers: string[] = [];
    for (const other of activeOthers) {
      const otherIds = resolveTargetIds(other, users);
      let overlapped = false;
      for (const id of myTargetIds) {
        if (otherIds.has(id)) {
          overlapIds.add(id);
          overlapped = true;
        }
      }
      if (overlapped) relevantOthers.push(other.title);
    }
    if (overlapIds.size > 0) {
      checks.push({
        id: 'target_overlap',
        severity: 'warn',
        title: '다른 진행중 사이클과 대상자 겹침',
        detail: `${overlapIds.size}명이 동시에 "${relevantOthers.join(', ')}" 과(와) 겹칩니다.`,
        affectedIds: Array.from(overlapIds),
      });
    }
  }

  // 7. 원본 템플릿 변경 (복제 모드일 때)
  if (cycle.fromCycleId && template) {
    const origin = allCycles.find(c => c.id === cycle.fromCycleId);
    if (origin?.templateSnapshot) {
      const originHash = JSON.stringify(origin.templateSnapshot.questions);
      const currentHash = JSON.stringify(template.questions);
      if (originHash !== currentHash) {
        checks.push({
          id: 'origin_template_changed',
          severity: 'warn',
          title: '복제 원본 이후 템플릿이 변경되었습니다.',
          detail: `"${origin.title}"의 스냅샷과 현재 템플릿 질문이 다릅니다. 이대로 발행하면 새 템플릿으로 고정됩니다.`,
        });
      }
    }
  }

  const blocked = checks.some(c => c.severity === 'block');
  const warnings = checks.filter(c => c.severity === 'warn').length;
  return { checks, blocked, warnings };
}
