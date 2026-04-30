import { useState } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { MsButton } from '../ui/MsButton';
import { MsCheckbox, MsInput, MsSelect } from '../ui/MsControl';
import { MsPlusIcon, MsDeleteIcon } from '../ui/MsIcons';
import { getOrgDepth, getOrgLevelLabel } from '../../utils/teamUtils';
import type { SecondaryOrgAssignment } from '../../types';

export function SecondaryOrgSection({ userId }: { userId: string }) {
  const { orgUnits, secondaryOrgs, upsertSecondaryOrg, removeSecondaryOrg, updateOrgUnit } = useTeamStore();
  const myAssignments = secondaryOrgs.filter(a => a.userId === userId);
  const [adding, setAdding] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState('');
  const [form, setForm] = useState({ orgId: '', role: '', isHead: false, startDate: '', endDate: '', ratio: '' });

  const allOrgs = orgUnits.filter(u => u.type !== 'squad');

  const handleAdd = () => {
    if (!form.orgId) return;
    const org = orgUnits.find(u => u.id === form.orgId);
    upsertSecondaryOrg({
      userId, orgId: form.orgId, orgName: org?.name,
      role:      form.role || undefined,
      startDate: form.startDate || new Date().toISOString().slice(0, 10),
      endDate:   form.endDate || undefined,
      ratio:     form.ratio ? parseFloat(form.ratio) : undefined,
    });
    if (form.isHead) updateOrgUnit(form.orgId, { headId: userId });
    else if (org?.headId === userId) updateOrgUnit(form.orgId, { headId: undefined });
    setAdding(false);
    setForm({ orgId: '', role: '', isHead: false, startDate: '', endDate: '', ratio: '' });
  };

  const toggleHead = (a: SecondaryOrgAssignment) => {
    const unit = orgUnits.find(u => u.id === a.orgId);
    if (unit?.headId === userId) updateOrgUnit(a.orgId, { headId: undefined });
    else updateOrgUnit(a.orgId, { headId: userId });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide">겸임 조직</p>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-pink-050 hover:text-pink-060 font-medium">
            <MsPlusIcon size={12} className="size-3" /> 추가
          </button>
        )}
      </div>
      {myAssignments.length === 0 && !adding && (
        <p className="text-xs text-fg-subtlest py-1">겸임 조직이 없습니다.</p>
      )}
      {myAssignments.map(a => {
        const isHead    = orgUnits.find(u => u.id === a.orgId)?.headId === userId;
        const isEditing = editingOrgId === a.orgId;
        return (
          <div key={`${a.userId}-${a.orgId}`}
            className="p-2.5 rounded-lg bg-gray-005 border border-gray-010 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-xs font-medium text-gray-080">{a.orgName ?? a.orgId}</p>
                {isHead && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-green-010 text-green-060 rounded border border-green-020 flex-shrink-0">조직장</span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <MsCheckbox size="md" checked={isHead} onChange={() => toggleHead(a)} label={<span className="text-[10px] font-medium text-fg-subtle">조직장</span>} />
                <button onClick={() => removeSecondaryOrg(userId, a.orgId)}
                  className="p-1 text-gray-030 hover:text-red-040 transition-colors ml-1">
                  <MsDeleteIcon size={12} className="size-3.5" />
                </button>
              </div>
            </div>
            {isEditing ? (
              <div className="flex gap-1.5">
                <MsInput
                  autoFocus
                  size="sm"
                  value={editingRole}
                  onChange={e => setEditingRole(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      upsertSecondaryOrg({ ...a, role: editingRole || undefined });
                      setEditingOrgId(null);
                    } else if (e.key === 'Escape') {
                      setEditingOrgId(null);
                    }
                  }}
                  placeholder="역할 입력..."
                />
                <MsButton type="button" size="sm" onClick={() => { upsertSecondaryOrg({ ...a, role: editingRole || undefined }); setEditingOrgId(null); }} className="flex-shrink-0">저장</MsButton>
                <MsButton type="button" variant="ghost" size="sm" onClick={() => setEditingOrgId(null)} className="flex-shrink-0">취소</MsButton>
              </div>
            ) : (
              <button type="button"
                onClick={() => { setEditingOrgId(a.orgId); setEditingRole(a.role ?? ''); }}
                className="text-xs text-fg-subtlest hover:text-gray-070 text-left w-full truncate transition-colors">
                {a.role ? a.role : <span className="italic">역할 없음 · 클릭해서 입력</span>}
                {a.ratio ? ` · ${a.ratio}%` : ''}
              </button>
            )}
          </div>
        );
      })}
      {adding && (
        <div className="p-3 rounded-lg border border-pink-010 bg-pink-005/40 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <MsSelect
                label="겸임 조직"
                value={form.orgId}
                onChange={e => setForm(f => ({ ...f, orgId: e.target.value }))}
              >
                <option value="">선택</option>
                {allOrgs.map(u => <option key={u.id} value={u.id}>{u.name} ({getOrgLevelLabel(getOrgDepth(u, orgUnits))})</option>)}
              </MsSelect>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <MsInput
                    label="역할"
                    type="text"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    placeholder="예) 프로덕트 디자이너"
                  />
                </div>
                <MsCheckbox size="md" checked={form.isHead} onChange={e => setForm(f => ({ ...f, isHead: e.target.checked }))} label={<span className="text-xs font-medium text-gray-060">조직장</span>} className="pt-5" />
              </div>
            </div>
            <MsInput
              label="시작일"
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            />
            <MsInput
              label="종료일"
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            />
            <div className="col-span-2">
              <MsInput
                label="겸임 비율 (%)"
                type="number"
                min="0"
                max="100"
                value={form.ratio}
                onChange={e => setForm(f => ({ ...f, ratio: e.target.value }))}
                placeholder="예) 30"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <MsButton type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setForm({ orgId: '', role: '', isHead: false, startDate: '', endDate: '', ratio: '' }); }}>취소</MsButton>
            <MsButton type="button" size="sm" onClick={handleAdd} disabled={!form.orgId}>저장</MsButton>
          </div>
        </div>
      )}
    </div>
  );
}
