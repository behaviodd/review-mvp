/**
 * 동기화 훅 제어 레지스트리.
 *
 * useOrgSync / useReviewSync 가 mount 시 자신의 refetch 함수를 등록하면,
 * SyncStatusBanner 같은 비-훅 위치에서 `refetchAllSync()` 만으로 강제 재시도를 트리거할 수 있다.
 *
 * - 두 훅이 정확히 1 인스턴스만 mount 된다고 가정 (App.tsx 최상위에서만 호출).
 * - mount 시 등록 / unmount 시 해제. 등록되지 않은 경우 호출은 no-op.
 */

type RefetchFn = (opts?: { force?: boolean }) => Promise<void> | void;

let orgRefetch: RefetchFn | null = null;
let reviewRefetch: RefetchFn | null = null;

export function registerOrgRefetch(fn: RefetchFn): () => void {
  orgRefetch = fn;
  return () => {
    if (orgRefetch === fn) orgRefetch = null;
  };
}

export function registerReviewRefetch(fn: RefetchFn): () => void {
  reviewRefetch = fn;
  return () => {
    if (reviewRefetch === fn) reviewRefetch = null;
  };
}

/**
 * 양쪽 동기화 훅에 즉시 재시도를 요청.
 * 강제 모드(force=true)로 호출 — 쓰기 직후 grace 도 무시하고 한 번 시도한다.
 */
export async function refetchAllSync(): Promise<void> {
  await Promise.all([
    orgRefetch?.({ force: true }),
    reviewRefetch?.({ force: true }),
  ].filter(Boolean) as Promise<void>[]);
}

/**
 * 한쪽 동기화만 강제 재시도 — 등록된 인스턴스가 없으면 no-op.
 * useOrgSync/useReviewSync 를 직접 mount 하지 않고 refetch 만 트리거하고 싶을 때 사용
 * (예: Settings 페이지의 'Apps Script URL 저장' 버튼).
 */
export function refetchOrg(opts: { force?: boolean } = { force: true }): Promise<void> | void {
  return orgRefetch?.(opts);
}

export function refetchReview(opts: { force?: boolean } = { force: true }): Promise<void> | void {
  return reviewRefetch?.(opts);
}
