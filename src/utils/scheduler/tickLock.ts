/**
 * localStorage 기반 리더 선거 (여러 브라우저 탭 중 1개만 스케줄러 실행).
 * TTL 안에 다른 탭이 lastTickAt을 찍었으면 skip; 아니면 이 탭이 리더로 등록하고 true 반환.
 * 각 작업은 idempotent하므로 실패해도 데이터 오염 없음 — 리더 선거는 중복 호출·알림 방지 용도.
 */
const KEY = 'review-scheduler.lastTickAt';
const TTL_MS = 45_000;

export function acquireLeader(now: number = Date.now()): boolean {
  try {
    const raw = window.localStorage.getItem(KEY);
    const lastAt = raw ? Number.parseInt(raw, 10) : 0;
    if (!Number.isNaN(lastAt) && now - lastAt < TTL_MS) return false;
    window.localStorage.setItem(KEY, String(now));
    return true;
  } catch {
    // private mode 등 localStorage 불가 → 리더 선거 skip, 항상 실행
    return true;
  }
}

export function lastTickAt(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? Number.parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}
