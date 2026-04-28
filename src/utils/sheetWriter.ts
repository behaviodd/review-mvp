/**
 * 앱 → Google Sheets 쓰기 유틸리티
 * /api/org-sync 프록시를 통해 Apps Script doPost() 를 호출함.
 */
import type {
  User, OrgUnit, SecondaryOrgAssignment,
  ReviewerAssignment, OrgSnapshot, ImpersonationLog, PermissionGroup,
} from '../types';
import { getScriptHeaders } from './scriptHeaders';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';

/** 모든 시트 쓰기 직전에 호출 — useOrgSync 의 stale poll 덮어쓰기 방지. */
function markPendingWrite() {
  try { useSheetsSyncStore.getState().markWrite(); } catch { /* SSR / 초기화 전 안전 */ }
}

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
  const row: Record<string, string> = {
    '사번':           user.id,
    '주조직':         user.department    ?? '',
    '부조직':         user.subOrg        ?? '',
    '팀':             user.team          ?? '',
    '스쿼드':         user.squad         ?? '',
    '권한':           user.role,
    '직무':           user.jobFunction   ?? '',
    '성명':           user.name,
    '영문이름':       user.nameEn        ?? '',
    '입사일':         user.joinDate      ?? '',
    '연락처':         user.phone         ?? '',
    '이메일':         user.email,
    '재직 여부':      active ? 'true' : 'false',
    '보고대상(사번)':  user.managerId     ?? '',
    // R1: 신규 컬럼
    '주조직ID':       user.orgUnitId     ?? '',
    '상태분류':       user.activityStatus ?? '',
    '상태변경일시':   user.statusChangedAt ?? '',
    '상태사유':       user.statusReason  ?? '',
  };
  // position이 비어 있으면 역할 키를 생략 → patchRow가 기존 시트 값 유지
  if (user.position) row['역할'] = user.position;
  return row;
}

// R1: 평가권/스냅샷/임퍼소네이션 행 매핑

function reviewerAssignmentToRow(a: ReviewerAssignment): Record<string, string> {
  return {
    '평가권ID':     a.id,
    '피평가자사번': a.revieweeId,
    '평가자사번':   a.reviewerId,
    '차수':         String(a.rank),
    '부여출처':     a.source,
    '시작일':       a.startDate,
    '종료일':       a.endDate ?? '',
    '생성일시':     a.createdAt,
    '생성자':       a.createdBy,
    '비고':         a.note ?? '',
  };
}

function orgSnapshotToRow(s: OrgSnapshot): Record<string, string> {
  return {
    '스냅샷ID':   s.id,
    '생성일시':   s.createdAt,
    '생성자':     s.createdBy,
    '설명':       s.description,
    'payloadJSON': JSON.stringify({
      users: s.users,
      orgUnits: s.orgUnits,
      assignments: s.assignments,
    }),
  };
}

function permissionGroupToRow(g: PermissionGroup): Record<string, string> {
  return {
    '그룹ID':       g.id,
    '그룹명':       g.name,
    '설명':         g.description ?? '',
    '권한코드JSON': JSON.stringify(g.permissions),
    '멤버사번JSON': JSON.stringify(g.memberIds),
    '시스템그룹':   g.isSystem ? 'true' : 'false',
    '생성일시':     g.createdAt,
    '생성자':       g.createdBy,
  };
}

function impersonationLogToRow(l: ImpersonationLog): Record<string, string> {
  return {
    '로그ID':      l.id,
    '작업자사번':  l.actorId,
    '대상사번':    l.targetUserId,
    '시작일시':    l.startedAt,
    '종료일시':    l.endedAt   ?? '',
    'IP':          l.ip        ?? '',
    'UserAgent':   l.userAgent ?? '',
  };
}

function orgUnitToRow(u: OrgUnit): Record<string, string> {
  return {
    '조직ID':     u.id,
    '조직명':     u.name,
    '조직유형':   u.type ?? '',
    '상위조직ID': u.parentId    ?? '',
    '조직장사번': u.headId      ?? '',
    '순서':       String(u.order),
  };
}

function secondaryOrgToRow(a: SecondaryOrgAssignment): Record<string, string> {
  return {
    '사번':       a.userId,
    '겸임조직ID': a.orgId,
    '겸임조직명': a.orgName ?? '',
    '겸임역할':   a.role    ?? '',
    '시작일':     a.startDate,
    '종료일':     a.endDate ?? '',
    '겸임비율':   a.ratio !== undefined ? String(a.ratio) : '',
    '비고':       a.note    ?? '',
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
  markPendingWrite();
  const res = await fetch('/api/org-sync', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
    body:    JSON.stringify({ action, data }),
  });
  markPendingWrite();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PostResult>;
}

async function postPayload(payload: PostPayload): Promise<void> {
  markPendingWrite();
  const res = await fetch('/api/org-sync', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...getScriptHeaders() },
    body:    JSON.stringify(payload),
  });
  markPendingWrite();
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
  /**
   * N개 OrgUnit 을 1 HTTP 로 일괄 upsert.
   * Apps Script 에 `batchUpsertOrgUnits` 액션이 미배포면 N개 병렬 fallback.
   */
  batchUpsert: async (units: OrgUnit[]) => {
    if (units.length === 0) return;
    if (units.length === 1) {
      return orgUnitWriter.upsert(units[0]);
    }
    try {
      await postPayload({ action: 'batchUpsertOrgUnits', rows: units.map(orgUnitToRow) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/알 수 없는 action|Unknown action|action.*batchUpsertOrgUnits/i.test(msg)) {
        // Apps Script 미배포 — 병렬 fallback
        await Promise.allSettled(units.map(u => post('upsertOrgUnit', orgUnitToRow(u))));
      } else {
        console.error('[Sheet] orgUnit batchUpsert:', msg);
      }
    }
  },
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

/* ── R1: 평가권 시트 ──────────────────────────────────────────────── */
export const reviewerAssignmentWriter = {
  upsert: (a: ReviewerAssignment) =>
    post('upsertAssignment', reviewerAssignmentToRow(a))
      .catch(e => console.error('[Sheet] assignment upsert:', e)),
  end: (assignmentId: string, endDate: string) =>
    post('endAssignment', { '평가권ID': assignmentId, '종료일': endDate })
      .catch(e => console.error('[Sheet] assignment end:', e)),
};

/* ── R1: 인사 스냅샷 시트 ─────────────────────────────────────────── */
export const orgSnapshotWriter = {
  create: (s: OrgSnapshot) =>
    post('createSnapshot', orgSnapshotToRow(s))
      .catch(e => console.error('[Sheet] snapshot create:', e)),
};

/* ── R6: 권한 그룹 시트 ──────────────────────────────────────────── */
export const permissionGroupWriter = {
  upsert: (g: PermissionGroup) =>
    post('upsertPermissionGroup', permissionGroupToRow(g))
      .catch(e => console.error('[Sheet] permissionGroup upsert:', e)),
  delete: (id: string) =>
    post('deletePermissionGroup', { '그룹ID': id })
      .catch(e => console.error('[Sheet] permissionGroup delete:', e)),
};

/* ── R1: 마스터 로그인 감사 로그 시트 ──────────────────────────────── */
export const impersonationLogWriter = {
  start: (l: ImpersonationLog) =>
    post('logImpersonationStart', impersonationLogToRow(l))
      .catch(e => console.error('[Sheet] impersonation start:', e)),
  end: (logId: string, endedAt: string) =>
    post('logImpersonationEnd', { '로그ID': logId, '종료일시': endedAt })
      .catch(e => console.error('[Sheet] impersonation end:', e)),
};
