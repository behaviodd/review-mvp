/**
 * POST /api/auth/login
 * Google ID Token 검증 → 서버 세션 쿠키 발급 (7일)
 */
import { verifyGoogleIdToken } from '../lib/auth';
import { signSession, sessionCookieHeader } from '../lib/session';

export const config = { runtime: 'edge' };

function json(body: unknown, status = 200, extra?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extra ?? {}) },
  });
}

/** JWT payload 에서 name / picture 추출 (서명 미검증 — 이미 verifyGoogleIdToken 에서 완료) */
function extractClaims(token: string): { name: string; picture: string } {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
    const p   = JSON.parse(atob(pad)) as Record<string, unknown>;
    return {
      name:    String(p.name    ?? ''),
      picture: String(p.picture ?? ''),
    };
  } catch {
    return { name: '', picture: '' };
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let idToken = '';
  try {
    const body = await request.json() as Record<string, unknown>;
    idToken = String(body.idToken ?? '');
  } catch {
    return json({ error: '요청 본문을 파싱할 수 없습니다' }, 400);
  }

  if (!idToken) return json({ error: 'idToken이 필요합니다' }, 400);

  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const verified = await verifyGoogleIdToken(idToken, clientId);
  if (!verified) return json({ error: '유효하지 않거나 만료된 토큰입니다' }, 401);

  const { name, picture } = extractClaims(idToken);
  const sessionToken = await signSession({ sub: verified.email, name, picture });

  return json(
    { ok: true, email: verified.email },
    200,
    { 'Set-Cookie': sessionCookieHeader(sessionToken) },
  );
}
