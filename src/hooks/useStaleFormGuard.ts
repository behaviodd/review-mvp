/**
 * B2 라운드 14 — UI stale-form 가드 (stability-audit-B § B2 잔여).
 *
 * 사용자 A 가 row 의 직책 수정 폼을 연 동안 B 가 같은 row 의 이메일을 수정하면,
 * A 의 폼 제출 시 B 의 변경을 덮어쓰는 race. Apps Script LockService 는 write 직렬화
 * 만 보장 — UI 측 stale-form 자체는 별도 가드 필요.
 *
 * 본 hook 은:
 *   1. 폼 mount 시점의 row 데이터를 snapshot 으로 보존 (useState)
 *   2. 현재 props 의 row 와 snapshot 을 JSON 비교 (deep equal 대용)
 *   3. 변경 감지 시 isStale=true 반환 + acknowledgeReload 로 snapshot 재설정
 *
 * 단순한 가드 — 복잡한 conflict resolution 은 별도 phase.
 */
import { useState, useMemo } from 'react';

export interface StaleFormGuard<T> {
  /** mount 시점 row 와 현재 row 가 다름 (외부 갱신 감지) */
  isStale: boolean;
  /** 폼을 현재 row 기준으로 다시 띄울 때 호출 (사용자가 '새로 불러오기' 확인 시) */
  acknowledgeReload: () => void;
  /** 디버그용 — mount 시점 snapshot */
  snapshot: T | undefined;
}

export function useStaleFormGuard<T>(current: T | undefined): StaleFormGuard<T> {
  const [snapshot, setSnapshot] = useState<T | undefined>(current);

  // JSON 직렬화는 deep equal 대용. 운영 row (User/Cycle/Submission) 는 plain object 라 안전.
  const snapshotKey = useMemo(() => snapshot ? JSON.stringify(snapshot) : '', [snapshot]);
  const currentKey  = useMemo(() => current  ? JSON.stringify(current)  : '', [current]);
  const isStale = !!snapshot && !!current && snapshotKey !== currentKey;

  return {
    isStale,
    acknowledgeReload: () => setSnapshot(current),
    snapshot,
  };
}
