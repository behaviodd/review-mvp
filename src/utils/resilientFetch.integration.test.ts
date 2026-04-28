/**
 * resilientFetch 실제 네트워크 통합 테스트.
 * - 로컬 HTTP 서버를 띄워 mock fetch 가 아닌 실제 fetch 호출 경로를 검증한다.
 * - 5xx → 200 회복, 4xx 즉시 실패, timeout 실제 발생 등 production-shaped 케이스.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { resilientFetch, SyncError } from './resilientFetch';

type Handler = (req: http.IncomingMessage, res: http.ServerResponse) => void;

let server: http.Server;
let port = 0;
let handler: Handler = (_req, res) => res.end();

beforeAll(async () => {
  server = http.createServer((req, res) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

afterEach(() => {
  handler = (_req, res) => res.end();
});

const url = (path = '/') => `http://127.0.0.1:${port}${path}`;
const fastBackoff = { backoffMs: [10, 10] };

describe('resilientFetch — 실제 네트워크', () => {
  it('5xx → 200 회복: 504 두 번 후 200', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      if (calls <= 2) {
        res.writeHead(504);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, attempt: calls }));
    };

    const res = await resilientFetch(url('/flaky'), fastBackoff);
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, attempt: 3 });
  });

  it('5xx 영구: 504 항상 → 3회 시도 후 transient SyncError', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      res.writeHead(504);
      res.end();
    };

    const err = await resilientFetch(url('/dead'), fastBackoff).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err).toMatchObject({ kind: 'transient', status: 504, attempts: 3 });
    expect(calls).toBe(3);
  });

  it('4xx: 404 → permanent SyncError, 재시도 없음', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      res.writeHead(404);
      res.end('not found');
    };

    const err = await resilientFetch(url('/missing'), fastBackoff).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err).toMatchObject({ kind: 'permanent', status: 404, attempts: 1 });
    expect(calls).toBe(1);
  });

  it('timeout 실제 발생: hang → AbortController 가 끊고 재시도', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      if (calls === 1) {
        // 첫 호출은 응답하지 않고 hang — timeout 이 발동할 때까지 대기
        // (서버가 socket 을 닫지 않으므로 클라이언트 abort 가 유일한 종료 경로)
        return;
      }
      // 두 번째 호출은 즉시 200
      res.writeHead(200);
      res.end('ok');
    };

    const t0 = Date.now();
    const res = await resilientFetch(url('/slow'), { ...fastBackoff, timeoutMs: 150 });
    const elapsed = Date.now() - t0;
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    // 첫 시도 timeout(~150ms) + backoff(~10ms) + 두 번째 시도(~즉시) → 150-400ms 범위
    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(2000);
  });

  it('timeout 영구: 모든 시도가 hang → kind=timeout SyncError', async () => {
    handler = () => {
      // 영원히 hang
    };

    const err = await resilientFetch(url('/hang'), {
      ...fastBackoff,
      timeoutMs: 100,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SyncError);
    expect(err).toMatchObject({ kind: 'timeout', attempts: 3 });
  });

  it('정상 응답 — 시도 1회만, latency 정상 범위', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [1, 2, 3] }));
    };

    const t0 = Date.now();
    const res = await resilientFetch(url('/ok'));
    const elapsed = Date.now() - t0;
    expect(res.status).toBe(200);
    expect(calls).toBe(1);
    expect(elapsed).toBeLessThan(500); // 로컬 호출은 항상 sub-500ms
    const body = await res.json();
    expect(body.data).toEqual([1, 2, 3]);
  });

  it('백오프 시간 측정 — 2회 재시도 사이 backoffMs 만큼 대기', async () => {
    handler = (_req, res) => {
      res.writeHead(503);
      res.end();
    };

    const t0 = Date.now();
    await resilientFetch(url('/503'), { backoffMs: [50, 100], retries: 2 }).catch(() => undefined);
    const elapsed = Date.now() - t0;
    // 1차 즉시 + 50ms backoff + 2차 즉시 + 100ms backoff + 3차 즉시
    // jitter ±20% 고려해 총 대기 ≥ (50 + 100) * 0.8 = 120ms, 합리적 상한 < 500ms
    expect(elapsed).toBeGreaterThanOrEqual(120);
    expect(elapsed).toBeLessThan(500);
  });

  it('JSON body 정상 파싱 — 호출자 측 흐름 검증', async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rows: [{ id: 'u1' }, { id: 'u2' }], etag: 'abc' }));
    };

    const res = await resilientFetch(url('/rows'));
    const data = await res.json();
    expect(data.rows).toHaveLength(2);
    expect(data.etag).toBe('abc');
  });

  it('첫 시도 hang 후 자동 재시도 → 두 번째 즉시 성공 시 데이터 정상', async () => {
    let calls = 0;
    handler = (_req, res) => {
      calls += 1;
      if (calls === 1) return; // hang
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ recovered: true }));
    };

    const res = await resilientFetch(url('/recovery'), { timeoutMs: 100, backoffMs: [10] });
    const body = await res.json();
    expect(body.recovered).toBe(true);
  });
});
