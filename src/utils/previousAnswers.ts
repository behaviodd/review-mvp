import type { Answer, ReviewTemplate } from '../types';

/**
 * 이전 사이클의 답변을 현재 템플릿의 questionId 로 매핑한다.
 *
 * 매핑 규칙 (우선순위 순):
 *  1. question.text 정확 일치 (trim) — 의미적 동일성. 가장 안전
 *  2. fallback: 같은 (section order index, question.order) 위치 일치 —
 *     text 가 약간 변경된 경우 위치 기반 추론
 *
 * 매칭되지 않은 현재 질문은 결과 Map 에 포함되지 않음 — 호출처에서
 * 버튼 비활성 처리.
 */
export function mapPreviousAnswers(
  currentTemplate: ReviewTemplate | undefined,
  previousTemplate: ReviewTemplate | undefined,
  previousAnswers: Answer[] | undefined,
): Map<string, Answer> {
  const out = new Map<string, Answer>();
  if (!currentTemplate || !previousTemplate || !previousAnswers?.length) return out;

  const prevByText = new Map<string, Answer>();
  const prevByPosition = new Map<string, Answer>();

  const prevSectionOrder = new Map<string, number>();
  (previousTemplate.sections ?? []).forEach((s, i) => {
    prevSectionOrder.set(s.id, s.order ?? i);
  });

  for (const q of previousTemplate.questions) {
    const a = previousAnswers.find(x => x.questionId === q.id);
    if (!a) continue;
    const text = q.text?.trim();
    if (text) prevByText.set(text, a);
    const so = q.sectionId ? prevSectionOrder.get(q.sectionId) ?? -1 : -1;
    prevByPosition.set(`${so}/${q.order ?? -1}`, a);
  }

  const curSectionOrder = new Map<string, number>();
  (currentTemplate.sections ?? []).forEach((s, i) => {
    curSectionOrder.set(s.id, s.order ?? i);
  });

  for (const q of currentTemplate.questions) {
    const text = q.text?.trim();
    if (text && prevByText.has(text)) {
      out.set(q.id, prevByText.get(text)!);
      continue;
    }
    const so = q.sectionId ? curSectionOrder.get(q.sectionId) ?? -1 : -1;
    const key = `${so}/${q.order ?? -1}`;
    if (prevByPosition.has(key)) {
      out.set(q.id, prevByPosition.get(key)!);
    }
  }
  return out;
}
