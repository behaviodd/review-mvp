/**
 * Google Sheets 행 → ReviewCycle / ReviewTemplate / ReviewSubmission 파싱
 */
import type {
  ReviewCycle, ReviewTemplate, TemplateQuestion, TemplateSection,
  ReviewSubmission, Answer, RefLink, ReviewKind,
  CycleTargetMode, AutoAdvanceRule, ReminderRule,
  AnonymityPolicy, VisibilityPolicy, ReferenceInfoPolicy,
  PeerSelectionPolicy, DistributionPolicy,
  ReminderRecord, DeadlineExtension, ReviewerChange,
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
/**
 * P0 라운드 13 — parser/writer 비대칭 부채 일괄 복원.
 * 기존: cycleToRow 는 19개 컬럼을 직렬화하는데 parseSheetCycle 는 핵심 9개만 파싱.
 * 폴링/새로고침 시 cycle 의 anonymity, visibility, peerSelection, distribution, reminderPolicy
 * 등 정책 설정이 store 에서 사라져 운영 버그 (R7~R8 발행분도 동일).
 * 본 fix 로 writer 의 모든 컬럼 round-trip 보장.
 *
 * 주의:
 * - writer 가 default 적용하는 필드 (targetMode, reviewKinds) 는 parser 가 raw 그대로 받음.
 *   다음번 write 시 동일 default 가 다시 적용되어 round-trip 안정.
 * - empty list → '' 직렬화 → parser undefined. UI 에서 `(c.tags ?? [])` 등 fallback 처리하므로 안전.
 */
export function parseSheetCycle(row: Row): ReviewCycle | null {
  const id = str(row['사이클ID']);
  if (!id) return null;

  const deptRaw = str(row['대상부서']);
  const ranksRaw = str(row['평가차수배열']);  // R3: "1,2" → [1, 2]
  const downwardReviewerRanks = ranksRaw
    ? ranksRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
    : undefined;
  // R1: 인사적용방식
  const hrModeRaw = str(row['인사적용방식']);
  const hrSnapshotMode: ReviewCycle['hrSnapshotMode'] = hrModeRaw === 'snapshot' ? 'snapshot'
    : hrModeRaw === 'live' ? 'live'
    : undefined;

  // 라운드 13 추가: 누락 컬럼 round-trip
  const tagsRaw = str(row['태그']);
  const userIdsRaw = str(row['대상사용자IDS']);
  const targetModeRaw = str(row['대상모드']);
  const targetMode: CycleTargetMode | undefined =
    (targetModeRaw === 'org' || targetModeRaw === 'manager' || targetModeRaw === 'custom')
      ? targetModeRaw : undefined;
  const reviewKindsRaw = str(row['리뷰유형']);
  const reviewKinds = reviewKindsRaw
    ? reviewKindsRaw.split(',').map(s => s.trim()).filter((s): s is ReviewKind =>
        s === 'self' || s === 'peer' || s === 'upward' || s === 'downward')
    : undefined;
  const autoArchivedRaw = str(row['자동보관플래그']);

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
    // 라운드 12 A1/A2 — templateSnapshot round-trip
    templateSnapshot:   parseJSON<ReviewTemplate | null>(row['템플릿스냅샷JSON'], null) ?? undefined,
    templateSnapshotAt: str(row['템플릿스냅샷일시']) || undefined,
    // 라운드 13 — 부채 일괄 복원
    tags:               tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    archivedAt:         str(row['보관일시']) || undefined,
    fromCycleId:        str(row['복제원본ID']) || undefined,
    // Phase 3.2a
    folderId:           str(row['폴더ID']) || undefined,
    targetMode,
    targetManagerId:    str(row['대상매니저ID']) || undefined,
    targetUserIds:      userIdsRaw ? userIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    // Phase 3.2b
    scheduledPublishAt: str(row['예약발행일시']) || undefined,
    autoAdvance:        parseJSON<AutoAdvanceRule | null>(row['자동전환JSON'], null) ?? undefined,
    reminderPolicy:     row['알림정책JSON'] ? parseJSON<ReminderRule[]>(row['알림정책JSON'], []) : undefined,
    editLockedAt:       str(row['편집잠금일시']) || undefined,
    autoArchived:       autoArchivedRaw === 'true' ? true : undefined,
    closedAt:           str(row['종료일시']) || undefined,
    // Phase 3.3a
    anonymity:          row['익명정책JSON']  ? parseJSON<AnonymityPolicy>(row['익명정책JSON'], {})   : undefined,
    visibility:         row['공개정책JSON']  ? parseJSON<VisibilityPolicy>(row['공개정책JSON'], {})  : undefined,
    referenceInfo:      row['참고정보JSON']  ? parseJSON<ReferenceInfoPolicy>(row['참고정보JSON'], {}) : undefined,
    // Phase 3.3b-1
    reviewKinds,
    peerSelection:      parseJSON<PeerSelectionPolicy | null>(row['동료선택정책JSON'], null) ?? undefined,
    // Phase 3.3c-2
    distribution:       parseJSON<DistributionPolicy | null>(row['분포정책JSON'], null) ?? undefined,
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
/**
 * P0 라운드 13 — submission parser 부채 복원.
 * 누락 fields: remindersSent, deadlineOverride, proxyWrittenBy, reviewerHistory, autoExcluded.
 * 또 type 캐스팅이 'self' | 'downward' 만으로 좁혀 있어 peer/upward 가 정상 시트에 있어도 타입 깨짐.
 */
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
    type:         str(row['유형']) as ReviewKind,
    status:       str(row['상태']) as ReviewSubmission['status'],
    overallRating: rating,
    submittedAt:  str(row['제출일시']) || undefined,
    lastSavedAt:  str(row['최종저장일시']),
    answers:      parseJSON<Answer[]>(row['답변JSON'], []),
    reviewerRank: reviewerRank && !isNaN(reviewerRank) ? reviewerRank : undefined,
    // 라운드 11: 참고자료 round-trip
    references:   row['참고자료JSON'] ? parseJSON<RefLink[]>(row['참고자료JSON'], []) : undefined,
    // 라운드 13 — 부채 일괄 복원
    remindersSent:    row['리마인드JSON']    ? parseJSON<ReminderRecord[]>(row['리마인드JSON'], []) : undefined,
    deadlineOverride: parseJSON<DeadlineExtension | null>(row['연장기한JSON'], null) ?? undefined,
    proxyWrittenBy:   str(row['대리작성자']) || undefined,
    reviewerHistory:  row['작성자이력JSON']  ? parseJSON<ReviewerChange[]>(row['작성자이력JSON'], []) : undefined,
    autoExcluded:     parseJSON<ReviewSubmission['autoExcluded'] | null>(row['자동제외JSON'], null) ?? undefined,
  };
}

export function parseSheetSubmissions(rows: Row[]): ReviewSubmission[] {
  return rows.map(parseSheetSubmission).filter((s): s is ReviewSubmission => s !== null);
}
