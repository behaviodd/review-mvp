import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';

/** 로컬 개발용 org-sync 미들웨어 플러그인
 *  GET / POST 모두 지원. redirect: 'follow' 로 Apps Script 리다이렉트 처리.
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
              const up = await fetch(scriptUrl, {
                method:   'POST',
                headers:  { 'Content-Type': 'application/json' },
                body:     payload,
                redirect: 'follow',
              });
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
