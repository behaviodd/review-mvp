/**
 * 인증 API — /api/org-sync 프록시를 통해 Apps Script _계정 탭과 통신
 * 비밀번호는 SHA-256 해시로 브라우저에서 변환 후 전송
 *
 * 초기 비밀번호 정책:
 *   - 계정 생성 시 passwordHash = "" (빈값)
 *   - 로그인 시 빈 hash → 사번(userId) SHA-256과 비교
 *   - 관리자 초기화 = passwordHash를 다시 "" 로 설정
 */

import { getScriptHeaders } from './scriptHeaders';

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 내부 POST — 실패 시 실제 원인을 throw */
async function post(action: string, data: Record<string, string | boolean>): Promise<Record<string, unknown>> {
  let rawBody = '';
  try {
    const res = await fetch('/api/org-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
      body: JSON.stringify({ action, data }),
    });
    rawBody = await res.text();
    if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status}): ${rawBody.slice(0, 200)}`);
  } catch (e) {
    // 네트워크 오류 또는 위에서 던진 HTTP 오류
    throw e instanceof Error ? e : new Error(String(e));
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    // Apps Script가 JSON 대신 HTML 등을 반환한 경우
    throw new Error(`응답 파싱 오류 — 받은 내용: ${rawBody.slice(0, 300)}`);
  }
}

/**
 * 이메일 + 비밀번호로 로그인 검증.
 * 성공: { userId, isTemp } 반환
 * 실패: 실제 원인 메시지로 throw
 */
export async function verifyLogin(
  email: string,
  password: string,
): Promise<{ userId: string; isTemp: boolean }> {
  const passwordHash = await sha256(password);
  const json = await post('verifyLogin', { email: email.toLowerCase(), passwordHash });
  if (json.error) throw new Error(String(json.error));
  if (!json.userId) throw new Error('응답에 userId가 없습니다.');
  return { userId: String(json.userId), isTemp: json.isTemp === true };
}

/** 비밀번호 변경 */
export async function changePassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const passwordHash = await sha256(newPassword);
    const json = await post('setPassword', { userId, passwordHash, isTemp: false });
    return json.ok === true;
  } catch {
    return false;
  }
}

/** 계정 초기화 (관리자 전용) — passwordHash를 빈값으로 설정 */
export async function resetAccount(userId: string): Promise<boolean> {
  try {
    const json = await post('resetAccount', { userId });
    return json.ok === true;
  } catch {
    return false;
  }
}

/** 신규 구성원 계정 초기화 */
export async function initAccount(userId: string, email: string): Promise<boolean> {
  try {
    const json = await post('initAccount', { userId, email: email.toLowerCase() });
    return json.ok === true;
  } catch {
    return false;
  }
}

/** 관리자 전용 — _구성원 전체를 _계정 탭에 일괄 등록 (이미 있는 행은 유지) */
export async function batchInitAccounts(): Promise<{ ok: boolean; created: number }> {
  try {
    const json = await post('batchInitAccounts', {});
    return { ok: json.ok === true, created: Number(json.created ?? 0) };
  } catch {
    return { ok: false, created: 0 };
  }
}
