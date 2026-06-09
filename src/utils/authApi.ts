/**
 * 인증 API — Google SSO (makestar.com 도메인 제한)
 *
 * 흐름:
 *   1) 프런트가 Google Identity Services 로 ID Token(JWT) 획득
 *   2) /api/org-sync 프록시 → Apps Script `verifyGoogleLogin` 으로 전달
 *   3) Apps Script 가 Google `tokeninfo` 로 서명·aud·exp·hd·email_verified 검증
 *   4) `_구성원` 시트에서 이메일 매칭 → 사번(userId) 반환
 */

import { getScriptHeaders } from './scriptHeaders';

// ── 세션 쿠키 API ──────────────────────────────────────────────────────────────

/** 로그인 후 서버 세션 쿠키 발급. 실패해도 앱 로그인 흐름은 계속됨. */
export async function createSession(idToken: string): Promise<void> {
  try {
    await fetch('/api/auth/login', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ idToken }),
    });
  } catch { /* 세션 실패는 무시 — Bearer로 현재 요청 처리 */ }
}

/** 페이지 로드 시 세션 유효성 확인. 유효하면 email 반환, 아니면 null.
 *  dev: dev_session 쿠키 / prod: session 쿠키 모두 동일 엔드포인트에서 처리. */
export async function checkSession(): Promise<{ email: string } | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json() as { email: string };
  } catch {
    return null;
  }
}

/** 로그아웃 시 서버 세션 쿠키 삭제. */
export async function destroySession(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch { /* 무시 */ }
}

// overrideToken: 로그인 전 호출(verifyGoogleLogin)에서 credential 자체를 Bearer로 전달
async function post(action: string, data: Record<string, unknown>, overrideToken?: string): Promise<Record<string, unknown>> {
  let rawBody = '';
  try {
    const authHeaders = overrideToken
      ? { 'Authorization': `Bearer ${overrideToken}` }
      : getScriptHeaders();
    const res = await fetch('/api/org-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ action, data }),
    });
    rawBody = await res.text();
    if (!res.ok) throw new Error(`서버 오류 (HTTP ${res.status}): ${rawBody.slice(0, 200)}`);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }

  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    throw new Error(`응답 파싱 오류 — 받은 내용: ${rawBody.slice(0, 300)}`);
  }
}

/**
 * Google ID Token 으로 로그인 검증.
 * 응답 분기:
 *   - 기존 회원:    { status: 'active', userId, email }
 *   - 신규 회원:    { status: 'pending', userId: null, email, name }
 * 실패 (도메인 미일치/반려/만료/정합성 오류 등): throw.
 */
export type VerifyGoogleResult =
  | { status: 'active';  userId: string; email: string }
  | { status: 'pending'; userId: null;   email: string; name: string };

export async function verifyGoogleLogin(idToken: string): Promise<VerifyGoogleResult> {
  // 로그인 전 호출 — 저장된 토큰 없으므로 credential을 직접 Bearer로 전달
  const json = await post('verifyGoogleLogin', { idToken }, idToken);
  if (json.error) throw new Error(String(json.error));
  const status = String(json.status ?? 'active');
  const email = String(json.email ?? '');
  if (status === 'pending') {
    return { status: 'pending', userId: null, email, name: String(json.name ?? '') };
  }
  if (!json.userId) throw new Error('응답에 userId가 없습니다.');
  return { status: 'active', userId: String(json.userId), email };
}

/* ── R7: 신규 회원 승인 ───────────────────────────────────────── */

export interface PendingApprovalRecord {
  email: string;
  name: string;
  googleSub: string;
  firstLoginAt: string;
  status: 'pending';
}

/** /team 승인 대기 탭 + 사이드바 배지 카운트용. */
export async function getPendingApprovals(): Promise<PendingApprovalRecord[]> {
  const json = await post('getPendingApprovals', {});
  if (json.error) throw new Error(String(json.error));
  const items = Array.isArray(json.items) ? json.items : [];
  return items.map((it) => {
    const o = it as Record<string, unknown>;
    return {
      email:        String(o.email ?? ''),
      name:         String(o.name ?? ''),
      googleSub:    String(o.googleSub ?? ''),
      firstLoginAt: String(o.firstLoginAt ?? ''),
      status:       'pending' as const,
    };
  });
}

export interface ApproveMemberInput {
  email: string;
  userId: string;
  name: string;
  position?: string;     // 직책 (예: 팀장)
  jobFunction?: string;  // 직무 (예: 엔지니어) — 신규
  orgUnitId?: string;
  managerId?: string;    // 보고대상 사번 — 신규
  permissionGroupIds: string[];
  approverId: string;
}

export async function approveMember(input: ApproveMemberInput): Promise<{ ok: boolean; userId: string }> {
  const json = await post('approveMember', {
    email:              input.email.toLowerCase(),
    userId:             input.userId,
    name:               input.name,
    position:           input.position ?? '',
    jobFunction:        input.jobFunction ?? '',
    orgUnitId:          input.orgUnitId ?? '',
    managerId:          input.managerId ?? '',
    permissionGroupIds: input.permissionGroupIds,
    approverId:         input.approverId,
  });
  if (json.error) throw new Error(String(json.error));
  return { ok: json.ok === true, userId: String(json.userId ?? input.userId) };
}

export async function rejectMember(input: { email: string; reason?: string; approverId: string }): Promise<{ ok: boolean }> {
  const json = await post('rejectMember', {
    email:      input.email.toLowerCase(),
    reason:     input.reason ?? '',
    approverId: input.approverId,
  });
  if (json.error) throw new Error(String(json.error));
  return { ok: json.ok === true };
}
