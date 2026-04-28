/**
 * fetch 안정화 래퍼 — timeout + 자동 재시도 + 오류 분류.
 *
 * - 5xx / 네트워크 오류 / timeout 은 transient 로 분류, 지수 백오프로 재시도
 * - 4xx 는 permanent 로 즉시 throw, 재시도 없음
 * - 외부 AbortSignal 로 중단되면 재시도 없이 즉시 throw
 *
 * 모든 sync read/write 의 단일 진입점 — 여기서 회복 가능한 흔들림을 흡수해
 * 호출자(훅/배너)가 보는 실패는 "정말 회복 불능인 케이스" 로 좁힌다.
 */

export type SyncErrorKind = 'transient' | 'permanent' | 'timeout';

export class SyncError extends Error {
  kind: SyncErrorKind;
  status?: number;
  attempts: number;

  constructor(kind: SyncErrorKind, message: string, opts?: { status?: number; attempts?: number; cause?: unknown }) {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
    this.status = opts?.status;
    this.attempts = opts?.attempts ?? 1;
    if (opts?.cause !== undefined) (this as { cause?: unknown }).cause = opts.cause;
  }
}

export interface ResilientOptions extends RequestInit {
  /** 단일 시도의 최대 대기 시간(ms). 기본 20_000 — Vercel Edge 25s 한계보다 짧게. */
  timeoutMs?: number;
  /** 추가 재시도 횟수. 기본 2 → 최초 1회 + 재시도 2회 = 총 3회. */
  retries?: number;
  /** i 번째 재시도 직전 대기(ms). 기본 [500, 1500]. */
  backoffMs?: number[];
  /**
   * 응답을 transient 로 간주해 재시도할지 결정. 기본: status >= 500.
   * 4xx 도 transient 로 보고 싶으면 직접 지정.
   */
  retryOn?: (res: Response) => boolean;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS: readonly number[] = [500, 1500];

function jitter(ms: number): number {
  // ±20% jitter — 동시에 여러 클라이언트가 retry 폭주하는 thundering herd 방지
  const delta = ms * 0.2;
  return Math.max(0, ms + (Math.random() * 2 - 1) * delta);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 한 번의 시도. timeout 만 적용. 재시도 루프는 호출자가 담당.
 * - 응답이 retryOn 을 통과하면 transient SyncError throw
 * - 그 외 4xx 응답은 그대로 호출자에게 반환 (호출자가 ok 검사 후 permanent 분류)
 */
async function fetchOnce(
  url: string,
  opts: ResilientOptions,
  externalSignal: AbortSignal | undefined,
  attempt: number,
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryOn = opts.retryOn ?? ((res: Response) => res.status >= 500);

  const ctrl = new AbortController();
  const onExternalAbort = () => ctrl.abort();
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);

  try {
    const { timeoutMs: _t, retries: _r, backoffMs: _b, retryOn: _ro, signal: _s, ...init } = opts;
    void _t; void _r; void _b; void _ro; void _s;
    const res = await fetch(url, { ...init, signal: ctrl.signal });

    if (retryOn(res)) {
      throw new SyncError('transient', `HTTP ${res.status}`, { status: res.status, attempts: attempt });
    }
    if (!res.ok) {
      // 재시도 대상이 아닌 !ok (보통 4xx) — 영구적 오류로 즉시 throw
      throw new SyncError('permanent', `HTTP ${res.status}`, { status: res.status, attempts: attempt });
    }
    return res;
  } catch (e) {
    if (e instanceof SyncError) throw e;

    // AbortError: 두 출처 — 외부 signal 또는 자체 timeout
    if (e instanceof DOMException && e.name === 'AbortError') {
      if (externalSignal?.aborted) {
        // 외부 취소 — 재시도하지 않도록 permanent 로 표기
        throw new SyncError('permanent', 'aborted', { attempts: attempt, cause: e });
      }
      if (timedOut) {
        throw new SyncError('timeout', `timeout after ${timeoutMs}ms`, { attempts: attempt, cause: e });
      }
      // 그 외 (드문 케이스) — transient 로 처리해 한 번 더 시도해 봄
      throw new SyncError('transient', 'aborted', { attempts: attempt, cause: e });
    }

    // 네트워크 오류 (TypeError: Failed to fetch 등)
    const msg = e instanceof Error ? e.message : String(e);
    throw new SyncError('transient', msg || 'network error', { attempts: attempt, cause: e });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * timeout + 재시도 + 오류 분류가 적용된 fetch.
 *
 * 성공 응답(또는 retryOn 을 통과하지 못한 4xx)은 그대로 반환.
 * 호출자는 평소처럼 res.ok 를 검사할 수 있으며, !ok 인 4xx 도 res 로 받는다.
 *
 * 모든 재시도가 소진되면 마지막 SyncError 가 throw 되며, attempts 에 총 시도 횟수가 기록된다.
 */
export async function resilientFetch(url: string, opts: ResilientOptions = {}): Promise<Response> {
  const retries = opts.retries ?? DEFAULT_RETRIES;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const externalSignal = opts.signal ?? undefined;

  const totalAttempts = retries + 1;
  let lastError: SyncError | undefined;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    if (externalSignal?.aborted) {
      throw new SyncError('permanent', 'aborted', { attempts: attempt - 1 || 1 });
    }
    try {
      return await fetchOnce(url, opts, externalSignal, attempt);
    } catch (e) {
      const err = e as SyncError;
      lastError = err;

      // permanent 는 재시도하지 않음
      if (err.kind === 'permanent') throw err;

      // 마지막 시도였으면 그대로 throw
      if (attempt >= totalAttempts) {
        err.attempts = attempt;
        throw err;
      }

      // 재시도 직전 backoff
      const baseDelay = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 1000;
      const delay = jitter(baseDelay);
      console.warn(
        `[resilientFetch] retry ${attempt}/${retries} in ${Math.round(delay)}ms — ${err.kind}: ${err.message}`,
      );
      try {
        await sleep(delay, externalSignal);
      } catch {
        throw new SyncError('permanent', 'aborted', { attempts: attempt });
      }
    }
  }

  // 도달 불능 — 안전망
  throw lastError ?? new SyncError('transient', 'unknown', { attempts: totalAttempts });
}
