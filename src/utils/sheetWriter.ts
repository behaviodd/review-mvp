/**
 * 앱 → Google Sheets 쓰기 유틸리티
 * /api/org-sync 프록시를 통해 Apps Script doPost() 를 호출함.
 */
import type { User, OrgUnit, SecondaryOrgAssignment } from '../types';

/* ── 사번 자동 생성 ────────────────────────────────────────────────── */
export function generateEmployeeId(users: User[]): string {
  const year   = String(new Date().getFullYear()); // "2026"
  const maxSeq = users
    .map(u => u.id)
    .filter(id => id.startsWith(year))
    .map(id => parseInt(id.slice(year.length), 10))
    .filter(n => !isNaN(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${year}${String(maxSeq + 1).padStart(3, '0')}`; // "2026001"
}

/* ── User → 시트 행 매핑 ──────────────────────────────────────────── */
function toSheetRow(user: User, active = true): Record<string, string> {
  return {
    '사번':           user.id,
    '주조직':         user.department,
    '부조직':         user.subOrg            ?? '',
    '팀':             user.team              ?? '',
    '스쿼드':         user.squad             ?? '',
    '직책':           user.position,
    '역할':           user.role,
    '겸임 조직':      user.secondaryDept     ?? '',
    '겸임 조직 직책':  user.secondaryPosition ?? '',
    '직무':           user.jobFunction       ?? '',
    '성명':           user.name,
    '영문이름':       user.nameEn            ?? '',
    '입사일':         user.joinDate          ?? '',
    '연락처':         user.phone             ?? '',
    '이메일':         user.email,
    '재직 여부':      active ? 'true' : 'false',
    '보고대상(사번)':  user.managerId         ?? '',
  };
}

function orgUnitToRow(u: OrgUnit): Record<string, string> {
  return {
    '조직ID':     u.id,
    '조직명':     u.name,
    '조직유형':   u.type,
    '상위조직ID': u.parentId    ?? '',
    '조직장사번': u.headId      ?? '',
    '순서':       String(u.order),
  };
}

function secondaryOrgToRow(a: SecondaryOrgAssignment): Record<string, string> {
  return {
    '사번':       a.userId,
    '겸임조직ID': a.orgId,
    '겸임조직명': a.orgName    ?? '',
    '겸임직책':   a.position,
    '시작일':     a.startDate,
    '종료일':     a.endDate    ?? '',
    '겸임비율':   a.ratio !== undefined ? String(a.ratio) : '',
    '비고':       a.note       ?? '',
  };
}

/* ── 공통 POST 전송 ───────────────────────────────────────────────── */
type PostPayload =
  | { action: string; data: Record<string, string> }
  | { action: string; rows: Record<string, string>[] };

type PostResult = { ok?: boolean; userId?: string; error?: string };

async function post(action: string, data: Record<string, string>): Promise<void> {
  await postPayload({ action, data });
}

async function postReturning(action: string, data: Record<string, string>): Promise<PostResult> {
  const res = await fetch('/api/org-sync', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PostResult>;
}

async function postPayload(payload: PostPayload): Promise<void> {
  const res = await fetch('/api/org-sync', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json() as PostResult;
  if (json.error) throw new Error(json.error);
}

/* ── 공개 API ─────────────────────────────────────────────────────── */
export const orgUnitWriter = {
  upsert: (unit: OrgUnit) =>
    post('upsertOrgUnit', orgUnitToRow(unit)).catch(e => console.error('[Sheet] orgUnit upsert:', e)),
  delete: (id: string) =>
    post('deleteOrgUnit', { '조직ID': id }).catch(e => console.error('[Sheet] orgUnit delete:', e)),
};

export const secondaryOrgWriter = {
  upsert: (a: SecondaryOrgAssignment) =>
    post('upsertSecondaryOrg', secondaryOrgToRow(a)).catch(e => console.error('[Sheet] secondaryOrg upsert:', e)),
  delete: (userId: string, orgId: string) =>
    post('deleteSecondaryOrg', { '사번': userId, '겸임조직ID': orgId }).catch(e => console.error('[Sheet] secondaryOrg delete:', e)),
};

export const sheetWriter = {
  /** 기존 구성원 정보 수정 */
  update: (user: User) =>
    post('updateUser', toSheetRow(user, user.isActive ?? true)).catch(e => console.error('[Sheet] update:', e)),

  /**
   * 신규 구성원 추가.
   * 사번을 비워서 전송하면 Apps Script가 전체 탭 스캔 후 다음 번호를 발급하고 반환.
   * 네트워크 오류 시 null 반환 → 호출 측에서 클라이언트 폴백 사용.
   */
  create: async (member: Omit<User, 'id'>): Promise<string | null> => {
    try {
      const row = toSheetRow({ id: '', ...member } as User);
      const json = await postReturning('createUser', row);
      if (json.error) throw new Error(json.error);
      return json.userId ?? null;
    } catch (e) {
      console.error('[Sheet] create:', e);
      return null;
    }
  },

  /** 사번이 이미 확정된 구성원을 시트에 기록 (클라이언트 폴백 전용) */
  createWithId: (user: User) =>
    post('createUser', toSheetRow(user)).catch(e => console.error('[Sheet] createWithId:', e)),

  /** 재직 여부 false 처리 (soft delete) */
  remove: (userId: string) =>
    post('deleteUser', { '사번': userId }).catch(e => console.error('[Sheet] remove:', e)),

  /**
   * 여러 구성원을 한 번의 HTTP 요청으로 일괄 upsert.
   * Apps Script 측에서 탭당 1회 읽기 후 일괄 쓰기.
   */
  batchUpsert: (users: User[]) =>
    postPayload({ action: 'batchUpsertUsers', rows: users.map(u => toSheetRow(u)) })
      .catch(e => console.error('[Sheet] batchUpsert:', e)),
};
