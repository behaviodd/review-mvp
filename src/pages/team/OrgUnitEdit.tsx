import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTeamStore } from '../../stores/teamStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput, MsSelect } from '../../components/ui/MsControl';
import { EmptyState } from '../../components/ui/EmptyState';
import { isUserActive } from '../../utils/userCompat';
import { ORG_TYPE_LABEL, ORG_TYPE_PLACEHOLDER } from '../../utils/teamUtils';
import type { OrgUnitType } from '../../types';

/**
 * /team/orgs/new?type=mainOrg&parentId=... — 새 조직 생성
 * /team/orgs/:id/edit — 기존 조직 편집
 */
export function OrgUnitEdit({ mode }: { mode: 'new' | 'edit' }) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [search] = useSearchParams();
  const { orgUnits, addOrgUnit, updateOrgUnit, users } = useTeamStore();
  const showToast = useShowToast();

  const editing = mode === 'edit' ? orgUnits.find(u => u.id === params.id) : undefined;
  const addType    = (search.get('type') as OrgUnitType | null) ?? 'mainOrg';
  const addParentId = search.get('parentId') ?? undefined;

  const type     = editing?.type ?? addType;
  const parentId = editing?.parentId ?? addParentId;
  const parentUnit = parentId ? orgUnits.find(u => u.id === parentId) : undefined;

  const [name,   setName]   = useState(editing?.name   ?? '');
  const [headId, setHeadId] = useState(editing?.headId ?? '');

  const eligibleHeads = useMemo(() => users.filter(u => isUserActive(u)), [users]);

  const title = mode === 'edit'
    ? `${ORG_TYPE_LABEL[type]} 편집`
    : `${ORG_TYPE_LABEL[type]} 추가${parentUnit ? ` — ${parentUnit.name}` : ''}`;

  useSetPageHeader(title, undefined, {
    onBack: () => navigate('/team'),
  });

  if (mode === 'edit' && !editing) {
    return (
      <EmptyState
        illustration="empty-list"
        title="조직을 찾을 수 없습니다."
        description="잘못된 경로이거나 삭제된 조직입니다."
        action={{ label: '구성원 목록으로', onClick: () => navigate('/team') }}
      />
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (mode === 'edit' && editing) {
      updateOrgUnit(editing.id, { name: name.trim(), headId: headId || undefined });
      showToast('success', '조직 정보를 저장했습니다.');
    } else {
      const siblings = orgUnits.filter(u => u.type === type && u.parentId === parentId);
      const maxOrder = siblings.reduce((m, u) => Math.max(m, u.order), 0);
      addOrgUnit({ name: name.trim(), type, parentId, headId: headId || undefined, order: maxOrder + 1 });
      showToast('success', `${name.trim()}을(를) 추가했습니다.`);
    }
    navigate('/team');
  };

  return (
    <div className="space-y-5 max-w-xl">
      <div className="bg-white rounded-xl border border-gray-020 shadow-card p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-010">
            <MsButton type="button" variant="ghost" onClick={() => navigate('/team')}>취소</MsButton>
            <MsButton type="submit" disabled={!name.trim()}>{mode === 'edit' ? '저장' : '추가'}</MsButton>
          </div>
        </form>
      </div>
    </div>
  );
}
