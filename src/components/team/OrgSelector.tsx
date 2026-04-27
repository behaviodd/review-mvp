import { MsSelect } from '../ui/MsControl';
import type { OrgUnit } from '../../types';
import type { OrgSel } from '../../utils/teamUtils';

export function OrgSelector({
  orgUnits, value, onChange,
}: {
  orgUnits: OrgUnit[];
  value: OrgSel;
  onChange: (v: OrgSel) => void;
}) {
  if (orgUnits.length === 0) return null;

  const mainOrgs = orgUnits.filter(u => u.type === 'mainOrg').sort((a, b) => a.order - b.order);
  const subOrgs  = orgUnits.filter(u => u.type === 'subOrg'  && u.parentId === value.mainOrgId);
  const teams    = orgUnits.filter(u => u.type === 'team'    && u.parentId === (value.subOrgId || value.mainOrgId));
  const squads   = orgUnits.filter(u => u.type === 'squad'   && u.parentId === value.teamId);

  return (
    <div className="col-span-2 space-y-3">
      <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide">조직 배정</p>
      <div className="grid grid-cols-2 gap-3">
        <MsSelect
          label="주조직"
          value={value.mainOrgId}
          onChange={e => onChange({ mainOrgId: e.target.value, subOrgId: '', teamId: '', squadId: '' })}
        >
          <option value="">선택</option>
          {mainOrgs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </MsSelect>
        {(subOrgs.length > 0 || value.subOrgId) && (
          <MsSelect
            label="부조직"
            value={value.subOrgId}
            onChange={e => onChange({ ...value, subOrgId: e.target.value, teamId: '', squadId: '' })}
          >
            <option value="">선택 안 함</option>
            {subOrgs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </MsSelect>
        )}
        {(teams.length > 0 || value.teamId) && (
          <MsSelect
            label="팀"
            value={value.teamId}
            onChange={e => onChange({ ...value, teamId: e.target.value, squadId: '' })}
          >
            <option value="">선택 안 함</option>
            {teams.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </MsSelect>
        )}
        {(squads.length > 0 || value.squadId) && (
          <MsSelect
            label="스쿼드"
            value={value.squadId}
            onChange={e => onChange({ ...value, squadId: e.target.value })}
          >
            <option value="">선택 안 함</option>
            {squads.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </MsSelect>
        )}
      </div>
    </div>
  );
}
