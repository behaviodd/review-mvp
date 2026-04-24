/**
 * 앱 → Google Sheets 리뷰 데이터 쓰기 (경로 A)
 * /api/review-sync 프록시 경유 + 실패 큐 적재
 */
import type { ReviewCycle, ReviewTemplate, ReviewSubmission, AuditLogEntry } from '../types';
import { getScriptHeaders } from './scriptHeaders';
import { useSheetsSyncStore, type SyncOpKind } from '../stores/sheetsSyncStore';

const ACTION_BY_KIND: Record<SyncOpKind, string> = {
  'cycle.upsert':       'upsertCycle',
  'cycle.delete':       'deleteCycle',
  'template.upsert':    'upsertTemplate',
  'template.delete':    'deleteTemplate',
  'submission.upsert':  'upsertSubmission',
  'submission.delete':  'deleteSubmission',
  'audit.append':       'appendAudit',
};

export function opId(kind: SyncOpKind, targetId: string): string {
  return `${kind}:${targetId}`;
}

async function rawPost(action: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/review-sync', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
    body:    JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { ok?: boolean; error?: string };
  if (json.error) throw new Error(json.error);
}

async function postWithQueue(
  kind: SyncOpKind,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const store = useSheetsSyncStore.getState();
  const action = ACTION_BY_KIND[kind];
  const id = opId(kind, targetId);

  // 삭제 요청은 기존 upsert op 와 양립 불가 → 큐에서 정리
  if (kind.endsWith('.delete')) {
    const upsertKind = kind.replace('.delete', '.upsert') as SyncOpKind;
    store.removeOp(opId(upsertKind, targetId));
  }

  store.enqueueOp({ id, kind, action, targetId, payload });

  try {
    await rawPost(action, payload);
    store.markOpSuccess(id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    store.markOpFailure(id, msg);
    console.error(`[Sheet] ${action} failed:`, msg);
  }
}

/* ── 직렬화 ──────────────────────────────────────────────────────── */
export function cycleToRow(c: ReviewCycle): Record<string, unknown> {
  return {
    '사이클ID':       c.id,
    '제목':           c.title,
    '유형':           c.type === 'adhoc' ? '수시' : '정기',
    '상태':           c.status,
    '템플릿ID':       c.templateId,
    '대상부서':       c.targetDepartments.join(','),
    '자기평가마감':    c.selfReviewDeadline,
    '매니저평가마감':  c.managerReviewDeadline,
    '생성자ID':       c.createdBy,
    '생성일시':       c.createdAt,
    '완료율':         c.completionRate,
    '태그':           (c.tags ?? []).join(','),
    '보관일시':       c.archivedAt ?? '',
    '템플릿스냅샷JSON': c.templateSnapshot ? JSON.stringify(c.templateSnapshot) : '',
    '템플릿스냅샷일시': c.templateSnapshotAt ?? '',
    '복제원본ID':     c.fromCycleId ?? '',
    // Phase 3.2a
    '폴더ID':         c.folderId ?? '',
    '대상모드':       c.targetMode ?? 'org',
    '대상매니저ID':   c.targetManagerId ?? '',
    '대상사용자IDS': (c.targetUserIds ?? []).join(','),
    // Phase 3.2b
    '예약발행일시':   c.scheduledPublishAt ?? '',
    '자동전환JSON':   c.autoAdvance ? JSON.stringify(c.autoAdvance) : '',
    '알림정책JSON':   JSON.stringify(c.reminderPolicy ?? []),
    '편집잠금일시':   c.editLockedAt ?? '',
    '자동보관플래그': c.autoArchived ? 'true' : '',
    '종료일시':       c.closedAt ?? '',
    // Phase 3.3a
    '익명정책JSON':   JSON.stringify(c.anonymity ?? {}),
    '공개정책JSON':   JSON.stringify(c.visibility ?? {}),
    '참고정보JSON':   JSON.stringify(c.referenceInfo ?? {}),
    // Phase 3.3b-1
    '리뷰유형':       (c.reviewKinds ?? ['self', 'downward']).join(','),
    '동료선택정책JSON': c.peerSelection ? JSON.stringify(c.peerSelection) : '',
    // Phase 3.3c-2
    '분포정책JSON':   c.distribution ? JSON.stringify(c.distribution) : '',
  };
}

export function templateToRow(t: ReviewTemplate): Record<string, unknown> {
  return {
    '템플릿ID':  t.id,
    '이름':      t.name,
    '설명':      t.description,
    '기본템플릿': t.isDefault ? 'true' : 'false',
    '생성자ID':  t.createdBy,
    '생성일시':  t.createdAt,
    '질문JSON':  JSON.stringify(t.questions),
  };
}

export function submissionToRow(s: ReviewSubmission): Record<string, unknown> {
  return {
    '제출ID':     s.id,
    '사이클ID':   s.cycleId,
    '평가자ID':   s.reviewerId,
    '평가대상ID': s.revieweeId,
    '유형':       s.type,
    '상태':       s.status,
    '종합점수':   s.overallRating ?? '',
    '제출일시':   s.submittedAt ?? '',
    '최종저장일시': s.lastSavedAt,
    '답변JSON':   JSON.stringify(s.answers),
    '리마인드JSON': JSON.stringify(s.remindersSent ?? []),
    '연장기한JSON': s.deadlineOverride ? JSON.stringify(s.deadlineOverride) : '',
    '대리작성자':   s.proxyWrittenBy ?? '',
    '작성자이력JSON': JSON.stringify(s.reviewerHistory ?? []),
    // Phase 3.2a
    '자동제외JSON': s.autoExcluded ? JSON.stringify(s.autoExcluded) : '',
  };
}

/* ── 공개 API ────────────────────────────────────────────────────── */
export const cycleWriter = {
  upsert: (cycle: ReviewCycle) =>
    postWithQueue('cycle.upsert', cycle.id, cycleToRow(cycle)),
  delete: (id: string) =>
    postWithQueue('cycle.delete', id, { '사이클ID': id }),
};

export const templateWriter = {
  upsert: (template: ReviewTemplate) =>
    postWithQueue('template.upsert', template.id, templateToRow(template)),
  delete: (id: string) =>
    postWithQueue('template.delete', id, { '템플릿ID': id }),
};

export const submissionWriter = {
  upsert: (submission: ReviewSubmission) =>
    postWithQueue('submission.upsert', submission.id, submissionToRow(submission)),
  delete: (id: string) =>
    postWithQueue('submission.delete', id, { '제출ID': id }),
};

export function auditToRow(e: AuditLogEntry): Record<string, unknown> {
  return {
    '로그ID':     e.id,
    '사이클ID':   e.cycleId,
    '발생자ID':   e.actorId,
    '액션':       e.action,
    '대상IDS':    e.targetIds.join(','),
    '요약':       e.summary,
    '메타JSON':   JSON.stringify(e.meta ?? {}),
    '발생일시':   e.at,
  };
}

export const auditWriter = {
  append: (entry: AuditLogEntry) =>
    postWithQueue('audit.append', entry.id, auditToRow(entry)),
};

// 재시도 전용 (큐 재처리 시 사용)
export async function retryRawPost(action: string, payload: Record<string, unknown>): Promise<void> {
  return rawPost(action, payload);
}
