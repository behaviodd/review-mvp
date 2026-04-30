import { useMemo, useState } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsInput } from '../ui/MsControl';
import { ModalShell } from '../review/modals/ModalShell';
import { AVATAR_COLORS, getOrgDepth, getOrgLevelLabel } from '../../utils/teamUtils';
import type { OrgUnit, OrgUnitType } from '../../types';

/**
 * 조직 트리에서 아이콘 클릭 → 포커싱된 그룹에 빠르게 구성원 추가하는 팝업.
 * 풀 폼은 /team/new 페이지에서 제공하고, 이 다이얼로그는 이름·이메일·직무만.
 *
 * 조직(orgUnit) 의 각 단계에 따라 department/subOrg/team/squad 를 자동 설정한다.
 */
export function QuickAddMemberDialog({
  open,
  onClose,
  orgUnit,
}: {
  open: boolean;
  onClose: () => void;
  orgUnit: OrgUnit | null;
}) {
  const { orgUnits, createMember } = useTeamStore();
  const showToast = useShowToast();

  const [form, setForm] = useState({ name: '', email: '', position: '' });
  const [submitting, setSubmitting] = useState(false);

  const reset = () => setForm({ name: '', email: '', position: '' });

  // 클릭한 조직 노드까지의 부모 체인을 따라가 mainOrg/subOrg/team/squad 이름 채움
  const orgPath = useMemo(() => {
    if (!orgUnit) return { department: '', subOrg: undefined as string | undefined, team: undefined as string | undefined, squad: undefined as string | undefined };
    const chain: OrgUnit[] = [];
    let cur: OrgUnit | undefined = orgUnit;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parentId ? orgUnits.find(u => u.id === cur!.parentId) : undefined;
    }
    const byType: Partial<Record<OrgUnitType, string>> = {};
    chain.forEach(u => { byType[u.type] = u.name; });
    return {
      department: byType.mainOrg ?? '',
      subOrg: byType.subOrg,
      team: byType.team,
      squad: byType.squad,
    };
  }, [orgUnit, orgUnits]);

  if (!orgUnit) return null;

  const isValid = !!form.name.trim() && !!form.email.trim();
  const orgLabel = `${orgUnit.name} (${getOrgLevelLabel(getOrgDepth(orgUnit, orgUnits))})`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await createMember({
        name: form.name.trim(),
        email: form.email.trim(),
        position: form.position.trim() || '',
        role: 'member',
        department: orgPath.department || '미배정',
        subOrg: orgPath.subOrg,
        team: orgPath.team,
        squad: orgPath.squad,
        managerId: orgUnit.headId || undefined,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      });
      showToast('success', `${form.name.trim()}님을 ${orgUnit.name}에 추가했습니다.`);
      reset();
      onClose();
    } catch (err) {
      showToast('error', '구성원 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title="구성원 추가"
      description={`${orgLabel}에 추가됩니다`}
      widthClass="max-w-md"
      footer={
        <>
          <MsButton type="button" variant="ghost" onClick={handleClose} disabled={submitting}>취소</MsButton>
          <MsButton type="submit" form="quick-add-member-form" loading={submitting} disabled={!isValid}>
            추가
          </MsButton>
        </>
      }
    >
      <form id="quick-add-member-form" onSubmit={handleSubmit} className="space-y-3">
        <MsInput
          autoFocus
          label="이름 *"
          type="text"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="홍길동"
        />
        <MsInput
          label="이메일 *"
          type="email"
          value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
          placeholder="name@company.com"
        />
        <MsInput
          label="직책"
          type="text"
          value={form.position}
          onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
          placeholder="예) 프론트엔드 개발자"
        />
        <p className="pt-1 text-[11px] text-fg-subtlest">
          상세 정보(연락처·입사일·겸임 등)는 추가 후 프로필 편집에서 입력할 수 있습니다.
        </p>
      </form>
    </ModalShell>
  );
}
