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

  const headerUrl = request.headers.get('X-Script-Url') ?? '';
  const scriptUrl = process.env.REVIEW_SCRIPT_URL
    || (headerUrl.startsWith('https://script.google.com/') ? headerUrl : '');
  if (!scriptUrl) return json({ error: 'Apps Script URL이 설정되지 않았습니다. 설정 → Google Sheets 연동에서 URL을 입력해 주세요.' }, 500);

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

      const postOnce = (url: string) =>
        fetch(url, {
          method:   'POST',
          headers:  { 'Content-Type': 'application/json' },
          body:     payload,
          redirect: 'manual',
        });

      let res = await postOnce(scriptUrl);
      if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
        const location = res.headers.get('location');
        if (location) res = await postOnce(location);
      }

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
