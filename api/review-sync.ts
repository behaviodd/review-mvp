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
  const scriptUrl = process.env.APPS_SCRIPT_URL
    || process.env.REVIEW_SCRIPT_URL
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

      // redirect:'follow' 는 302 를 GET 으로 변환하여 doPost 대신 doGet 이 호출됨.
      // redirect:'manual' 로 직접 302 Location 을 따라가야 doPost 가 올바르게 실행됨.
      let res = await fetch(scriptUrl, {
        method:   'POST',
        headers:  { 'Content-Type': 'application/json' },
        body:     payload,
        redirect: 'manual',
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location') ?? res.headers.get('Location');
        if (location) res = await fetch(location, { redirect: 'follow' });
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
      return json({ error: `쓰기 오류: ${String(e)}` }, 502);
    }
  }

  return json({ error: 'Method not allowed' }, 405);
}
