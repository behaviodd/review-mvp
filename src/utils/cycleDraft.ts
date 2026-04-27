import type {
  AnonymityPolicy, AutoAdvanceRule, CycleTargetMode, ReferenceInfoPolicy, ReminderRule,
  ReviewCycle, VisibilityPolicy,
} from '../types';

export interface WizardFormShape {
  title: string;
  type: 'scheduled' | 'adhoc';
  templateId: string;
  targetDepartments: string[];
  targetSubOrgs: string[];
  targetTeams: string[];
  targetSquads: string[];
  selfReviewDeadline: string;
  managerReviewDeadline: string;
  calibrationDeadline: string;
  tags: string[];
  fromCycleId?: string;
  targetMode: CycleTargetMode;
  targetManagerId?: string;
  targetUserIds?: string[];
  scheduledPublishAt?: string;
  autoAdvance?: AutoAdvanceRule;
  reminderPolicy?: ReminderRule[];
  anonymity?: AnonymityPolicy;
  visibility?: VisibilityPolicy;
  referenceInfo?: ReferenceInfoPolicy;
  // R3
  downwardReviewerRanks?: number[];
  // R4: 인사정보 적용 방식 (기본 'snapshot')
  hrSnapshotMode?: 'live' | 'snapshot';
}

function toYmd(iso?: string): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/**
 * 마법사 Form → ReviewCycle patch. draft 저장용.
 */
export function formToCyclePatch(form: WizardFormShape): Partial<ReviewCycle> {
  return {
    title: form.title,
    type: form.type,
    templateId: form.templateId,
    targetDepartments: form.targetDepartments,
    selfReviewDeadline: form.selfReviewDeadline
      ? new Date(form.selfReviewDeadline).toISOString()
      : '',
    managerReviewDeadline: form.managerReviewDeadline
      ? new Date(form.managerReviewDeadline).toISOString()
      : '',
    tags: form.tags,
    fromCycleId: form.fromCycleId,
    targetMode: form.targetMode,
    targetManagerId: form.targetManagerId,
    targetUserIds: form.targetUserIds,
    scheduledPublishAt: form.scheduledPublishAt,
    autoAdvance: form.autoAdvance,
    reminderPolicy: form.reminderPolicy,
    anonymity: form.anonymity,
    visibility: form.visibility,
    referenceInfo: form.referenceInfo,
    downwardReviewerRanks: form.downwardReviewerRanks,
    hrSnapshotMode: form.hrSnapshotMode,
  };
}

/**
 * 기존 draft ReviewCycle → 마법사 FormShape. 복원용.
 */
export function cycleToForm(cycle: ReviewCycle, fallbackCalibration: string): WizardFormShape {
  return {
    title: cycle.title,
    type: cycle.type,
    templateId: cycle.templateId,
    targetDepartments: [...cycle.targetDepartments],
    targetSubOrgs: [],
    targetTeams: [],
    targetSquads: [],
    selfReviewDeadline: toYmd(cycle.selfReviewDeadline),
    managerReviewDeadline: toYmd(cycle.managerReviewDeadline),
    calibrationDeadline: fallbackCalibration,
    tags: [...(cycle.tags ?? [])],
    fromCycleId: cycle.fromCycleId,
    targetMode: cycle.targetMode ?? 'org',
    targetManagerId: cycle.targetManagerId,
    targetUserIds: cycle.targetUserIds ? [...cycle.targetUserIds] : undefined,
    scheduledPublishAt: cycle.scheduledPublishAt,
    autoAdvance: cycle.autoAdvance,
    reminderPolicy: cycle.reminderPolicy,
    anonymity: cycle.anonymity,
    visibility: cycle.visibility,
    referenceInfo: cycle.referenceInfo,
    downwardReviewerRanks: cycle.downwardReviewerRanks ? [...cycle.downwardReviewerRanks] : undefined,
    hrSnapshotMode: cycle.hrSnapshotMode,
  };
}
