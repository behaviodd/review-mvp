/**
 * 앱 → Google Sheets 리뷰 데이터 쓰기
 * /api/review-sync 프록시 경유
 */
import type { ReviewCycle, ReviewTemplate, ReviewSubmission } from '../types';
import { getScriptHeaders } from './scriptHeaders';

async function post(action: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/review-sync', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
    body:    JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as { ok?: boolean; error?: string };
  if (json.error) throw new Error(json.error);
}

/* ── 직렬화 ──────────────────────────────────────────────────────── */
function cycleToRow(c: ReviewCycle): Record<string, unknown> {
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
  };
}

function templateToRow(t: ReviewTemplate): Record<string, unknown> {
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

function submissionToRow(s: ReviewSubmission): Record<string, unknown> {
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
  };
}

/* ── 공개 API ────────────────────────────────────────────────────── */
export const cycleWriter = {
  upsert: (cycle: ReviewCycle) =>
    post('upsertCycle', cycleToRow(cycle))
      .catch(e => console.error('[Sheet] cycle upsert:', e)),
};

export const templateWriter = {
  upsert: (template: ReviewTemplate) =>
    post('upsertTemplate', templateToRow(template))
      .catch(e => console.error('[Sheet] template upsert:', e)),
  delete: (id: string) =>
    post('deleteTemplate', { '템플릿ID': id })
      .catch(e => console.error('[Sheet] template delete:', e)),
};

export const submissionWriter = {
  upsert: (submission: ReviewSubmission) =>
    post('upsertSubmission', submissionToRow(submission))
      .catch(e => console.error('[Sheet] submission upsert:', e)),
};
