import { OrgSearchSelect } from '../ui/OrgSearchSelect';
import { buildInitOrgSel, type OrgSel } from '../../utils/teamUtils';
import type { OrgUnit } from '../../types';

/**
 * 조직 배정 선택기. 단계별 드롭다운 → 단일 검색형 선택으로 통일(2026-06-12).
 * 외부 계약(OrgSel)은 유지 — 선택한 조직의 조상 체인을 buildInitOrgSel 로 모두 채워
 * mostSpecificOrgId / resolveOrgNamesFromSel 등 기존 소비처가 무수정 동작한다.
 */
export function OrgSelector({
  orgUnits, value, onChange,
}: {
  orgUnits: OrgUnit[];
  value: OrgSel;
  onChange: (v: OrgSel) => void;
}) {
  if (orgUnits.length === 0) return null;

  const selectedId = value.squadId || value.teamId || value.subOrgId || value.mainOrgId;

  return (
    <div className="col-span-2 space-y-3">
      <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide">조직 배정</p>
      <OrgSearchSelect
        label="주조직"
        orgUnits={orgUnits}
        value={selectedId}
        onChange={orgId => onChange(buildInitOrgSel(orgId, orgUnits))}
        placeholder="조직명 검색…"
      />
    </div>
  );
}
