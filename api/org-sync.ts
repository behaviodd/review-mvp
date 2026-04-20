/**
 * Vercel Edge Function — Apps Script CORS 프록시 (읽기 + 쓰기)
 *
 * GET  ?action=getOrg   → 조직 데이터 조회
 * POST { action, data } → 구성원 추가/수정/삭제 (Apps Script doPost 호출)
 *
 * 환경변수 APPS_SCRIPT_URL 필요
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
    || (headerUrl.startsWith('https://script.google.com/') ? headerUrl : '');
  if (!scriptUrl) return json({ error: 'Apps Script URL이 설정되지 않았습니다. 설정 → Google Sheets 연동에서 URL을 입력해 주세요.' }, 500);

  /* ── GET: 조직 데이터 읽기 ──────────────────────────────────────── */
  if (request.method === 'GET') {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') ?? 'getOrg';
    const etag   = searchParams.get('etag') ?? '';
    const qs = etag ? `action=${action}&etag=${encodeURIComponent(etag)}` : `action=${action}`;
    try {
      const res  = await fetch(`${scriptUrl}?${qs}`, {
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

  /* ── POST: 구성원 추가 / 수정 / 삭제 ───────────────────────────── */
  if (request.method === 'POST') {
    try {
      const payload = await request.text();

      // Apps Script exec URL은 302 리다이렉트를 반환함.
      // redirect:'follow' 시 POST→GET으로 변환되어 doPost가 실행되지 않음.
      // 따라서 redirect:'manual'로 리다이렉트 위치를 추출한 뒤 POST를 재전송.
      const postOnce = (url: string) =>
        fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    payload,
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
