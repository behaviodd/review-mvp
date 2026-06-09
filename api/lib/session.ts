/**
 * 서버 세션 JWT — HS256 (HMAC-SHA256), Web Crypto API
 *
 * 쿠키명: session
 * 만료:   7일
 * 서명키: SESSION_SECRET 환경변수
 */

export const SESSION_COOKIE  = 'session';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 604800초

export interface SessionPayload {
  sub:     string; // email
  name:    string;
  picture: string;
  iat:     number;
  exp:     number;
}

// ── 인코딩 유틸 ────────────────────────────────────────────────────────────────

function toB64url(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

function enc(s: string): Uint8Array { return new TextEncoder().encode(s); }
function dec(b: Uint8Array): string  { return new TextDecoder().decode(b); }

// ── 키 로드 ────────────────────────────────────────────────────────────────────

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, [usage],
  );
}

// ── JWT sign / verify ──────────────────────────────────────────────────────────

export async function signSession(
  data: Pick<SessionPayload, 'sub' | 'name' | 'picture'>,
): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? '';
  if (!secret) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다');

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { ...data, iat: now, exp: now + SESSION_MAX_AGE };

  const h = toB64url(enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const b = toB64url(enc(JSON.stringify(payload)));
  const msg = enc(`${h}.${b}`);

  const key = await hmacKey(secret, 'sign');
  const sig = await crypto.subtle.sign('HMAC', key, msg);

  return `${h}.${b}.${toB64url(sig)}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const secret = process.env.SESSION_SECRET ?? '';
    if (!secret) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;

    const key   = await hmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify('HMAC', key, fromB64url(s), enc(`${h}.${b}`));
    if (!valid) return null;

    const payload = JSON.parse(dec(fromB64url(b))) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

// ── 쿠키 유틸 ─────────────────────────────────────────────────────────────────

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match  = cookie.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function sessionCookieHeader(token: string): string {
  return [
    `session=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE}`,
  ].join('; ');
}

export function clearSessionCookieHeader(): string {
  return 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}
