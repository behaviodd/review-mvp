import type { User, UserRole, OrgUnit, OrgUnitType, SecondaryOrgAssignment } from '../types';

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

  // '역할' = 자유 텍스트 (구 '직책'). 레거시 '직책' 컬럼도 폴백으로 읽음.
  const position   = str(row['역할']) || str(row['직책']);
  const managerRaw = str(row['보고대상(사번)']);

  // VALID_ROLES 값('admin'/'leader'/'member')이 역할 컬럼에 있으면 역할로 인식(레거시 호환)
  // 그 외엔 직책 키워드로 파생하거나 'member'로 기본 처리
  const roleRaw = str(row['역할']);
  const role: UserRole = VALID_ROLES.includes(roleRaw as UserRole)
    ? (roleRaw as UserRole)
    : deriveRole(position);

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
    isActive: true,
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
