/**
 * Vercel Edge Function — 리뷰 운영 데이터 Apps Script CORS 프록시
 *
 * GET  ?action=getCycles|getTemplates|getSubmissions
 *   - 18s 자체 timeout
 *   - 5xx / timeout / 네트워크 오류 시 1회 재시도
 *
 * POST { action, data } → upsertCycle | upsertTemplate | deleteTemplate | upsertSubmission
 *   - 18s 자체 timeout, **재시도 안 함** (멱등성 보호)
 *
 * 환경변수 REVIEW_SCRIPT_URL 필요
 */
export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

  const headerUrl = request.headers.get('X-Script-Url') ?? '';
  const scriptUrl = process.env.APPS_SCRIPT_URL
    || process.env.REVIEW_SCRIPT_URL
    || (headerUrl.startsWith('https://script.google.com/') ? headerUrl : '');
  if (!scriptUrl) return json({ error: 'Apps Script URL이 설정되지 않았습니다. 설정 → Google Sheets 연동에서 URL을 입력해 주세요.' }, 500);

  /* ── GET (1회 재시도) ────────────────────────────────────────── */
  if (request.method === 'GET') {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') ?? 'getCycles';
    try {
      const { res, attempts } = await callUpstream(`${scriptUrl}?action=${action}`, {
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

  /* ── POST (재시도 없음 — 멱등성 보호) ───────────────────────── */
  if (request.method === 'POST') {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const payload = await request.text();

      // redirect:'follow' 는 302 를 GET 으로 변환하여 doPost 대신 doGet 이 호출됨.
      // redirect:'manual' 로 직접 302 Location 을 따라가야 doPost 가 올바르게 실행됨.
      let res = await fetch(scriptUrl, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/json' },
        body:     payload,
        redirect: 'manual',
        signal:   ctrl.signal,
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location') ?? res.headers.get('Location');
        if (location) res = await fetch(location, { redirect: 'follow', signal: ctrl.signal });
      }

      const body = await res.text();
      clearTimeout(timer);

      if (body.trimStart().startsWith('<')) {
        return json({
          error: 'Apps Script URL이 HTML을 반환했습니다. 배포 설정(액세스: 모든 사용자)을 확인하세요.',
        });
      }

      return new Response(body, {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof DOMException && e.name === 'AbortError') {
        return json({ error: `Apps Script 응답 시간 초과 (${UPSTREAM_TIMEOUT_MS}ms) — 잠시 후 다시 시도해 주세요` }, 504);
      }
      return json({ error: `쓰기 오류: ${String(e)}` }, 502);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
