import type { OrgUnit, OrgUnitType, User } from '../types';

export const ORG_TYPE_LABEL: Record<OrgUnitType, string> = {
  mainOrg: '주조직', subOrg: '부조직', team: '팀', squad: '스쿼드',
};

export const ORG_TYPE_PLACEHOLDER: Record<OrgUnitType, string> = {
  mainOrg: '예) 개발본부', subOrg: '예) 플랫폼부', team: '예) 프론트엔드팀', squad: '예) 플랫폼스쿼드',
};

// R5-a: squad 가 squad 의 부모가 될 수 있도록 자기재귀 허용 → 5단계 이상 표현 가능.
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
