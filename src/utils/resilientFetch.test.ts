import { afterEach, describe, expect, it, vi } from 'vitest';
import { resilientFetch, SyncError } from './resilientFetch';

/**
 * resilientFetch 동작 검증.
 * - 빠른 backoff (testBackoff = [1, 1]) 로 실시간 sleep 영향 없이 테스트.
 * - global fetch 를 vi.stubGlobal 로 교체.
 */

const fastBackoff = { backoffMs: [1, 1] };

function jsonRes(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resilientFetch', () => {
  it('200 즉시 성공 — 시도 1회', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resilientFetch('/x', fastBackoff);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('500 → 200 — 1회 재시도 후 성공', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes(500))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resilientFetch('/x', fastBackoff);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('500 × 3 — transient SyncError, attempts=3', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(504));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resilientFetch('/x', fastBackoff)).rejects.toMatchObject({
      name: 'SyncError',
      kind: 'transient',
      status: 504,
      attempts: 3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('404 — permanent SyncError, 재시도 없음', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resilientFetch('/x', fastBackoff)).rejects.toMatchObject({
      name: 'SyncError',
      kind: 'permanent',
      status: 404,
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('네트워크 오류 — transient 로 분류, 재시도', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonRes(200));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resilientFetch('/x', fastBackoff);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('네트워크 오류 × 3 — transient SyncError throw', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resilientFetch('/x', fastBackoff)).rejects.toMatchObject({
      name: 'SyncError',
      kind: 'transient',
      attempts: 3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('timeout — kind=timeout, 재시도', async () => {
    let calls = 0;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        // 1차 시도: signal 이 abort 되면 reject — timeoutMs 초과 시뮬레이션
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        });
      }
      // 2차 시도: 정상
      return Promise.resolve(jsonRes(200));
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await resilientFetch('/x', { ...fastBackoff, timeoutMs: 10 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('timeout × 3 — kind=timeout SyncError throw', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(resilientFetch('/x', { ...fastBackoff, timeoutMs: 5 })).rejects.toMatchObject({
      name: 'SyncError',
      kind: 'timeout',
      attempts: 3,
    });
  });

  it('외부 signal abort — permanent, 재시도 없음', async () => {
    const ctrl = new AbortController();
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = resilientFetch('/x', { ...fastBackoff, signal: ctrl.signal });
    // 비동기로 abort
    setTimeout(() => ctrl.abort(), 5);

    await expect(promise).rejects.toMatchObject({
      name: 'SyncError',
      kind: 'permanent',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('이미 abort 된 signal — fetch 호출도 안 함', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(resilientFetch('/x', { signal: ctrl.signal })).rejects.toMatchObject({
      kind: 'permanent',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retryOn 커스텀 — 4xx 도 재시도', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes(429))
      .mockResolvedValueOnce(jsonRes(200));
    vi.stubGlobal('fetch', fetchMock);

    const res = await resilientFetch('/x', {
      ...fastBackoff,
      retryOn: (r) => r.status === 429 || r.status >= 500,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries=0 — 재시도 없이 1회만 시도', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(resilientFetch('/x', { retries: 0 })).rejects.toMatchObject({
      kind: 'transient',
      attempts: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('SyncError 는 Error 의 instance 이며 메시지 가짐', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(503));
    vi.stubGlobal('fetch', fetchMock);

    const err = await resilientFetch('/x', fastBackoff).catch((e) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('503');
  });
});
