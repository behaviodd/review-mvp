import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTeamStore } from '../../stores/teamStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { MsSelect } from '../../components/ui/MsControl';
import { MsChevronRightLineIcon } from '../../components/ui/MsIcons';
import { EmptyState } from '../../components/ui/EmptyState';
import { OrgSelector } from '../../components/team/OrgSelector';
import { resolveOrgNamesFromSel } from '../../utils/teamUtils';

export function BulkMove() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const showToast = useShowToast();
  const { users, orgUnits, updateMember } = useTeamStore();

  const ids = useMemo(() => (search.get('ids') ?? '').split(',').filter(Boolean), [search]);
  const selectedUsers = useMemo(() => users.filter(u => ids.includes(u.id)), [users, ids]);

  const headIds    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const allLeaders = useMemo(() => users.filter(u => u.role === 'admin' || headIds.has(u.id)), [users, headIds]);

  const [orgSel, setOrgSel] = useState({ mainOrgId: '', subOrgId: '', teamId: '', squadId: '' });
  const [managerId, setManagerId] = useState<string>('__keep__');

  const mostSpecificId = orgSel.squadId || orgSel.teamId || orgSel.subOrgId || orgSel.mainOrgId;
  const mostSpecificUnit = orgUnits.find(u => u.id === mostSpecificId);

  // 조직 선택 변경 시 매니저 자동 채움 — 의도된 derived sync.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManagerId(mostSpecificUnit?.headId ?? '__keep__');
  }, [mostSpecificId]); // eslint-disable-line react-hooks/exhaustive-deps

  useSetPageHeader(`${selectedUsers.length}명 조직 이동`, undefined, {
    onBack: () => navigate('/team'),
  });

  if (selectedUsers.length === 0) {
    return (
      <EmptyState
        illustration="empty-list"
        title="이동할 구성원이 없습니다."
        description="구성원 목록에서 선택한 뒤 다시 시도해 주세요."
        action={{ label: '구성원 목록으로', onClick: () => navigate('/team') }}
      />
    );
  }

  const handleConfirm = () => {
    if (!orgSel.mainOrgId) return;
    const names = resolveOrgNamesFromSel(orgSel, orgUnits);
    const department = names.department ?? '';
    const subOrg = names.subOrg, team = names.team, squad = names.squad;
    selectedUsers.forEach(u => {
      const patch: Parameters<typeof updateMember>[1] = { department, subOrg, team, squad };
      if (managerId !== '__keep__') patch.managerId = managerId || undefined;
      updateMember(u.id, patch);
    });
    showToast('success', `${selectedUsers.length}명을 이동했습니다.`);
    navigate('/team');
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="py-2 space-y-5">
        {/* 선택된 구성원 미리보기 */}
        <section>
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">이동할 구성원</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-gray-005 rounded-lg border border-gray-010">
            {selectedUsers.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-white border border-gray-020 rounded-full text-gray-070 font-medium">
                <span
                  className="size-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                  style={{ backgroundColor: u.avatarColor }}
                >
                  {u.name[0]}
                </span>
                {u.name}
              </span>
            ))}
          </div>
        </section>

        {/* 이동할 조직 */}
        <section>
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">이동할 조직</p>
          {orgUnits.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={setOrgSel} />
            </div>
          ) : (
            <p className="text-xs text-fg-subtlest">등록된 조직 구조가 없습니다.</p>
          )}
        </section>

        {/* 보고 대상 */}
        <section>
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">보고 대상</p>
          <MsSelect label="" value={managerId} onChange={e => setManagerId(e.target.value)}>
            <option value="__keep__">변경하지 않음</option>
            <option value="">없음</option>
            {allLeaders.map(u => (
              <option key={u.id} value={u.id}>{u.name} · {u.position}</option>
            ))}
          </MsSelect>
        </section>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-010">
          <MsButton type="button" variant="ghost" onClick={() => navigate('/team')}>취소</MsButton>
          <MsButton
            type="button"
            disabled={!orgSel.mainOrgId}
            onClick={handleConfirm}
            leftIcon={<MsChevronRightLineIcon size={14} />}
          >
            이동 확정
          </MsButton>
        </div>
      </div>
    </div>
  );
}
