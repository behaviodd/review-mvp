import type { ReviewCycle } from '../types';

function addDaysToISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export interface ClonePrefill {
  title: string;
  type: 'scheduled' | 'adhoc';
  templateId: string;
  targetDepartments: string[];
  targetSubOrgs: string[];
  targetTeams: string[];
  targetSquads: string[];
  selfReviewDeadline: string;
  managerReviewDeadline: string;
  tags: string[];
  fromCycleId: string;
}

/**
 * 기존 사이클을 기준으로 CycleNew 폼의 초기값을 만든다.
 * 제목에 "(복제)" 접미, 일정은 일수 유지 + 기준일 오늘로 시프트.
 * targetSubOrgs/Teams/Squads는 원본에 없어 빈 배열로 둔다 (사용자가 재선택).
 */
export function buildClonePrefill(origin: ReviewCycle): ClonePrefill {
  const today = new Date().toISOString().slice(0, 10);
  const originSelf = origin.selfReviewDeadline;
  const originMgr = origin.managerReviewDeadline;
  const baseDate = origin.createdAt.slice(0, 10);

  const selfOffset = Math.max(7, daysBetween(baseDate, originSelf));
  const mgrOffset = Math.max(selfOffset + 3, daysBetween(baseDate, originMgr));

  return {
    title: `${origin.title} (복제)`,
    type: origin.type,
    templateId: origin.templateId,
    targetDepartments: [...origin.targetDepartments],
    targetSubOrgs: [],
    targetTeams: [],
    targetSquads: [],
    selfReviewDeadline: addDaysToISO(today, selfOffset),
    managerReviewDeadline: addDaysToISO(today, mgrOffset),
    tags: [...(origin.tags ?? [])],
    fromCycleId: origin.id,
  };
}
