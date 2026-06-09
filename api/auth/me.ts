/**
 * GET /api/auth/me
 * 세션 쿠키 검증 → 사용자 정보 반환
 * 페이지 로드 시 세션 복원에 사용
 */
import { getSessionToken, verifySession } from '../lib/session';

export const config = { runtime: 'edge' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const token = getSessionToken(request);
  if (!token) return json({ error: '세션이 없습니다' }, 401);

  const payload = await verifySession(token);
  if (!payload) return json({ error: '세션이 만료됐거나 유효하지 않습니다' }, 401);

  return json({
    email:   payload.sub,
    name:    payload.name,
    picture: payload.picture,
    exp:     payload.exp,
  });
}
