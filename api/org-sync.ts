/**
 * Vercel Edge Function — Apps Script CORS 프록시 (읽기 + 쓰기)
 *
 * GET  ?action=getOrg|bulkGetAll|...
 *   - 18s 자체 timeout (Vercel Edge 25s 보다 짧게)
 *   - 5xx / timeout / 네트워크 오류 시 1회 재시도 — Apps Script cold start 흡수
 *   - 모두 실패 시 504 (timeout) 또는 502 (그 외) + 명확한 메시지
 *
 * POST { action, data } → Apps Script doPost
 *   - 18s 자체 timeout, **재시도 안 함** (멱등성 보호 — audit.append 등 중복 위험)
 *
 * 환경변수 APPS_SCRIPT_URL, GOOGLE_CLIENT_ID, ALLOWED_ORIGIN 필요
 */
import { requireAuth } from './lib/auth';

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN ?? 'https://review.makestar.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const UPSTREAM_TIMEOUT_MS = 18_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

interface UpstreamResult {
  res: Response;
  attempts: number;
}

/**
 * Apps Script 호출 with timeout + 재시도.
 * 5xx / timeout / 네트워크 오류 모두 transient 로 보고 retries 만큼 재시도.
 */
async function callUpstream(url: string, init: RequestInit, retries: number): Promise<UpstreamResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.status >= 500 && attempt <= retries) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      return { res, attempts: attempt };
    } catch (e) {
      clearTimeout(timer);
      lastError = e;
      if (attempt > retries) break;
    }
  }
  throw lastError ?? new Error('upstream failed');
}

function classifyError(e: unknown): { status: number; message: string } {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return { status: 504, message: `Apps Script 응답 시간 초과 (${UPSTREAM_TIMEOUT_MS}ms)` };
  }
  return { status: 502, message: `읽기 오류: ${String(e)}` };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // GET: 로그인 페이지에서 members 데이터 로드에 필요 → 인증 불필요
  // POST: 쓰기 작업 → 인증 필요
  if (request.method === 'POST') {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL ?? '';
  if (!scriptUrl) return json({ error: 'APPS_SCRIPT_URL 환경변수가 Vercel에 설정되지 않았습니다.' }, 500);

  // Phase 2: Apps Script 내부 토큰 (Vercel env → Apps Script 스크립트 속성)
  const internalToken = process.env.INTERNAL_TOKEN ?? '';

  /* ── GET: 조직 데이터 읽기 (1회 재시도) ─────────────────────────── */
  if (request.method === 'GET') {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') ?? 'getOrg';
    const etag   = searchParams.get('etag') ?? '';
    const tokenQs = internalToken ? `&token=${encodeURIComponent(internalToken)}` : '';
    const qs = (etag ? `action=${action}&etag=${encodeURIComponent(etag)}` : `action=${action}`) + tokenQs;
    try {
      const { res, attempts } = await callUpstream(`${scriptUrl}?${qs}`, {
        headers:  { Accept: 'application/json' },
        redirect: 'follow',
      }, 1);
      const body = await res.text();
      const headers: Record<string, string> = {
        ...CORS,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      };
      if (attempts > 1) headers['X-Proxy-Retries'] = String(attempts - 1);
      return new Response(body, { status: res.status, headers });
    } catch (e) {
      const { status, message } = classifyError(e);
      return json({ error: message }, status);
    }
  }

  /* ── POST: 구성원 추가 / 수정 / 삭제 (재시도 없음 — 멱등성 보호) ───
     B-2.3 (audit-B 매트릭스 B9): redirect chain 의 두 fetch 가 같은 ctrl 을
     공유하면 둘째 fetch 가 첫 fetch 의 잔여 시간만 가짐 (cold start 시 거의 0).
     변경: 첫 fetch 와 둘째 fetch 에 별도 AbortController 부여 + 전체 budget
     UPSTREAM_TIMEOUT_MS 안에서 동적 분배. location null 시 502 명시. */
  if (request.method === 'POST') {
    const startedAt = Date.now();
    const ctrl1 = new AbortController();
    const timer1 = setTimeout(() => ctrl1.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const rawPayload = await request.text();
      // Phase 2: 내부 토큰을 body에 주입
      const payload = internalToken
        ? JSON.stringify({ ...JSON.parse(rawPayload), token: internalToken })
        : rawPayload;

      // redirect:'follow' 는 302 를 GET 으로 변환하여 doPost 대신 doGet 이 호출됨.
      // redirect:'manual' 로 직접 302 Location 을 따라가야 doPost 가 올바르게 실행됨.
      let res = await fetch(scriptUrl, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/json' },
        body:     payload,
        redirect: 'manual',
        signal:   ctrl1.signal,
      });
      clearTimeout(timer1);

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location') ?? res.headers.get('Location');
        if (!location) {
          return json({
            error: 'Apps Script 가 redirect 응답에 Location 헤더를 포함하지 않았습니다. 배포 설정 확인이 필요합니다.',
          }, 502);
        }
        const remaining = UPSTREAM_TIMEOUT_MS - (Date.now() - startedAt);
        if (remaining < 1_000) {
          return json({
            error: `Apps Script redirect 처리 직전 budget 소진 (${UPSTREAM_TIMEOUT_MS}ms) — 잠시 후 다시 시도해 주세요`,
          }, 504);
        }
        const ctrl2 = new AbortController();
        const timer2 = setTimeout(() => ctrl2.abort(), remaining);
        try {
          res = await fetch(location, { redirect: 'follow', signal: ctrl2.signal });
        } finally {
          clearTimeout(timer2);
        }
      }

      const body = await res.text();

      if (body.trimStart().startsWith('<')) {
        return json({
          error: 'Apps Script URL이 HTML을 반환했습니다. 배포 설정(액세스: 모든 사용자)을 확인하세요.',
        });
      }

      return new Response(body, {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      clearTimeout(timer1);
      if (e instanceof DOMException && e.name === 'AbortError') {
        return json({ error: `Apps Script 응답 시간 초과 (${UPSTREAM_TIMEOUT_MS}ms) — 잠시 후 다시 시도해 주세요` }, 504);
      }
      return json({ error: `쓰기 오류: ${String(e)}` }, 502);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
