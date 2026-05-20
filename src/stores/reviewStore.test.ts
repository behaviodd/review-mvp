import { describe, expect, it, beforeEach } from 'vitest';
import { useReviewStore } from './reviewStore';
import type { ReviewCycle, ReviewTemplate } from '../types';

const at = '2026-05-20T00:00:00.000Z';

function template(id = 'tpl_1'): ReviewTemplate {
  return {
    id,
    name: '성과 리뷰',
    description: '',
    isDefault: false,
    createdBy: 'admin',
    createdAt: at,
    questions: [{ id: 'q_snap_1', text: '성과', type: 'text', target: 'self', isRequired: true, order: 0 }],
  };
}

function cycle(overrides: Partial<ReviewCycle> = {}): ReviewCycle {
  return {
    id: 'cyc_1',
    title: '2026 상반기',
    type: 'scheduled',
    status: 'manager_review',
    templateId: 'tpl_1',
    targetDepartments: [],
    selfReviewDeadline: at,
    managerReviewDeadline: at,
    createdBy: 'admin',
    createdAt: at,
    completionRate: 0,
    ...overrides,
  };
}

describe('reviewStore.syncFromSheet — templateSnapshot 보존', () => {
  beforeEach(() => {
    useReviewStore.setState({ cycles: [], templates: [], submissions: [] });
  });

  it('remote cycle 에 snapshot 이 없으면 local snapshot 을 보존한다 (시트 빈 셀 방어)', () => {
    const snap = template();
    // 발행 시 저장된 local cycle — snapshot 보유
    useReviewStore.setState({
      cycles: [cycle({ templateSnapshot: snap, templateSnapshotAt: at })],
    });

    // 폴링: 시트의 템플릿스냅샷JSON 셀이 비어 snapshot 없이 파싱된 remote cycle
    useReviewStore.getState().syncFromSheet({
      cycles: [cycle({ templateSnapshot: undefined, templateSnapshotAt: undefined })],
    });

    const merged = useReviewStore.getState().cycles.find(c => c.id === 'cyc_1');
    expect(merged?.templateSnapshot).toBeDefined();
    expect(merged?.templateSnapshot?.questions[0].id).toBe('q_snap_1');
    expect(merged?.templateSnapshotAt).toBe(at);
  });

  it('remote cycle 에 snapshot 이 있으면 remote 값을 사용한다 (정상 round-trip)', () => {
    const localSnap = template('tpl_old');
    const remoteSnap = template('tpl_new');
    useReviewStore.setState({
      cycles: [cycle({ templateSnapshot: localSnap, templateSnapshotAt: '2026-01-01T00:00:00.000Z' })],
    });

    useReviewStore.getState().syncFromSheet({
      cycles: [cycle({ templateSnapshot: remoteSnap, templateSnapshotAt: at })],
    });

    const merged = useReviewStore.getState().cycles.find(c => c.id === 'cyc_1');
    expect(merged?.templateSnapshot?.id).toBe('tpl_new');
    expect(merged?.templateSnapshotAt).toBe(at);
  });

  it('local 에도 snapshot 이 없으면 remote(undefined) 그대로 둔다', () => {
    useReviewStore.setState({ cycles: [cycle({ templateSnapshot: undefined })] });

    useReviewStore.getState().syncFromSheet({
      cycles: [cycle({ templateSnapshot: undefined })],
    });

    const merged = useReviewStore.getState().cycles.find(c => c.id === 'cyc_1');
    expect(merged?.templateSnapshot).toBeUndefined();
  });
});
