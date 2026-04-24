/**
 * Google Sheets 실시간 연동 유틸리티
 *
 * 전송 방식: fetch POST → Apps Script 웹앱 URL
 * CORS 우회: mode: 'no-cors' (fire-and-forget, 응답 미사용)
 * 인코딩:   Content-Type: text/plain + JSON body
 */

import type { ReviewCycle, ReviewTemplate, ReviewSubmission, User } from '../types';
import { resolveTargetMembers } from './resolveTargets';

// ─── 포맷 헬퍼 ────────────────────────────────────────────────────────────────

const STATUS_KO: Record<string, string> = {
  submitted:   '제출완료',
  in_progress: '작성중',
  not_started: '미작성',
};

function fmtDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function fmtDateTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function answerValue(sub: ReviewSubmission | undefined, qId: string): string | number {
  const a = sub?.answers.find(x => x.questionId === qId);
  if (!a) return '';
  // 평점은 숫자, 텍스트는 개행 제거
  return a.ratingValue ?? (a.textValue?.replace(/\r?\n/g, ' ') ?? '');
}

function shortLabel(text: string, max = 18) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ─── 헤더 빌더 ────────────────────────────────────────────────────────────────

function buildSelfHeaders(template: ReviewTemplate): string[] {
  const qCols = template.questions
    .filter(q => q.target !== 'leader')
    .sort((a, b) => a.order - b.order)
    .map(q => `Q${q.order}_${shortLabel(q.text)}`);

  return [
    '제출ID', '사이클ID', '사이클명',
    '이름', '부서', '직책', '매니저',
    '상태', '종합점수',
    ...qCols,
    '제출일시', '동기화일시',
  ];
}

function buildManagerHeaders(template: ReviewTemplate): string[] {
  const qCols = template.questions
    .filter(q => q.target !== 'self')
    .sort((a, b) => a.order - b.order)
    .map(q =>
      `Q${q.order}_${shortLabel(q.text)}${q.isPrivate ? '[비공개]' : ''}`,
    );

  return [
    '제출ID', '사이클ID', '사이클명',
    '평가대상', '부서', '직책', '매니저',
    '상태', '종합점수',
    ...qCols,
    '제출일시', '동기화일시',
  ];
}

const COMPARISON_HEADERS = [
  '사이클ID', '평가대상ID', '사이클명',
  '이름', '부서', '직책', '매니저',
  '자기평가점수', '매니저평가점수', '점수차이', '판정',
  '자기평가제출일', '매니저평가제출일', '동기화일시',
];

// ─── 행 빌더 ─────────────────────────────────────────────────────────────────

function buildSelfRow(
  sub: ReviewSubmission,
  cycle: ReviewCycle,
  template: ReviewTemplate,
  allUsers: User[],
): (string | number)[] {
  const member  = allUsers.find(u => u.id === sub.revieweeId);
  const manager = allUsers.find(u => u.id === member?.managerId);
  const questions = template.questions
    .filter(q => q.target !== 'leader')
    .sort((a, b) => a.order - b.order);

  return [
    sub.id,
    cycle.id,
    cycle.title,
    member?.name ?? '',
    member?.department ?? '',
    member?.position ?? '',
    manager?.name ?? '',
    STATUS_KO[sub.status] ?? sub.status,
    sub.overallRating != null ? +sub.overallRating.toFixed(2) : '',
    ...questions.map(q => answerValue(sub, q.id)),
    fmtDateTime(sub.submittedAt),
    fmtDateTime(new Date().toISOString()),
  ];
}

function buildManagerRow(
  sub: ReviewSubmission,
  cycle: ReviewCycle,
  template: ReviewTemplate,
  allUsers: User[],
): (string | number)[] {
  const reviewee = allUsers.find(u => u.id === sub.revieweeId);
  const manager  = allUsers.find(u => u.id === reviewee?.managerId);
  const questions = template.questions
    .filter(q => q.target !== 'self')
    .sort((a, b) => a.order - b.order);

  return [
    sub.id,
    cycle.id,
    cycle.title,
    reviewee?.name ?? '',
    reviewee?.department ?? '',
    reviewee?.position ?? '',
    manager?.name ?? '',
    STATUS_KO[sub.status] ?? sub.status,
    sub.overallRating != null ? +sub.overallRating.toFixed(2) : '',
    ...questions.map(q => answerValue(sub, q.id)),
    fmtDateTime(sub.submittedAt),
    fmtDateTime(new Date().toISOString()),
  ];
}

function buildComparisonRow(
  reviewee: User,
  cycle: ReviewCycle,
  selfSub: ReviewSubmission | undefined,
  mgrSub: ReviewSubmission | undefined,
  allUsers: User[],
): (string | number)[] {
  const manager  = allUsers.find(u => u.id === reviewee.managerId);
  const selfScore = selfSub?.overallRating;
  const mgrScore  = mgrSub?.overallRating;

  const diff = selfScore != null && mgrScore != null
    ? +(mgrScore - selfScore).toFixed(2)
    : '';

  let verdict = '';
  if (selfScore != null && mgrScore != null) {
    const d = mgrScore - selfScore;
    if (d >= 1.5)       verdict = '고평가 (매니저>본인)';
    else if (d <= -1.5) verdict = '저평가 (본인>매니저)';
    else                verdict = '일치';
  }

  return [
    cycle.id,
    reviewee.id,
    cycle.title,
    reviewee.name,
    reviewee.department,
    reviewee.position,
    manager?.name ?? '',
    selfScore != null ? +selfScore.toFixed(2) : '',
    mgrScore  != null ? +mgrScore.toFixed(2)  : '',
    diff,
    verdict,
    fmtDate(selfSub?.submittedAt),
    fmtDate(mgrSub?.submittedAt),
    fmtDateTime(new Date().toISOString()),
  ];
}

// ─── HTTP 전송 ────────────────────────────────────────────────────────────────

async function post(scriptUrl: string, body: unknown): Promise<void> {
  // mode: 'no-cors' — Apps Script CORS 제한 우회
  // 응답을 읽을 수 없지만 요청은 정상 전달됨
  await fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 단일 제출 동기화 (제출 완료 시 자동 호출)
 * 자기평가 또는 매니저평가 시트에 upsert
 */
export async function syncSubmission(
  submission: ReviewSubmission,
  cycle: ReviewCycle,
  template: ReviewTemplate,
  allUsers: User[],
  scriptUrl: string,
): Promise<void> {
  if (!scriptUrl) return;

  const isSelf = submission.type === 'self';
  const row     = isSelf
    ? buildSelfRow(submission, cycle, template, allUsers)
    : buildManagerRow(submission, cycle, template, allUsers);
  const headers = isSelf
    ? buildSelfHeaders(template)
    : buildManagerHeaders(template);

  await post(scriptUrl, {
    action: 'upsert',
    type:    submission.type,
    headers,
    row,
  });
}

/**
 * 사이클 전체 동기화 (수동 버튼 트리거)
 * 자기평가 + 매니저평가 + 비교분석 시트를 한 번에 갱신
 */
export async function syncCycle(
  cycle: ReviewCycle,
  submissions: ReviewSubmission[],
  template: ReviewTemplate,
  allUsers: User[],
  scriptUrl: string,
): Promise<void> {
  if (!scriptUrl) return;

  const cycleSubs = submissions.filter(s => s.cycleId === cycle.id);
  const selfSubs  = cycleSubs.filter(s => s.type === 'self');
  const mgrSubs   = cycleSubs.filter(s => s.type === 'downward');

  const targetMembers = resolveTargetMembers(cycle, allUsers);

  const comparisonRows = targetMembers.map(m =>
    buildComparisonRow(
      m,
      cycle,
      selfSubs.find(s => s.revieweeId === m.id),
      mgrSubs.find(s  => s.revieweeId === m.id),
      allUsers,
    ),
  );

  await post(scriptUrl, {
    action:             'full_sync',
    selfHeaders:        buildSelfHeaders(template),
    managerHeaders:     buildManagerHeaders(template),
    comparisonHeaders:  COMPARISON_HEADERS,
    selfRows:           selfSubs.map(s => buildSelfRow(s, cycle, template, allUsers)),
    managerRows:        mgrSubs.map(s => buildManagerRow(s, cycle, template, allUsers)),
    comparisonRows,
  });
}
