/**
 * Google Sheets 행 → ReviewCycle / ReviewTemplate / ReviewSubmission 파싱
 */
import type {
  ReviewCycle, ReviewTemplate, TemplateQuestion, TemplateSection,
  ReviewSubmission, Answer,
} from '../types';

type Row = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
function num(v: unknown): number {
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}
function bool(v: unknown): boolean {
  return String(v).toLowerCase() === 'true';
}
function parseJSON<T>(v: unknown, fallback: T): T {
  try { return JSON.parse(str(v)) as T; } catch { return fallback; }
}

/* ── 사이클 ─────────────────────────────────────────────────────── */
export function parseSheetCycle(row: Row): ReviewCycle | null {
  const id = str(row['사이클ID']);
  if (!id) return null;
  const deptRaw = str(row['대상부서']);
  // R3: 평가차수배열 — "1,2" → [1, 2]
  const ranksRaw = str(row['평가차수배열']);
  const downwardReviewerRanks = ranksRaw
    ? ranksRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
    : undefined;
  // R1: 인사적용방식
  const hrModeRaw = str(row['인사적용방식']);
  const hrSnapshotMode: ReviewCycle['hrSnapshotMode'] = hrModeRaw === 'snapshot' ? 'snapshot'
    : hrModeRaw === 'live' ? 'live'
    : undefined;
  return {
    id,
    title:                 str(row['제목']),
    type:                  str(row['유형']) === '수시' ? 'adhoc' : 'scheduled',
    status:                str(row['상태']) as ReviewCycle['status'],
    templateId:            str(row['템플릿ID']),
    targetDepartments:     deptRaw ? deptRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    selfReviewDeadline:    str(row['자기평가마감']),
    managerReviewDeadline: str(row['매니저평가마감']),
    createdBy:             str(row['생성자ID']),
    createdAt:             str(row['생성일시']),
    completionRate:        num(row['완료율']),
    // R1
    hrSnapshotMode,
    hrSnapshotId:          str(row['인사스냅샷ID']) || undefined,
    // R3
    downwardReviewerRanks: downwardReviewerRanks && downwardReviewerRanks.length > 0
      ? downwardReviewerRanks
      : undefined,
  };
}

export function parseSheetCycles(rows: Row[]): ReviewCycle[] {
  return rows.map(parseSheetCycle).filter((c): c is ReviewCycle => c !== null);
}

/* ── 템플릿 ─────────────────────────────────────────────────────── */
export function parseSheetTemplate(row: Row): ReviewTemplate | null {
  const id = str(row['템플릿ID']);
  if (!id) return null;
  return {
    id,
    name:        str(row['이름']),
    description: str(row['설명']),
    isDefault:   bool(row['기본템플릿']),
    createdBy:   str(row['생성자ID']),
    createdAt:   str(row['생성일시']),
    questions:   parseJSON<TemplateQuestion[]>(row['질문JSON'], []),
    sections:    parseJSON<TemplateSection[]>(row['섹션JSON'], []),
  };
}

export function parseSheetTemplates(rows: Row[]): ReviewTemplate[] {
  return rows.map(parseSheetTemplate).filter((t): t is ReviewTemplate => t !== null);
}

/* ── 제출내용 ────────────────────────────────────────────────────── */
export function parseSheetSubmission(row: Row): ReviewSubmission | null {
  const id = str(row['제출ID']);
  if (!id) return null;
  const rating = row['종합점수'] !== '' && row['종합점수'] !== null && row['종합점수'] !== undefined
    ? num(row['종합점수']) : undefined;
  // R3: 평가자차수
  const rankRaw = str(row['평가자차수']);
  const reviewerRank = rankRaw ? parseInt(rankRaw, 10) : undefined;
  return {
    id,
    cycleId:      str(row['사이클ID']),
    reviewerId:   str(row['평가자ID']),
    revieweeId:   str(row['평가대상ID']),
    type:         str(row['유형']) as 'self' | 'downward',
    status:       str(row['상태']) as ReviewSubmission['status'],
    overallRating: rating,
    submittedAt:  str(row['제출일시']) || undefined,
    lastSavedAt:  str(row['최종저장일시']),
    answers:      parseJSON<Answer[]>(row['답변JSON'], []),
    reviewerRank: reviewerRank && !isNaN(reviewerRank) ? reviewerRank : undefined,
  };
}

export function parseSheetSubmissions(rows: Row[]): ReviewSubmission[] {
  return rows.map(parseSheetSubmission).filter((s): s is ReviewSubmission => s !== null);
}
