import { useEffect, useMemo, useState } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsInput } from '../ui/MsControl';
import { UserSearchSelect } from '../ui/UserSearchSelect';
import { ModalShell } from '../review/modals/ModalShell';
import { isUserActive } from '../../utils/userCompat';
import { getOrgDepth, getOrgLevelLabel, getOrgLevelPlaceholder, validateOrgDepth } from '../../utils/teamUtils';
import { useStaleFormGuard } from '../../hooks/useStaleFormGuard';
import type { OrgUnit, OrgUnitType } from '../../types';

export type OrgUnitDialogState =
  | { mode: 'add'; type: OrgUnitType; parentId?: string }
  | { mode: 'edit'; unit: OrgUnit }
  | null;

/**
 * 조직 추가·편집 빠른 다이얼로그.
 * 트리에서 인라인으로 사용하며, 페이지 이동 없이 즉시 처리.
 */
export function OrgUnitDialog({
  state,
  onClose,
}: {
  state: OrgUnitDialogState;
  onClose: () => void;
}) {
  const { orgUnits, users, addOrgUnit, updateOrgUnit } = useTeamStore();
  const showToast = useShowToast();

  const editing = state?.mode === 'edit' ? state.unit : undefined;
  const type    = editing?.type ?? (state?.mode === 'add' ? state.type : 'mainOrg');
  const parentId = editing?.parentId ?? (state?.mode === 'add' ? state.parentId : undefined);
  const parentUnit = parentId ? orgUnits.find(u => u.id === parentId) : undefined;

  const [name, setName] = useState(editing?.name ?? '');
  const [headId, setHeadId] = useState(editing?.headId ?? '');

  // B2 — edit 모드에서 폼이 열린 동안 같은 조직 row 가 외부 갱신되면 경고.
  const staleGuard = useStaleFormGuard(editing);

  // state 가 바뀌면 폼을 동기화 (다이얼로그가 다른 노드용으로 다시 열릴 때) — 의도된 prop sync.
  useEffect(() => {
    if (!state) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(state.mode === 'edit' ? state.unit.name : '');
    setHeadId(state.mode === 'edit' ? (state.unit.headId ?? '') : '');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state]);

  const eligibleHeads = useMemo(() => users.filter(u => isUserActive(u)), [users]);

  if (!state) return null;

  const isEdit = state.mode === 'edit';
  // R7: depth 기반 라벨. edit 모드는 본인 depth, add 모드는 parent depth + 1.
  const depth = isEdit && editing
    ? getOrgDepth(editing, orgUnits)
    : (parentUnit ? getOrgDepth(parentUnit, orgUnits) + 1 : 0);
  const levelLabel = getOrgLevelLabel(depth);
  const title = isEdit
    ? `${levelLabel} 편집`
    : `${levelLabel} 추가${parentUnit ? ` — ${parentUnit.name}` : ''}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isEdit && editing) {
      updateOrgUnit(editing.id, { name: trimmed, headId: headId || undefined });
      showToast('success', '조직 정보를 저장했습니다.');
    } else {
      // R7: 5단계 제한 검증
      const check = validateOrgDepth(parentUnit, orgUnits);
      if (!check.ok) {
        showToast('error', check.reason);
        return;
      }
      const siblings = orgUnits.filter(u => u.type === type && u.parentId === parentId);
      const maxOrder = siblings.reduce((m, u) => Math.max(m, u.order), 0);
      addOrgUnit({ name: trimmed, type, parentId, headId: headId || undefined, order: maxOrder + 1 });
      showToast('success', `${trimmed}을(를) 추가했습니다.`);
    }
    onClose();
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <MsButton type="button" variant="ghost" onClick={onClose}>취소</MsButton>
          <MsButton type="submit" form="org-unit-dialog-form" disabled={!name.trim()}>
            {isEdit ? '저장' : '추가'}
          </MsButton>
        </>
      }
    >
      <form id="org-unit-dialog-form" onSubmit={handleSubmit} className="space-y-3">
        {staleGuard.isStale && editing && (
          <div className="rounded-lg border border-orange-020 bg-orange-005 p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-orange-070">다른 곳에서 이 조직의 정보가 변경되었어요.</p>
              <p className="text-xs text-orange-070 mt-0.5">저장하면 현재 화면의 값으로 덮어쓰여 다른 변경이 손실됩니다.</p>
            </div>
            <MsButton
              type="button"
              size="sm"
              variant="outline-default"
              onClick={() => {
                setName(editing.name);
                setHeadId(editing.headId ?? '');
                staleGuard.acknowledgeReload();
                showToast('info', '최신 정보로 다시 불러왔습니다.');
              }}
            >
              새로 불러오기
            </MsButton>
          </div>
        )}
        <MsInput
          autoFocus
          label={`${levelLabel} 이름 *`}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={getOrgLevelPlaceholder(depth)}
        />
        <UserSearchSelect
          label="조직장"
          value={headId}
          onChange={setHeadId}
          users={eligibleHeads}
        />
      </form>
    </ModalShell>
  );
}
