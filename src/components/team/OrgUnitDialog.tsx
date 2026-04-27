import { useEffect, useMemo, useState } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsInput, MsSelect } from '../ui/MsControl';
import { ModalShell } from '../review/modals/ModalShell';
import { isUserActive } from '../../utils/userCompat';
import { ORG_TYPE_LABEL, ORG_TYPE_PLACEHOLDER } from '../../utils/teamUtils';
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

  // state 가 바뀌면 폼을 동기화 (다이얼로그가 다른 노드용으로 다시 열릴 때)
  useEffect(() => {
    if (!state) return;
    setName(state.mode === 'edit' ? state.unit.name : '');
    setHeadId(state.mode === 'edit' ? (state.unit.headId ?? '') : '');
  }, [state]);

  const eligibleHeads = useMemo(() => users.filter(u => isUserActive(u)), [users]);

  if (!state) return null;

  const isEdit = state.mode === 'edit';
  const title = isEdit
    ? `${ORG_TYPE_LABEL[type]} 편집`
    : `${ORG_TYPE_LABEL[type]} 추가${parentUnit ? ` — ${parentUnit.name}` : ''}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isEdit && editing) {
      updateOrgUnit(editing.id, { name: trimmed, headId: headId || undefined });
      showToast('success', '조직 정보를 저장했습니다.');
    } else {
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
      widthClass="max-w-md"
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
        <MsInput
          autoFocus
          label={`${ORG_TYPE_LABEL[type]} 이름 *`}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={ORG_TYPE_PLACEHOLDER[type]}
        />
        <MsSelect label="조직장" value={headId} onChange={e => setHeadId(e.target.value)}>
          <option value="">미지정</option>
          {eligibleHeads.map(u => <option key={u.id} value={u.id}>{u.name} · {u.position}</option>)}
        </MsSelect>
      </form>
    </ModalShell>
  );
}
