import type { ReviewCycle, ReviewTemplate } from '../types';
import { DEFAULT_TEMPLATE } from '../data/defaultTemplate';

/**
 * 리뷰 작성·읽기 시 사용해야 하는 템플릿을 반환한다.
 *
 * 우선순위:
 *  1. cycle.templateSnapshot  — 발행 시점에 동결된 사본 (버전 락)
 *  2. templates에서 cycle.templateId로 조회한 현 템플릿
 *  3. DEFAULT_TEMPLATE
 *
 * 기존(Phase 3.1 이전) 발행된 사이클은 snapshot이 없으므로 2번 경로를 탄다.
 */
export function getEffectiveTemplate(
  cycle: Pick<ReviewCycle, 'templateId' | 'templateSnapshot'> | undefined,
  templates: ReviewTemplate[],
): ReviewTemplate {
  if (!cycle) return DEFAULT_TEMPLATE;
  if (cycle.templateSnapshot) return cycle.templateSnapshot;
  return templates.find(t => t.id === cycle.templateId) ?? DEFAULT_TEMPLATE;
}
