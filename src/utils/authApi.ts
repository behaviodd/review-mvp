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

async function post(action: string, data: Record<string, string | boolean>) {
  const res = await fetch('/api/org-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

/** 이메일 + 비밀번호로 로그인 검증. 성공 시 { userId, isTemp } 반환 */
export async function verifyLogin(
  email: string,
  password: string,
): Promise<{ userId: string; isTemp: boolean } | null> {
  try {
    const passwordHash = await sha256(password);
    const json = await post('verifyLogin', { email: email.toLowerCase(), passwordHash });
    if (json.error || !json.userId) return null;
    return { userId: String(json.userId), isTemp: json.isTemp === true };
  } catch {
    return null;
  }
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

/**
 * 계정 초기화 (관리자 전용)
 * passwordHash를 빈값으로 설정 → 다음 로그인 시 사번이 비밀번호가 됨
 */
export async function resetAccount(userId: string): Promise<boolean> {
  try {
    const json = await post('resetAccount', { userId });
    return json.ok === true;
  } catch {
    return false;
  }
}

/**
 * 신규 구성원 계정 초기화 (구성원 생성 시 자동 호출)
 * _계정 탭에 userId/email을 등록하고 passwordHash는 빈값으로 설정
 */
export async function initAccount(userId: string, email: string): Promise<boolean> {
  try {
    const json = await post('initAccount', { userId, email: email.toLowerCase() });
    return json.ok === true;
  } catch {
    return false;
  }
}
