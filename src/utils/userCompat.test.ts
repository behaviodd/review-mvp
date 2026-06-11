import { describe, it, expect } from 'vitest';
import { userIsWorking, userIsOnLeave, userIsTerminated, isUserActive } from './userCompat';
import type { User, ActivityStatus } from '../types';

const u = (over: Partial<User>): User => ({
  id: 'u', name: '홍길동', email: 'a@b.c', role: 'member',
  position: '', avatarColor: '#000', department: '', ...over,
});

const withStatus = (s: ActivityStatus) => u({ activityStatus: s });

describe('재직상태 필터 분류 (userIsWorking / OnLeave / Terminated)', () => {
  it('active → 재직', () => {
    const m = withStatus('active');
    expect(userIsWorking(m)).toBe(true);
    expect(userIsOnLeave(m)).toBe(false);
    expect(userIsTerminated(m)).toBe(false);
  });

  it('other → 재직 (관리자 판단 기타도 재직으로 묶음)', () => {
    const m = withStatus('other');
    expect(userIsWorking(m)).toBe(true);
    expect(userIsOnLeave(m)).toBe(false);
    expect(userIsTerminated(m)).toBe(false);
  });

  it('leave_short → 휴직', () => {
    const m = withStatus('leave_short');
    expect(userIsOnLeave(m)).toBe(true);
    expect(userIsWorking(m)).toBe(false);
    expect(userIsTerminated(m)).toBe(false);
  });

  it('leave_long → 휴직 (회귀: 예전엔 모든 필터에서 누락됐던 케이스)', () => {
    const m = withStatus('leave_long');
    expect(userIsOnLeave(m)).toBe(true);
    expect(userIsWorking(m)).toBe(false);
    expect(userIsTerminated(m)).toBe(false);
    // leave_long 은 '휴직' 필터에 반드시 잡혀야 한다 (isUserActive 로는 비활동 처리됨)
    expect(isUserActive(m)).toBe(false);
  });

  it('terminated → 퇴사', () => {
    const m = withStatus('terminated');
    expect(userIsTerminated(m)).toBe(true);
    expect(userIsWorking(m)).toBe(false);
    expect(userIsOnLeave(m)).toBe(false);
  });

  it('legacy: activityStatus 없음 + isActive!==false → 재직', () => {
    const m = u({ isActive: true });
    expect(userIsWorking(m)).toBe(true);
    expect(userIsTerminated(m)).toBe(false);
    expect(userIsOnLeave(m)).toBe(false);
  });

  it('legacy: activityStatus 없음 + isActive===false → 퇴사', () => {
    const m = u({ isActive: false });
    expect(userIsTerminated(m)).toBe(true);
    expect(userIsWorking(m)).toBe(false);
  });

  it('각 사용자는 정확히 한 분류에만 속한다 (전수)', () => {
    const all: User[] = [
      withStatus('active'), withStatus('other'),
      withStatus('leave_short'), withStatus('leave_long'),
      withStatus('terminated'),
      u({ isActive: true }), u({ isActive: false }),
    ];
    for (const m of all) {
      const hits = [userIsWorking(m), userIsOnLeave(m), userIsTerminated(m)].filter(Boolean);
      expect(hits).toHaveLength(1);
    }
  });
});
