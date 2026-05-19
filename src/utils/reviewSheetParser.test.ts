/**
 * P0 라운드 13 — parser/writer round-trip 회귀 방지.
 * cycleToRow → parseSheetCycle, submissionToRow → parseSheetSubmission 가 모든 필드를 보존하는지 검증.
 * 이번 라운드 fix 후 누락 필드들 (anonymity, visibility, peerSelection, distribution, reminderPolicy 등) 이
 * 폴링/새로고침 시 사라지지 않음을 보장.
 */
import { describe, it, expect } from 'vitest';
import { cycleToRow, submissionToRow } from './reviewSheetWriter';
import { parseSheetCycle, parseSheetSubmission } from './reviewSheetParser';
import type { ReviewCycle, ReviewSubmission, ReviewTemplate } from '../types';

const template: ReviewTemplate = {
  id: 'tpl_1',
  name: '테스트 템플릿',
  description: '설명',
  isDefault: false,
  createdBy: 'u_admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  questions: [
    { id: 'q1', text: '문항1', type: 'rating', target: 'self', isPrivate: false, isRequired: true, ratingScale: 5, order: 1 },
    { id: 'q2', text: '문항2', type: 'multiple_choice', target: 'both', isPrivate: false, isRequired: false, options: ['a', 'b', 'c'], allowMultiple: true, maxItems: 2, order: 2 },
  ],
  sections: [{ id: 'sec1', name: '섹션1', order: 1 }],
};

const fullCycle: ReviewCycle = {
  id: 'cyc_1',
  title: '2026 상반기',
  type: 'scheduled',
  status: 'self_review',
  templateId: 'tpl_1',
  targetDepartments: ['플랫폼', '운영'],
  selfReviewDeadline: '2026-06-30',
  managerReviewDeadline: '2026-07-15',
  createdBy: 'u_admin',
  createdAt: '2026-04-01T00:00:00.000Z',
  completionRate: 50,
  tags: ['정기', '핵심'],
  archivedAt: '2026-08-01T00:00:00.000Z',
  templateSnapshot: template,
  templateSnapshotAt: '2026-04-01T00:00:00.000Z',
  fromCycleId: 'cyc_0',
  folderId: 'folder_a',
  targetMode: 'custom',
  targetManagerId: 'u_mgr_1',
  targetUserIds: ['u_1', 'u_2', 'u_3'],
  scheduledPublishAt: '2026-05-01T00:00:00.000Z',
  autoAdvance: { stage: 'self_to_manager', graceHours: 24, threshold: 80 },
  reminderPolicy: [{ id: 'r1', trigger: 'before_deadline', audience: 'all_pending', stage: 'self', offsetHours: 24, enabled: true }],
  editLockedAt: '2026-09-01T00:00:00.000Z',
  autoArchived: true,
  closedAt: '2026-08-15T00:00:00.000Z',
  anonymity: { peer: true, upward: true, downward: false },
  visibility: { downwardToReviewee: 'submission' },
  referenceInfo: { includeGoals: true, includePreviousReview: true, cycleGoals: '리뷰 단위 공통 목표 텍스트' },
  reviewKinds: ['self', 'peer', 'downward'],
  peerSelection: { method: 'reviewee_picks', minPeers: 2, maxPeers: 5 },
  distribution: { method: 'hard', bands: [{ label: 'S', minRating: 4.5, ratio: 0.1 }] },
  hrSnapshotMode: 'snapshot',
  hrSnapshotId: 'snap_1',
  downwardReviewerRanks: [1, 2],
};

const fullSubmission: ReviewSubmission = {
  id: 'sub_1',
  cycleId: 'cyc_1',
  reviewerId: 'u_1',
  revieweeId: 'u_2',
  type: 'peer',
  status: 'in_progress',
  answers: [
    { questionId: 'q1', ratingValue: 4 },
    { questionId: 'q2', selectedOptions: ['a', 'b'] },
  ],
  overallRating: 4,
  submittedAt: '2026-05-10T00:00:00.000Z',
  lastSavedAt: '2026-05-09T00:00:00.000Z',
  remindersSent: [{ at: '2026-05-05T00:00:00.000Z', by: 'u_admin', channel: 'inapp', ruleId: 'r1' }],
  deadlineOverride: { until: '2026-07-01', by: 'u_admin', at: '2026-05-08T00:00:00.000Z', reason: '휴가' },
  proxyWrittenBy: 'u_admin',
  reviewerHistory: [{ from: 'u_old', to: 'u_1', at: '2026-04-15T00:00:00.000Z', by: 'u_admin', reason: '이동' }],
  autoExcluded: { at: '2026-05-01T00:00:00.000Z', reason: 'removed' },
  reviewerRank: 1,
  references: [{ id: 'ref_1', kind: 'link', title: '참고', url: 'https://example.com' }],
};

describe('parseSheetCycle round-trip', () => {
  it('preserves all writer-serialized fields', () => {
    const row = cycleToRow(fullCycle);
    const parsed = parseSheetCycle(row);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(fullCycle.id);
    expect(parsed!.title).toBe(fullCycle.title);
    expect(parsed!.tags).toEqual(fullCycle.tags);
    expect(parsed!.archivedAt).toBe(fullCycle.archivedAt);
    expect(parsed!.templateSnapshot).toEqual(fullCycle.templateSnapshot);
    expect(parsed!.fromCycleId).toBe(fullCycle.fromCycleId);
    expect(parsed!.folderId).toBe(fullCycle.folderId);
    expect(parsed!.targetMode).toBe(fullCycle.targetMode);
    expect(parsed!.targetManagerId).toBe(fullCycle.targetManagerId);
    expect(parsed!.targetUserIds).toEqual(fullCycle.targetUserIds);
    expect(parsed!.scheduledPublishAt).toBe(fullCycle.scheduledPublishAt);
    expect(parsed!.autoAdvance).toEqual(fullCycle.autoAdvance);
    expect(parsed!.reminderPolicy).toEqual(fullCycle.reminderPolicy);
    expect(parsed!.editLockedAt).toBe(fullCycle.editLockedAt);
    expect(parsed!.autoArchived).toBe(true);
    expect(parsed!.closedAt).toBe(fullCycle.closedAt);
    expect(parsed!.anonymity).toEqual(fullCycle.anonymity);
    expect(parsed!.visibility).toEqual(fullCycle.visibility);
    expect(parsed!.referenceInfo).toEqual(fullCycle.referenceInfo);
    expect(parsed!.reviewKinds).toEqual(fullCycle.reviewKinds);
    expect(parsed!.peerSelection).toEqual(fullCycle.peerSelection);
    expect(parsed!.distribution).toEqual(fullCycle.distribution);
    expect(parsed!.hrSnapshotMode).toBe(fullCycle.hrSnapshotMode);
    expect(parsed!.hrSnapshotId).toBe(fullCycle.hrSnapshotId);
    expect(parsed!.downwardReviewerRanks).toEqual(fullCycle.downwardReviewerRanks);
  });

  it('handles minimal cycle (only required fields)', () => {
    const minimal: ReviewCycle = {
      id: 'cyc_m', title: '최소', type: 'adhoc', status: 'draft', templateId: 'tpl_1',
      targetDepartments: [], selfReviewDeadline: '', managerReviewDeadline: '',
      createdBy: 'u', createdAt: '', completionRate: 0,
    };
    const parsed = parseSheetCycle(cycleToRow(minimal));
    expect(parsed!.id).toBe('cyc_m');
    expect(parsed!.tags).toBeUndefined();           // 빈 array join('') → '' → undefined
    expect(parsed!.autoArchived).toBeUndefined();   // false 면 '' 저장 → undefined
    // 정책 JSON 들은 writer 가 default {} / [] 직렬화 → round-trip 시 빈 객체/배열로 복원
    expect(parsed!.anonymity).toEqual({});
    expect(parsed!.visibility).toEqual({});
    expect(parsed!.referenceInfo).toEqual({});
    expect(parsed!.reminderPolicy).toEqual([]);
  });

  it('returns null for empty id', () => {
    expect(parseSheetCycle({ '사이클ID': '' })).toBeNull();
  });
});

describe('parseSheetSubmission round-trip', () => {
  it('preserves all writer-serialized fields', () => {
    const row = submissionToRow(fullSubmission);
    const parsed = parseSheetSubmission(row);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(fullSubmission.id);
    expect(parsed!.type).toBe('peer');
    expect(parsed!.answers).toEqual(fullSubmission.answers);
    expect(parsed!.remindersSent).toEqual(fullSubmission.remindersSent);
    expect(parsed!.deadlineOverride).toEqual(fullSubmission.deadlineOverride);
    expect(parsed!.proxyWrittenBy).toBe(fullSubmission.proxyWrittenBy);
    expect(parsed!.reviewerHistory).toEqual(fullSubmission.reviewerHistory);
    expect(parsed!.autoExcluded).toEqual(fullSubmission.autoExcluded);
    expect(parsed!.references).toEqual(fullSubmission.references);
    expect(parsed!.reviewerRank).toBe(1);
  });

  it('handles upward/peer types (not just self/downward)', () => {
    const upward: ReviewSubmission = { ...fullSubmission, id: 'sub_u', type: 'upward' };
    expect(parseSheetSubmission(submissionToRow(upward))!.type).toBe('upward');
  });
});
