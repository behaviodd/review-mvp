/**
 * Google ID Token 검증 + 세션 쿠키 인증 — Vercel Edge Runtime
 * JWKS를 캐시해 매 요청 네트워크 없이 로컬 서명 검증.
 *
 * requireAuth() 우선순위:
 *   1) session 쿠키 (로그인 유지 시)
 *   2) Authorization: Bearer <Google ID Token> (최초 로그인 / 폴백)
 */
import { getSessionToken, verifySession } from './session';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ALLOWED_DOMAIN  = 'makestar.com';

// 모듈 스코프 캐시 (Edge 인스턴스 재사용 시 유지)
let certCache: { keys: Record<string, CryptoKey>; exp: number } | null = null;

function b64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

async function getKeys(): Promise<Record<string, CryptoKey>> {
  const now = Date.now();
  if (certCache && certCache.exp > now) return certCache.keys;

  const res  = await fetch(GOOGLE_JWKS_URL);
  const data = await res.json() as { keys: (JsonWebKey & { kid: string })[] };
  const cc   = res.headers.get('cache-control') ?? '';
  const maxAge = parseInt(cc.match(/max-age=(\d+)/)?.[1] ?? '3600');

  const keys: Record<string, CryptoKey> = {};
  await Promise.all(data.keys.map(async jwk => {
    if (!jwk.kid) return;
    keys[jwk.kid] = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify'],
    );
  }));

  certCache = { keys, exp: now + maxAge * 1_000 };
  return keys;
}

/** 검증 성공 시 { email } 반환, 실패 시 null */
export async function verifyGoogleIdToken(
  token: string,
  clientId: string,
): Promise<{ email: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const decoder = new TextDecoder();
    const header  = JSON.parse(decoder.decode(b64url(parts[0])));
    const payload = JSON.parse(decoder.decode(b64url(parts[1])));

    // 기본 클레임 검증
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(clientId)) return null;
    if (!['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss)) return null;
    if (payload.exp < Date.now() / 1_000) return null;
    if (!payload.email_verified) return null;
    if (!String(payload.email ?? '').endsWith(`@${ALLOWED_DOMAIN}`)) return null;

    // 서명 검증
    const keys = await getKeys();
    const key  = keys[header.kid];
    if (!key) return null;

    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig  = b64url(parts[2]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
    if (!valid) return null;

    return { email: String(payload.email) };
  } catch {
    return null;
  }
}

/** Edge Function 핸들러에서 요청 인증. 실패 시 401 Response 반환.
 *  쿠키 세션 → Bearer ID Token 순서로 시도. */
export async function requireAuth(request: Request): Promise<{ email: string } | Response> {
  // 1) 세션 쿠키 (새로고침 후에도 유효)
  const cookieToken = getSessionToken(request);
  if (cookieToken) {
    const session = await verifySession(cookieToken);
    if (session) return { email: session.sub };
    // 쿠키가 있지만 만료/위조 → Bearer 폴백 없이 즉시 거부
    return new Response(JSON.stringify({ error: '세션이 만료됐습니다. 다시 로그인해 주세요.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2) Bearer Google ID Token (로그인 직후 최초 요청 또는 쿠키 없는 환경)
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'GOOGLE_CLIENT_ID 환경변수 미설정' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return new Response(JSON.stringify({ error: '인증 토큰이 필요합니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await verifyGoogleIdToken(token, clientId);
  if (!result) {
    return new Response(JSON.stringify({ error: '유효하지 않거나 만료된 토큰입니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return result;
}
