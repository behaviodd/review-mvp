import type { ReviewCycle, ReviewTemplate, ReviewSubmission, User } from '../types';

// ─── CSV helpers ─────────────────────────────────────────────────────────────

/** 셀 값을 CSV 안전 문자열로 변환 */
function cell(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = String(v).replace(/\r?\n/g, ' ');   // 개행 → 공백
  // 따옴표·쉼표·개행 포함 시 큰따옴표로 감싸기
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(...cells: (string | number | undefined | null)[]): string {
  return cells.map(cell).join(',');
}

const STATUS_KO: Record<string, string> = {
  submitted:   '제출완료',
  in_progress: '작성중',
  not_started: '미작성',
};

function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  );
}

/** 질문 텍스트를 컬럼 헤더용으로 축약 */
function shortQ(text: string, maxLen = 20): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

// ─── 단일 제출 내보내기 ────────────────────────────────────────────────────────

/**
 * 개별 평가 1건을 CSV로 내보내기
 *
 * - 자기평가: 질문 / 답변 2열
 * - 매니저 평가: 질문 / 자기평가 답변 / 매니저 평가 답변 3열 (비교 포함)
 */
export function exportSubmissionToCSV(
  submission: ReviewSubmission,
  template: ReviewTemplate,
  cycle: ReviewCycle,
  reviewee: User,
  reviewer: User,
  /** 매니저 평가일 때 비교용 자기평가 submission */
  selfSubmission?: ReviewSubmission,
): void {
  const isSelf = submission.type === 'self';
  const questions = [...template.questions]
    .filter(q => isSelf ? q.target !== 'leader' : q.target !== 'self')
    .sort((a, b) => a.order - b.order);

  const getAnswer = (sub: ReviewSubmission | undefined, qId: string) =>
    sub?.answers.find(a => a.questionId === qId);

  const answerText = (sub: ReviewSubmission | undefined, q: { id: string; type: string }) => {
    const a = getAnswer(sub, q.id);
    if (!a) return '';
    return a.ratingValue != null ? String(a.ratingValue) : (a.textValue?.replace(/\r?\n/g, ' ') ?? '');
  };

  // ── 메타 헤더 ─────────────────────────────────────────────────────────────
  const metaRows = [
    row('리뷰 사이클', cycle.title),
    row('평가 유형',   isSelf ? '자기평가' : '매니저 평가'),
    ...(isSelf ? [
      row('이름',   reviewee.name),
      row('부서',   reviewee.department),
      row('직책',   reviewee.position),
    ] : [
      row('평가 대상',       reviewee.name),
      row('부서',            reviewee.department),
      row('직책',            reviewee.position),
      row('평가자 (매니저)', reviewer.name),
    ]),
    row('상태',     STATUS_KO[submission.status] ?? submission.status),
    ...(isSelf ? [
      row('종합점수', submission.overallRating != null ? submission.overallRating.toFixed(2) : ''),
    ] : [
      row('종합점수 (매니저)',   submission.overallRating   != null ? submission.overallRating.toFixed(2)   : ''),
      row('종합점수 (자기평가)', selfSubmission?.overallRating != null ? selfSubmission.overallRating.toFixed(2) : ''),
    ]),
    row('제출일시',  fmtDateTime(submission.submittedAt)),
    row('내보내기',  fmtDateTime(new Date().toISOString())),
  ];

  // ── 답변 표 ───────────────────────────────────────────────────────────────
  const tableHeader = isSelf
    ? row('번호', '질문', '유형', '답변')
    : row('번호', '질문', '유형', '자기평가', '매니저 평가');

  const tableRows = questions.map((q, i) => {
    const typeLabel = q.type === 'rating' || q.type === 'competency' ? '평점(1-5)' : '서술형';
    if (isSelf) {
      return row(i + 1, q.text, typeLabel, answerText(submission, q));
    } else {
      return row(i + 1, q.text, typeLabel, answerText(selfSubmission, q), answerText(submission, q));
    }
  });

  // ── 조립 & 다운로드 ───────────────────────────────────────────────────────
  const csv = [...metaRows, '', tableHeader, ...tableRows].join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const typeSlug = isSelf ? '자기평가' : '매니저평가';
  const filename = `${cycle.title}_${reviewee.name}_${typeSlug}_${fmtDate(new Date().toISOString())}.csv`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 사이클 전체 내보내기 ─────────────────────────────────────────────────────

/**
 * 사이클 전체 평가 결과를 스프레드시트 최적화 CSV로 내보내기
 *
 * 포맷: 1인 1행 (Wide format)
 *   - 공통: 이름, 부서, 직책, 매니저, 자기평가/매니저평가 상태·점수
 *   - 질문별: [Q텍스트]_자기평가, [Q텍스트]_매니저평가 (해당 없으면 빈칸)
 *   - 마감: 자기평가 제출일시, 매니저평가 제출일시
 */
export function exportCycleToCSV(
  cycle: ReviewCycle,
  template: ReviewTemplate,
  submissions: ReviewSubmission[],
  allUsers: User[],
): void {
  const targetMembers = allUsers.filter(
    u => cycle.targetDepartments.includes(u.department ?? '') && u.role !== 'admin',
  );

  const questions = [...template.questions].sort((a, b) => a.order - b.order);

  // ── 헤더 ──────────────────────────────────────────────────────────────────

  // 행 1: 메타 정보
  const meta = [
    row('리뷰 사이클', cycle.title),
    row('유형', cycle.type === 'scheduled' ? '정기' : '수시'),
    row('자기평가 마감', fmtDate(cycle.selfReviewDeadline)),
    row('매니저평가 마감', fmtDate(cycle.managerReviewDeadline)),
    row('템플릿', template.name),
    row('내보내기 일시', fmtDateTime(new Date().toISOString())),
  ].join('\n');

  // 행 2: 빈 줄 구분
  const blank = '';

  // 행 3: 컬럼 헤더
  const fixedCols = [
    '이름', '부서', '직책', '매니저',
    '자기평가_상태', '매니저평가_상태',
    '자기평가_종합점수', '매니저평가_종합점수',
  ];

  const questionCols: string[] = [];
  for (const q of questions) {
    const label = shortQ(q.text);
    const suffix = q.isPrivate ? ' [매니저전용]' : '';
    if (q.target === 'self' || q.target === 'both') {
      questionCols.push(`${label}${suffix}_자기평가`);
    }
    if (q.target === 'leader' || q.target === 'both') {
      questionCols.push(`${label}${suffix}_매니저평가`);
    }
  }

  const tailCols = ['자기평가_제출일시', '매니저평가_제출일시'];
  const header = row(...fixedCols, ...questionCols, ...tailCols);

  // ── 데이터 행 ──────────────────────────────────────────────────────────────

  const dataRows = targetMembers.map(member => {
    const manager = allUsers.find(u => u.id === member.managerId);

    const selfSub = submissions.find(
      s => s.revieweeId === member.id && s.reviewerId === member.id
        && s.type === 'self' && s.cycleId === cycle.id,
    );

    // 매니저 평가: revieweeId === member, type === 'downward'
    const mgrSub = submissions.find(
      s => s.revieweeId === member.id && s.type === 'downward' && s.cycleId === cycle.id,
    );

    const getAnswer = (sub: ReviewSubmission | undefined, questionId: string) =>
      sub?.answers.find(a => a.questionId === questionId);

    // 고정 컬럼
    const fixed = [
      member.name,
      member.department,
      member.position,
      manager?.name ?? '',
      STATUS_KO[selfSub?.status ?? 'not_started'],
      STATUS_KO[mgrSub?.status ?? 'not_started'],
      selfSub?.overallRating?.toFixed(2) ?? '',
      mgrSub?.overallRating?.toFixed(2) ?? '',
    ];

    // 질문별 컬럼
    const answers: (string | number | undefined)[] = [];
    for (const q of questions) {
      if (q.target === 'self' || q.target === 'both') {
        const a = getAnswer(selfSub, q.id);
        answers.push(a?.ratingValue ?? a?.textValue ?? '');
      }
      if (q.target === 'leader' || q.target === 'both') {
        const a = getAnswer(mgrSub, q.id);
        answers.push(a?.ratingValue ?? a?.textValue ?? '');
      }
    }

    // 제출일시
    const tail = [
      fmtDateTime(selfSub?.submittedAt),
      fmtDateTime(mgrSub?.submittedAt),
    ];

    return row(...fixed, ...answers, ...tail);
  });

  // ── 조립 & 다운로드 ────────────────────────────────────────────────────────

  const csv = [meta, blank, header, ...dataRows].join('\n');
  // UTF-8 BOM: Excel이 한글 인코딩을 올바르게 인식
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `${cycle.title.replace(/\s/g, '_')}_${fmtDate(new Date().toISOString())}.csv`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
