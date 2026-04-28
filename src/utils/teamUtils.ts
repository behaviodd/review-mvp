import type { OrgUnit, OrgUnitType, User } from '../types';

/* ── R7: 조직 균일 5단계 ─────────────────────────────────────────────
 *   depth 0 = 주조직, depth 1~4 = 하위 조직 1~4. 최대 5단계.
 *   기존 4종 type(mainOrg/subOrg/team/squad) 은 호환 보존을 위해 유지하되,
 *   화면 표시·자식 추가 가능 여부는 depth 기준으로 판단합니다.
 */

export const MAX_ORG_DEPTH = 4; // 0(주조직) ~ 4(하위 조직 4) — 총 5단계

/** depth 0 = 주조직, depth N (1≤N≤4) = 하위 조직 N. */
export function getOrgLevelLabel(depth: number): string {
  if (depth <= 0) return '주조직';
  return `하위 조직 ${depth}`;
}

/** depth 별 placeholder. */
export function getOrgLevelPlaceholder(depth: number): string {
  if (depth <= 0) return '예) 개발본부';
  if (depth === 1) return '예) 플랫폼부';
  if (depth === 2) return '예) 프론트엔드팀';
  return '예) 플랫폼스쿼드';
}

/** OrgUnit 의 트리 depth (루트=0). 부모를 따라 올라가며 카운트. */
export function getOrgDepth(unit: OrgUnit | undefined, units: OrgUnit[]): number {
  if (!unit) return 0;
  let depth = 0;
  let cursor: OrgUnit | undefined = unit;
  const seen = new Set<string>();
  while (cursor && cursor.parentId && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    cursor = units.find(u => u.id === cursor!.parentId);
    if (cursor) depth += 1;
    if (depth > 10) break; // 안전 가드
  }
  return depth;
}

/** 부모 단위에 자식을 추가했을 때 5단계 제한을 초과하는지 검증.
 *  parent 가 undefined 면 루트(depth 0) 추가 — 항상 OK.
 *  반환: ok=true 면 가능, ok=false 면 reason 에 사유. */
export function validateOrgDepth(parent: OrgUnit | undefined, units: OrgUnit[]):
  { ok: true } | { ok: false; reason: string } {
  if (!parent) return { ok: true };
  const parentDepth = getOrgDepth(parent, units);
  if (parentDepth + 1 > MAX_ORG_DEPTH) {
    return { ok: false, reason: `최대 ${MAX_ORG_DEPTH + 1}단계까지만 만들 수 있습니다.` };
  }
  return { ok: true };
}

/** R7: 부모 체인 내에서 한 OrgUnit 의 type 추정 (legacy 호환). */
export function inferTypeByDepth(depth: number): OrgUnitType {
  if (depth <= 0) return 'mainOrg';
  if (depth === 1) return 'subOrg';
  if (depth === 2) return 'team';
  return 'squad'; // depth ≥ 3 — squad 자기재귀로 표현
}

/** @deprecated R7 — getOrgLevelLabel(depth) 사용. R3 호환을 위해 유지. */
export const ORG_TYPE_LABEL: Record<OrgUnitType, string> = {
  mainOrg: '주조직', subOrg: '하위 조직 1', team: '하위 조직 2', squad: '하위 조직 3',
};

/** @deprecated R7 — getOrgLevelPlaceholder 사용. */
export const ORG_TYPE_PLACEHOLDER: Record<OrgUnitType, string> = {
  mainOrg: '예) 개발본부', subOrg: '예) 플랫폼부', team: '예) 프론트엔드팀', squad: '예) 플랫폼스쿼드',
};

/** @deprecated R7 — depth 기반 검증으로 대체. depth+1 ≤ 4 면 자식 추가 가능. */
export const ORG_TYPE_NEXT: Record<OrgUnitType, OrgUnitType | null> = {
  mainOrg: 'subOrg', subOrg: 'team', team: 'squad', squad: 'squad',
};

export const AVATAR_COLORS = [
  '#4f46e5','#059669','#0891b2','#7c3aed','#0369a1',
  '#6d28d9','#0f766e','#be185d','#b45309','#dc2626',
];

export type OrgSel = {
  mainOrgId: string;
  subOrgId: string;
  teamId: string;
  squadId: string;
};

export function buildInitOrgSel(orgId: string | undefined, orgUnits: OrgUnit[]): OrgSel {
  const result: OrgSel = { mainOrgId: '', subOrgId: '', teamId: '', squadId: '' };
  if (!orgId) return result;
  let unit: OrgUnit | undefined = orgUnits.find(u => u.id === orgId);
  while (unit) {
    if (unit.type === 'mainOrg') result.mainOrgId = unit.id;
    else if (unit.type === 'subOrg') result.subOrgId = unit.id;
    else if (unit.type === 'team') result.teamId = unit.id;
    else if (unit.type === 'squad') result.squadId = unit.id;
    const parentId = unit.parentId;
    unit = parentId ? orgUnits.find(u => u.id === parentId) : undefined;
  }
  return result;
}

export function buildOrgSelFromMember(member: User, orgUnits: OrgUnit[]): OrgSel {
  const mainOrg = orgUnits.find(u => u.type === 'mainOrg' && u.name === member.department);
  const subOrg  = mainOrg && member.subOrg
    ? orgUnits.find(u => u.type === 'subOrg' && u.parentId === mainOrg.id && u.name === member.subOrg)
    : undefined;
  const team    = member.team  ? orgUnits.find(u => u.type === 'team'  && u.name === member.team)  : undefined;
  const squad   = member.squad ? orgUnits.find(u => u.type === 'squad' && u.name === member.squad) : undefined;
  return { mainOrgId: mainOrg?.id ?? '', subOrgId: subOrg?.id ?? '', teamId: team?.id ?? '', squadId: squad?.id ?? '' };
}

export function resolveOrgNamesFromSel(sel: OrgSel, orgUnits: OrgUnit[]) {
  return {
    department: orgUnits.find(u => u.id === sel.mainOrgId)?.name,
    subOrg:  sel.subOrgId  ? orgUnits.find(u => u.id === sel.subOrgId)?.name  : undefined,
    team:    sel.teamId    ? orgUnits.find(u => u.id === sel.teamId)?.name    : undefined,
    squad:   sel.squadId   ? orgUnits.find(u => u.id === sel.squadId)?.name   : undefined,
  };
}
