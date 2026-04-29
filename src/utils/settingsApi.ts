/**
 * 운영 설정 API — _설정 시트의 키/값 토글 조회·갱신.
 *
 * 흐름:
 *   - getSetting(key)        → GET  /api/org-sync?action=getSetting&key=<>
 *   - setSetting({key,...})  → POST /api/org-sync   { action:'setSetting', data:{...} }
 *
 * 현재 등록된 키:
 *   - auto_approve_domain — '@makestar.com' 첫 로그인 시 자동 등록 토글 ('true' | 'false')
 *
 * Apps Script 측 안전 기본값: 키 미존재 / 'true' 가 아닌 모든 값은 OFF 로 처리됨.
 */

import { getScriptHeaders } from './scriptHeaders';

export type SettingKey = 'auto_approve_domain';

export async function getSetting(key: SettingKey): Promise<string> {
  const res = await fetch(`/api/org-sync?action=getSetting&key=${encodeURIComponent(key)}`, {
    headers: getScriptHeaders(),
  });
  if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
  const json = (await res.json()) as { ok?: boolean; value?: string; error?: string };
  if (json.error) throw new Error(json.error);
  return String(json.value ?? '');
}

export async function setSetting(input: { key: SettingKey; value: string; modifierId: string }): Promise<{ ok: boolean }> {
  const res = await fetch('/api/org-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
    body: JSON.stringify({ action: 'setSetting', data: input }),
  });
  if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status})`);
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (json.error) throw new Error(json.error);
  return { ok: json.ok === true };
}
