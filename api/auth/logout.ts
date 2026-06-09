/**
 * POST /api/auth/logout
 * 세션 쿠키 삭제
 */
import { clearSessionCookieHeader } from '../lib/session';

export const config = { runtime: 'edge' };

export default function handler(request: Request): Response {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookieHeader(),
    },
  });
}
