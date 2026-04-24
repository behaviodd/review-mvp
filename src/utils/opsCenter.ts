import { daysUntil } from './dateUtils';
import { getSmallestOrg } from './userUtils';
import type {
  ReviewCycle,
  ReviewKind,
  ReviewSubmission,
  SubmissionStatus,
  User,
} from '../types';

export type OpsPerspective = 'reviewee' | 'reviewer';
/** Phase 3.3b-1: 'manager' 는 호환용(= downward). stage 4종 추가 */
export type OpsStage = 'all' | 'self' | 'manager' | 'downward' | 'peer' | 'upward';

export interface OpsFilters {
  perspective: OpsPerspective;
  stage: OpsStage;
  org: string | null;
  statuses: SubmissionStatus[];
  onlyOverdue: boolean;
  query: string;
}

export interface OpsStageSummary {
  status: SubmissionStatus;
  overdue: boolean;
  total: number;
  submitted: number;
  submissionIds: string[];
  overrideUntil?: string;
}

export interface OpsRow {
  key: string;
  user: User;
  orgPath: string;
  self?: OpsStageSummary;
  manager?: OpsStageSummary;   // = downward. 하위호환
  peer?: OpsStageSummary;
  upward?: OpsStageSummary;
  allSubmissionIds: string[];
  lastSavedAt?: string;
}

export interface OpsKpis {
  totalPeople: number;
  selfRate: number;
  managerRate: number;   // = downward
  peerRate: number;
  upwardRate: number;
  overallRate: number;
  notStarted: number;
  overdue: number;
  dDayLabel: string;
  dDayDays: number | null;
  remindersLast7d: number;
  hasPeer: boolean;
  hasUpward: boolean;
}

const AGGREGATE_ORDER: SubmissionStatus[] = ['not_started', 'in_progress', 'submitted'];

export const DEFAULT_FILTERS: OpsFilters = {
  perspective: 'reviewee',
  stage: 'all',
  org: null,
  statuses: [],
  onlyOverdue: false,
  query: '',
};

function stageDeadline(cycle: ReviewCycle, kind: ReviewKind): string {
  // peer / upward는 자기평가·조직장 마감을 상속 (3.3b-1 단순화).
  // peer: selfReview 기간 내 또는 manager_review 기간 내로 확장 가능; 현재는 managerReviewDeadline 사용.
  if (kind === 'self') return cycle.selfReviewDeadline;
  return cycle.managerReviewDeadline;
}

export function getStageDeadline(cycle: ReviewCycle, stage: OpsStage): string {
  if (stage === 'self') return cycle.selfReviewDeadline;
  return cycle.managerReviewDeadline;
}

export function getActiveStage(cycle: ReviewCycle): 'self' | 'manager' {
  return cycle.status === 'manager_review' ? 'manager' : 'self';
}

function effectiveDeadline(sub: ReviewSubmission, baseDeadline: string): string {
  return sub.deadlineOverride?.until ?? baseDeadline;
}

function isOverdue(sub: ReviewSubmission, baseDeadline: string): boolean {
  if (sub.status === 'submitted') return false;
  return daysUntil(effectiveDeadline(sub, baseDeadline)) < 0;
}

function aggregateStatus(subs: ReviewSubmission[]): SubmissionStatus {
  if (subs.length === 0) return 'not_started';
  if (subs.every(s => s.status === 'submitted')) return 'submitted';
  if (subs.some(s => s.status !== 'not_started')) return 'in_progress';
  return 'not_started';
}

function summarize(subs: ReviewSubmission[], deadline: string): OpsStageSummary {
  const submitted = subs.filter(s => s.status === 'submitted').length;
  const overdue = subs.some(s => isOverdue(s, deadline));
  const overrideUntils = subs
    .map(s => s.deadlineOverride?.until)
    .filter((u): u is string => typeof u === 'string')
    .sort();
  return {
    status: aggregateStatus(subs),
    overdue,
    total: subs.length,
    submitted,
    submissionIds: subs.map(s => s.id),
    overrideUntil: overrideUntils.length ? overrideUntils[overrideUntils.length - 1] : undefined,
  };
}

function latestSavedAt(subs: ReviewSubmission[]): string | undefined {
  return subs.reduce<string | undefined>((acc, s) => {
    if (!s.lastSavedAt) return acc;
    if (!acc || s.lastSavedAt > acc) return s.lastSavedAt;
    return acc;
  }, undefined);
}

export function buildOpsRows(
  cycle: ReviewCycle,
  submissions: ReviewSubmission[],
  users: User[],
  perspective: OpsPerspective,
): OpsRow[] {
  const cycleSubs = submissions.filter(s => s.cycleId === cycle.id);
  const userMap = new Map(users.map(u => [u.id, u]));

  const groupKey = (s: ReviewSubmission) =>
    perspective === 'reviewee' ? s.revieweeId : s.reviewerId;

  const grouped = new Map<string, ReviewSubmission[]>();
  for (const sub of cycleSubs) {
    const key = groupKey(sub);
    const arr = grouped.get(key);
    if (arr) arr.push(sub);
    else grouped.set(key, [sub]);
  }

  const rows: OpsRow[] = [];
  for (const [personId, subs] of grouped) {
    const user = userMap.get(personId);
    if (!user) continue;
    const byKind: Record<ReviewKind, ReviewSubmission[]> = {
      self: [], downward: [], peer: [], upward: [],
    };
    for (const s of subs) byKind[s.type].push(s);

    rows.push({
      key: `${perspective}:${personId}`,
      user,
      orgPath: getSmallestOrg(user),
      self: byKind.self.length ? summarize(byKind.self, stageDeadline(cycle, 'self')) : undefined,
      manager: byKind.downward.length ? summarize(byKind.downward, stageDeadline(cycle, 'downward')) : undefined,
      peer: byKind.peer.length ? summarize(byKind.peer, stageDeadline(cycle, 'peer')) : undefined,
      upward: byKind.upward.length ? summarize(byKind.upward, stageDeadline(cycle, 'upward')) : undefined,
      allSubmissionIds: subs.map(s => s.id),
      lastSavedAt: latestSavedAt(subs),
    });
  }

  return rows.sort((a, b) => a.user.name.localeCompare(b.user.name, 'ko'));
}

function pickStageSummary(row: OpsRow, stage: OpsStage): OpsStageSummary | undefined {
  if (stage === 'self') return row.self;
  if (stage === 'manager' || stage === 'downward') return row.manager;
  if (stage === 'peer') return row.peer;
  if (stage === 'upward') return row.upward;
  return undefined;
}

function stageMatchesFilters(summary: OpsStageSummary | undefined, filters: OpsFilters): boolean {
  if (!summary) return false;
  if (filters.statuses.length && !filters.statuses.includes(summary.status)) return false;
  if (filters.onlyOverdue && !summary.overdue) return false;
  return true;
}

export function applyFilters(rows: OpsRow[], filters: OpsFilters): OpsRow[] {
  const q = filters.query.trim().toLowerCase();
  return rows.filter(row => {
    if (filters.org && row.orgPath !== filters.org) return false;
    if (q) {
      const hay = `${row.user.name} ${row.user.email} ${row.orgPath}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (filters.stage !== 'all') {
      return stageMatchesFilters(pickStageSummary(row, filters.stage), filters);
    }

    if (filters.statuses.length || filters.onlyOverdue) {
      return (
        stageMatchesFilters(row.self, filters) ||
        stageMatchesFilters(row.manager, filters) ||
        stageMatchesFilters(row.peer, filters) ||
        stageMatchesFilters(row.upward, filters)
      );
    }
    return true;
  });
}

export function rowSubmissionIdsForStage(row: OpsRow, stage: OpsStage): string[] {
  const s = pickStageSummary(row, stage);
  if (s) return s.submissionIds;
  return row.allSubmissionIds;
}

export function collectPendingSubmissionIds(
  rows: OpsRow[],
  submissions: ReviewSubmission[],
  stage: OpsStage,
): string[] {
  const wanted = new Set<string>();
  for (const row of rows) {
    for (const id of rowSubmissionIdsForStage(row, stage)) wanted.add(id);
  }
  return submissions
    .filter(s => wanted.has(s.id) && s.status !== 'submitted')
    .map(s => s.id);
}

export function computeKpis(
  cycle: ReviewCycle,
  submissions: ReviewSubmission[],
): OpsKpis {
  const cycleSubs = submissions.filter(s => s.cycleId === cycle.id);
  const byKind = (k: ReviewKind) => cycleSubs.filter(s => s.type === k);
  const selfSubs = byKind('self');
  const managerSubs = byKind('downward');
  const peerSubs = byKind('peer');
  const upwardSubs = byKind('upward');

  const rate = (list: ReviewSubmission[]) =>
    list.length === 0 ? 0 : Math.round((list.filter(s => s.status === 'submitted').length / list.length) * 100);

  const overdue = cycleSubs.filter(s => isOverdue(s, stageDeadline(cycle, s.type))).length;
  const notStarted = cycleSubs.filter(s => s.status === 'not_started').length;

  const activeStage = getActiveStage(cycle);
  const activeDeadline = getStageDeadline(cycle, activeStage);
  const dDayDays = cycle.status === 'closed' ? null : daysUntil(activeDeadline);
  const dDayLabel = dDayDays === null
    ? '종료'
    : dDayDays < 0 ? '마감'
    : dDayDays === 0 ? 'D-Day'
    : `D-${dDayDays}`;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const remindersLast7d = cycleSubs.reduce(
    (acc, s) => acc + (s.remindersSent?.filter(r => r.at >= weekAgo).length ?? 0),
    0,
  );

  return {
    totalPeople: new Set(cycleSubs.map(s => s.revieweeId)).size,
    selfRate: rate(selfSubs),
    managerRate: rate(managerSubs),
    peerRate: rate(peerSubs),
    upwardRate: rate(upwardSubs),
    overallRate: rate(cycleSubs),
    notStarted,
    overdue,
    dDayLabel,
    dDayDays,
    remindersLast7d,
    hasPeer: peerSubs.length > 0,
    hasUpward: upwardSubs.length > 0,
  };
}

export function listOrgsFromRows(rows: OpsRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.orgPath);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
}

export const AGGREGATE_STATUS_ORDER = AGGREGATE_ORDER;
