import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

/** 로컬 개발용 org-sync 미들웨어 플러그인
 *  GET: redirect:'follow' / POST: redirect:'manual' + 재POST (Vercel edge와 동일 로직)
 */
function orgSyncDevPlugin(scriptUrl: string, path = '/api/org-sync'): Plugin {
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
              const up = await fetch(`${scriptUrl}?${qs}`, {
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
              const payload = Buffer.concat(chunks).toString();

              // Apps Script exec URL은 302 리다이렉트 반환.
              // redirect:'follow' 시 POST→GET 변환으로 doPost 미실행 → manual 처리
              const postOnce = (url: string) =>
                fetch(url, {
                  method:   'POST',
                  headers:  { 'Content-Type': 'application/json' },
                  body:     payload,
                  redirect: 'manual',
                });

              let up = await postOnce(scriptUrl);
              if ([301, 302, 303, 307, 308].includes(up.status)) {
                const location = up.headers.get('location');
                if (location) up = await postOnce(location);
              }
              const body = await up.text();
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

export default defineConfig(({ mode }) => {
  const env            = loadEnv(mode, process.cwd(), '');
  const orgScriptUrl   = env.APPS_SCRIPT_URL    ?? '';
  const reviewScriptUrl = env.REVIEW_SCRIPT_URL ?? '';

  return {
    plugins: [
      react(),
      ...(orgScriptUrl    ? [orgSyncDevPlugin(orgScriptUrl,    '/api/org-sync')]    : []),
      ...(reviewScriptUrl ? [orgSyncDevPlugin(reviewScriptUrl, '/api/review-sync')] : []),
    ],
  };
});
