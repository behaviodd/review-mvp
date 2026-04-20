/**
 * Vercel Edge Function — 리뷰 운영 데이터 Apps Script CORS 프록시
 *
 * GET  ?action=getCycles|getTemplates|getSubmissions
 * POST { action, data } → upsertCycle | upsertTemplate | deleteTemplate | upsertSubmission
 *
 * 환경변수 REVIEW_SCRIPT_URL 필요
 */
export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const scriptUrl = process.env.REVIEW_SCRIPT_URL;
  if (!scriptUrl) return json({ error: 'REVIEW_SCRIPT_URL 환경변수가 설정되지 않았습니다.' }, 500);

  /* ── GET ─────────────────────────────────────────────────────── */
  if (request.method === 'GET') {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') ?? 'getCycles';
    try {
      const res  = await fetch(`${scriptUrl}?action=${action}`, {
        headers:  { Accept: 'application/json' },
        redirect: 'follow',
      });
      const body = await res.text();
      return new Response(body, {
        headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });
    } catch (e) {
      return json({ error: `읽기 오류: ${String(e)}` }, 502);
    }
  }

  /* ── POST ────────────────────────────────────────────────────── */
  if (request.method === 'POST') {
    try {
      const payload = await request.text();
      const res = await fetch(scriptUrl, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/json' },
        body:     payload,
        redirect: 'follow',
      });
      const body = await res.text();
      return new Response(body, {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return json({ error: `쓰기 오류: ${String(e)}` }, 502);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
