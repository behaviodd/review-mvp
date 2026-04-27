import type {
  User, UserRole, OrgUnit, OrgUnitType, SecondaryOrgAssignment,
  ActivityStatus, ReviewerAssignment, ReviewerAssignmentSource, OrgSnapshot, ImpersonationLog,
} from '../types';

/* ── 아바타 색상: 사번 해시로 자동 배정 ─────────────────────────────── */
const AVATAR_COLORS = [
  '#4f46e5', '#059669', '#0891b2', '#7c3aed', '#0369a1',
  '#6d28d9', '#0f766e', '#be185d', '#b45309', '#dc2626',
];

function colorFromId(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ── 역할 파생 ────────────────────────────────────────────────────────── */
// '역할' 컬럼이 자유 텍스트가 된 이후로는 admin 키워드만 감지.
// 조직장(leader) 여부는 OrgUnit.headId 로만 결정.
const ADMIN_KEYWORDS = ['대표이사', '대표', 'CEO', 'ceo'];
const VALID_ROLES: UserRole[] = ['admin', 'leader', 'member'];

function deriveRole(position: string): UserRole {
  if (ADMIN_KEYWORDS.some(k => position.includes(k))) return 'admin';
  return 'member';
}

/* ── 날짜 문자열 정규화 ──────────────────────────────────────────────── */
function normalizeDate(raw: string): string | undefined {
  if (!raw) return undefined;

  // YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD
  const isoMatch = raw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;

  // Apps Script Date.toString() 형식: "Mon Jan 01 2024 00:00:00 GMT+0900 (...)"
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }

  return raw || undefined;
}

/* ── 단일 행 파싱 ────────────────────────────────────────────────────── */
type SheetRow = Record<string, unknown>;

/** Apps Script 는 숫자/boolean 등을 그대로 반환하므로 문자열로 변환 */
function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

export function parseSheetUser(row: SheetRow): User | null {
  const id   = str(row['사번']);
  const name = str(row['성명']);
  if (!id || !name) return null;

  // '역할' = 자유 텍스트 직책. 값이 권한 키워드(admin/leader/member)면 직책이 아님.
  const rawPos = str(row['역할']) || str(row['직책']);
  const position = VALID_ROLES.includes(rawPos as UserRole) ? '' : rawPos;
  const managerRaw = str(row['보고대상(사번)']);

  // '권한' 전용 컬럼 우선 → 없으면 레거시 '역할' 컬럼 → 없으면 직책 키워드로 파생
  const permRaw = str(row['권한']);
  const roleRaw = str(row['역할']);
  const role: UserRole = VALID_ROLES.includes(permRaw as UserRole)
    ? (permRaw as UserRole)
    : VALID_ROLES.includes(roleRaw as UserRole)
      ? (roleRaw as UserRole)
      : deriveRole(position);

  // R1: 신규 컬럼 (있으면 사용, 없으면 undefined)
  const orgUnitId      = str(row['주조직ID']) || undefined;
  const rawStatus      = str(row['상태분류']);
  const validStatuses: ActivityStatus[] = ['active', 'leave_short', 'leave_long', 'terminated', 'other'];
  const activityStatus = validStatuses.includes(rawStatus as ActivityStatus)
    ? (rawStatus as ActivityStatus)
    : undefined;
  const statusChangedAt = str(row['상태변경일시']) || undefined;
  const statusReason    = str(row['상태사유']) || undefined;

  return {
    id,
    name,
    email:      str(row['이메일']),
    department: str(row['주조직']),
    subOrg:     str(row['부조직'])   || undefined,
    team:       str(row['팀'])       || undefined,
    squad:      str(row['스쿼드'])   || undefined,
    position,
    role,
    managerId:  managerRaw || undefined,
    avatarColor: colorFromId(id),
    nameEn:          str(row['영문이름']) || undefined,
    phone:           str(row['연락처'])   || undefined,
    joinDate:        normalizeDate(str(row['입사일'])),
    jobFunction:     str(row['직무'])     || undefined,
    isActive: str(row['재직 여부']).toLowerCase() !== 'false',
    // R1
    orgUnitId,
    activityStatus,
    statusChangedAt,
    statusReason,
  };
}

/* ── 조직 단위 파싱 ──────────────────────────────────────────────────── */
export function parseOrgUnit(row: SheetRow): OrgUnit | null {
  const id = str(row['조직ID']);
  const name = str(row['조직명']);
  if (!id || !name) return null;
  const validTypes: OrgUnitType[] = ['mainOrg', 'subOrg', 'team', 'squad'];
  const rawType = str(row['조직유형']) as OrgUnitType;
  const type: OrgUnitType = validTypes.includes(rawType) ? rawType : 'team';
  return {
    id,
    name,
    type,
    parentId: str(row['상위조직ID']) || undefined,
    headId:   str(row['조직장사번']) || undefined,
    order:    parseInt(str(row['순서']), 10) || 0,
  };
}

export function parseOrgUnits(rows: SheetRow[]): OrgUnit[] {
  return rows.map(parseOrgUnit).filter((u): u is OrgUnit => u !== null);
}

/* ── 겸임 파싱 ───────────────────────────────────────────────────────── */
export function parseSecondaryOrg(row: SheetRow): SecondaryOrgAssignment | null {
  const userId = str(row['사번']);
  const orgId  = str(row['겸임조직ID']);
  if (!userId || !orgId) return null;
  const ratioRaw = parseFloat(str(row['겸임비율']));
  // '겸임역할' 컬럼 우선, 레거시 '겸임직책' 폴백
  const role = str(row['겸임역할']) || str(row['겸임직책']) || undefined;
  return {
    userId,
    orgId,
    orgName:   str(row['겸임조직명']) || undefined,
    role,
    startDate: str(row['시작일']),
    endDate:   str(row['종료일'])    || undefined,
    ratio:     isNaN(ratioRaw)       ? undefined : ratioRaw,
    note:      str(row['비고'])      || undefined,
  };
}

export function parseSecondaryOrgs(rows: SheetRow[]): SecondaryOrgAssignment[] {
  return rows.map(parseSecondaryOrg).filter((a): a is SecondaryOrgAssignment => a !== null);
}

/* ── R1: 평가권 시트 파싱 ──────────────────────────────────────── */
const VALID_RA_SOURCES: ReviewerAssignmentSource[] = ['org_head_inherited', 'manual', 'excel_import'];
export function parseReviewerAssignment(row: SheetRow): ReviewerAssignment | null {
  const id         = str(row['평가권ID']);
  const revieweeId = str(row['피평가자사번']);
  const reviewerId = str(row['평가자사번']);
  if (!id || !revieweeId || !reviewerId) return null;
  const rank   = parseInt(str(row['차수']), 10) || 1;
  const rawSrc = str(row['부여출처']);
  const source: ReviewerAssignmentSource = VALID_RA_SOURCES.includes(rawSrc as ReviewerAssignmentSource)
    ? (rawSrc as ReviewerAssignmentSource)
    : 'manual';
  return {
    id,
    revieweeId,
    reviewerId,
    rank,
    source,
    startDate: str(row['시작일']) || new Date().toISOString(),
    endDate:   str(row['종료일']) || undefined,
    createdAt: str(row['생성일시']) || new Date().toISOString(),
    createdBy: str(row['생성자']) || 'unknown',
    note:      str(row['비고']) || undefined,
  };
}

export function parseReviewerAssignments(rows: SheetRow[]): ReviewerAssignment[] {
  return rows.map(parseReviewerAssignment).filter((a): a is ReviewerAssignment => a !== null);
}

/* ── R1: 인사 스냅샷 시트 파싱 ─────────────────────────────────── */
export function parseOrgSnapshot(row: SheetRow): OrgSnapshot | null {
  const id = str(row['스냅샷ID']);
  if (!id) return null;
  const payloadRaw = str(row['payloadJSON']);
  let payload: { users: User[]; orgUnits: OrgUnit[]; assignments: ReviewerAssignment[] } = {
    users: [], orgUnits: [], assignments: [],
  };
  try {
    if (payloadRaw) payload = JSON.parse(payloadRaw);
  } catch (e) {
    console.warn('[parseOrgSnapshot] payload parse failed', id, e);
  }
  return {
    id,
    createdAt:   str(row['생성일시']) || new Date().toISOString(),
    createdBy:   str(row['생성자']) || 'unknown',
    description: str(row['설명']),
    users:       payload.users ?? [],
    orgUnits:    payload.orgUnits ?? [],
    assignments: payload.assignments ?? [],
  };
}

export function parseOrgSnapshots(rows: SheetRow[]): OrgSnapshot[] {
  return rows.map(parseOrgSnapshot).filter((s): s is OrgSnapshot => s !== null);
}

/* ── R1: 마스터 로그인 감사 로그 파싱 ──────────────────────────── */
export function parseImpersonationLog(row: SheetRow): ImpersonationLog | null {
  const id = str(row['로그ID']);
  const actorId = str(row['작업자사번']);
  const targetUserId = str(row['대상사번']);
  if (!id || !actorId || !targetUserId) return null;
  return {
    id,
    actorId,
    targetUserId,
    startedAt: str(row['시작일시']) || new Date().toISOString(),
    endedAt:   str(row['종료일시']) || undefined,
    ip:        str(row['IP']) || undefined,
    userAgent: str(row['UserAgent']) || undefined,
  };
}

export function parseImpersonationLogs(rows: SheetRow[]): ImpersonationLog[] {
  return rows.map(parseImpersonationLog).filter((l): l is ImpersonationLog => l !== null);
}

/* ── 배열 파싱 ───────────────────────────────────────────────────────── */
export function parseSheetUsers(rows: SheetRow[]): User[] {
  const users = rows
    .map(parseSheetUser)
    .filter((u): u is User => u !== null);

  if (users.length === 0) return users;

  // 시트에 admin 키워드(대표이사, CEO 등)가 없는 경우,
  // 보고 대상이 비어 있는 최상위 구성원을 admin으로 자동 지정
  const hasAdmin = users.some(u => u.role === 'admin');
  if (!hasAdmin) {
    const allManagerIds = new Set(users.map(u => u.managerId).filter(Boolean));
    // 다른 사람이 보고하는 대상이면서 본인은 보고 대상이 없는 사람 = 최상위
    const top =
      users.find(u => !u.managerId && allManagerIds.has(u.id)) ??
      users.find(u => !u.managerId) ??
      users[0];
    top.role = 'admin';
  }

  return users;
}
