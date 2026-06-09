import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'node:crypto';

/** 로컬 개발용 org-sync 미들웨어 플러그인
 *  GET: redirect:'follow' / POST: redirect:'manual' + 재POST (Vercel edge와 동일 로직)
 *  Phase 2: INTERNAL_TOKEN을 GET 쿼리스트링 / POST body에 자동 주입 (Vercel Edge와 동일)
 */
function orgSyncDevPlugin(scriptUrl: string, internalToken: string, path = '/api/org-sync'): Plugin {
  return {
    name: `sync-dev-${path}`,
    configureServer(server) {
      server.middlewares.use(
        path,
        async (req: IncomingMessage, res: ServerResponse) => {
          // CORS preflight
          res.setHeader('Access-Control-Allow-Origin',  '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

          try {
            /* ── GET ──────────────────────────────────────────────────── */
            if (req.method === 'GET') {
              const qs = req.url?.split('?')[1] ?? '';
              const tokenQs = internalToken ? `&token=${encodeURIComponent(internalToken)}` : '';
              const up = await fetch(`${scriptUrl}?${qs}${tokenQs}`, {
                redirect: 'follow',
                headers:  { Accept: 'application/json' },
              });
              const body = await up.text();
              res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
              res.end(body);
              return;
            }

            /* ── POST ─────────────────────────────────────────────────── */
            if (req.method === 'POST') {
              const chunks: Buffer[] = [];
              await new Promise<void>(resolve => {
                req.on('data', (c: Buffer) => chunks.push(c));
                req.on('end', resolve);
              });
              const rawPayload = Buffer.concat(chunks).toString();
              const payload = internalToken
                ? JSON.stringify({ ...JSON.parse(rawPayload), token: internalToken })
                : rawPayload;

              // Apps Script POST-Redirect-GET 패턴:
              //   1) POST /exec  → Apps Script가 doPost 실행 후 302 반환
              //   2) 리다이렉트 URL을 GET으로 따라가면 doPost 결과를 받음
              // redirect:'follow' 는 302에서 POST→GET 변환 → 이것이 올바른 동작
              const up = await fetch(scriptUrl, {
                method:   'POST',
                headers:  { 'Content-Type': 'application/json' },
                body:     payload,
                redirect: 'follow',
              });

              const body = await up.text();

              if (body.trimStart().startsWith('<')) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  error: `Apps Script URL이 HTML을 반환했습니다. Apps Script 배포 설정에서 [액세스: 모든 사용자]로 되어 있는지 확인하세요.`,
                }));
                return;
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(body);
              return;
            }

            res.writeHead(405); res.end();
          } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: String(e) }));
          }
        },
      );
    },
  };
}

/**
 * 로컬 개발용 /api/auth/* 세션 시뮬레이터
 * - 인메모리 세션 스토어 (서버 재시작 시 초기화)
 * - Secure 플래그 없이 쿠키 설정 (HTTP localhost)
 * - Google ID Token 서명 검증 생략 (개발 편의)
 */
function authDevPlugin(): Plugin {
  const sessions = new Map<string, { email: string; exp: number }>();
  const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
  const COOKIE_OPTS = 'HttpOnly; SameSite=Strict; Path=/';

  function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
    try {
      const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    } catch { return null; }
  }

  function getSessionId(req: IncomingMessage): string | null {
    const cookies = req.headers.cookie ?? '';
    const m = cookies.match(/(?:^|;\s*)dev_session=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  return {
    name: 'auth-dev',
    configureServer(server) {
      server.middlewares.use('/api/auth', async (req: IncomingMessage, res: ServerResponse) => {
        const path = req.url?.split('?')[0] ?? '';
        res.setHeader('Content-Type', 'application/json');

        /* ── POST /api/auth/login ─────────────────────────────────────── */
        if (path === '/login' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          await new Promise<void>(r => { req.on('data', (c: Buffer) => chunks.push(c)); req.on('end', r); });
          let idToken = '';
          try { idToken = (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>).idToken as string; } catch { /**/ }

          const claims = idToken ? decodeJwtPayload(idToken) : null;
          const email = claims ? String(claims.email ?? '') : '';
          if (!email) { res.writeHead(401); res.end(JSON.stringify({ error: 'invalid token' })); return; }

          const sid = crypto.randomBytes(24).toString('hex');
          sessions.set(sid, { email, exp: Date.now() + SESSION_MAX_AGE });
          res.setHeader('Set-Cookie', `dev_session=${sid}; ${COOKIE_OPTS}; Max-Age=${SESSION_MAX_AGE / 1000}`);
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, email }));
          return;
        }

        /* ── GET /api/auth/me ─────────────────────────────────────────── */
        if (path === '/me' && req.method === 'GET') {
          const sid = getSessionId(req);
          const session = sid ? sessions.get(sid) : null;
          if (!session || session.exp < Date.now()) {
            if (sid) sessions.delete(sid);
            res.writeHead(401);
            res.end(JSON.stringify({ error: '세션 없음' }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ email: session.email, exp: Math.floor(session.exp / 1000) }));
          return;
        }

        /* ── POST /api/auth/logout ────────────────────────────────────── */
        if (path === '/logout' && req.method === 'POST') {
          const sid = getSessionId(req);
          if (sid) sessions.delete(sid);
          res.setHeader('Set-Cookie', `dev_session=; ${COOKIE_OPTS}; Max-Age=0`);
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env             = loadEnv(mode, process.cwd(), '');
  const orgScriptUrl    = env.APPS_SCRIPT_URL    ?? '';
  const reviewScriptUrl = env.REVIEW_SCRIPT_URL  ?? '';
  const internalToken   = env.INTERNAL_TOKEN     ?? '';

  return {
    plugins: [
      react(),
      authDevPlugin(),
      ...(orgScriptUrl    ? [orgSyncDevPlugin(orgScriptUrl,    internalToken, '/api/org-sync')]    : []),
      ...(reviewScriptUrl ? [orgSyncDevPlugin(reviewScriptUrl, internalToken, '/api/review-sync')] : []),
    ],
  };
});
