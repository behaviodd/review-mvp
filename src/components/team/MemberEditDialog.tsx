import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTeamStore } from '../../stores/teamStore';
import type { User } from '../../types';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsCheckbox, MsInput, MsSelect } from '../ui/MsControl';
import { MsCancelIcon } from '../ui/MsIcons';
import { ModalShell } from '../review/modals/ModalShell';
import { OrgSelector } from './OrgSelector';
import { SecondaryOrgSection } from './SecondaryOrgSection';
import { buildOrgSelFromMember, resolveOrgNamesFromSel } from '../../utils/teamUtils';

const TIER_LABEL: Record<string, string> = { admin: '관리자', leader: '조직장', member: '멤버' };
const TIER_COLOR: Record<string, string> = {
  admin:  'bg-blue-010 text-blue-070 border-blue-020',
  leader: 'bg-green-010 text-green-060 border-green-020',
  member: 'bg-gray-010 text-fg-subtle border-gray-020',
};

interface Props {
  /** 수정할 구성원 id. null 이면 컴포넌트가 mount 되지 않아 폼 상태가 매 진입 fresh. */
  userId: string | null;
  onClose: () => void;
}

/**
 * 구성원 정보 수정 팝업 — 풀 폼.
 * 부모가 userId 로 mount/unmount 제어 — 매 진입마다 폼 state 가 새로 초기화된다.
 */
export function MemberEditDialog({ userId, onClose }: Props) {
  if (!userId) return null;
  return <MemberEditDialogContent userId={userId} onClose={onClose} />;
}

function MemberEditDialogContent({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { users, orgUnits, updateMember, terminateMember, updateOrgUnit } = useTeamStore();
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();

  const member = users.find(u => u.id === userId);

  const headIds    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const allLeaders = useMemo(
    () => users.filter(u => (u.role === 'admin' || headIds.has(u.id)) && u.id !== userId),
    [users, headIds, userId],
  );

  const isCurrentAdmin = currentUser?.role === 'admin';
  const isSelf         = currentUser?.id === userId;
  const memberIsAdmin  = member?.role === 'admin';
  const memberIsLeader = !memberIsAdmin && headIds.has(userId);
  const memberTier     = memberIsAdmin ? 'admin' : memberIsLeader ? 'leader' : 'member';

  const [showTerminate, setShowTerminate] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().slice(0, 10));

  const [orgSel, setOrgSel] = useState(() => member ? buildOrgSelFromMember(member, orgUnits) : { mainOrgId: '', subOrgId: '', teamId: '', squadId: '' });

  const mostSpecificOrgId = orgSel.squadId || orgSel.teamId || orgSel.subOrgId || orgSel.mainOrgId;
  const currentUnit = mostSpecificOrgId ? orgUnits.find(u => u.id === mostSpecificOrgId) : null;
  const [isPrimaryHead, setIsPrimaryHead] = useState(() =>
    !!(mostSpecificOrgId && orgUnits.find(u => u.id === mostSpecificOrgId)?.headId === userId)
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPrimaryHead(!!(currentUnit?.headId === userId));
  }, [mostSpecificOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState(() => ({
    name:           member?.name           ?? '',
    nameEn:         member?.nameEn         ?? '',
    email:          member?.email          ?? '',
    phone:          member?.phone          ?? '',
    joinDate:       member?.joinDate       ?? '',
    position:       member?.position       ?? '',
    jobFunction:    member?.jobFunction    ?? '',
    department:     member?.department     ?? '',
    managerId:      member?.managerId      ?? '',
    activityStatus: member?.activityStatus ?? 'active',
    statusReason:   member?.statusReason   ?? '',
  }));

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  if (!member) {
    return (
      <ModalShell open={true} onClose={onClose} title="구성원 정보 수정" widthClass="max-w-md">
        <div className="py-6 text-center text-sm text-fg-subtle">
          구성원을 찾을 수 없습니다. 잘못된 경로이거나 삭제된 구성원입니다.
        </div>
      </ModalShell>
    );
  }

  const hasOrgUnits = orgUnits.length > 0;

  const handleSubmit = () => {
    let department = form.department.trim() || member.department;
    let subOrg: string | undefined, team: string | undefined, squad: string | undefined;
    if (hasOrgUnits) {
      const names = resolveOrgNamesFromSel(orgSel, orgUnits);
      department = names.department ?? department;
      subOrg = names.subOrg; team = names.team; squad = names.squad;
    }
    const activityStatusChanged = form.activityStatus !== (member.activityStatus ?? 'active');
    updateMember(member.id, {
      name:           form.name.trim()        || member.name,
      nameEn:         form.nameEn.trim()      || undefined,
      email:          form.email.trim()       || member.email,
      phone:          form.phone.trim()       || undefined,
      joinDate:       form.joinDate.trim()    || undefined,
      position:       form.position.trim(),
      jobFunction:    form.jobFunction.trim() || undefined,
      department, subOrg, team, squad,
      managerId:      form.managerId || undefined,
      activityStatus: form.activityStatus as User['activityStatus'],
      statusReason:   form.statusReason.trim() || undefined,
      ...(activityStatusChanged ? { statusChangedAt: new Date().toISOString() } : {}),
    });

    if (mostSpecificOrgId) {
      if (isPrimaryHead) {
        updateOrgUnit(mostSpecificOrgId, { headId: member.id });
      } else if (currentUnit?.headId === member.id) {
        updateOrgUnit(mostSpecificOrgId, { headId: undefined });
      }
    }
    showToast('success', '저장되었습니다.');
    onClose();
  };

  return (
    <ModalShell
      open={true}
      onClose={onClose}
      title={`${member.name} 정보 수정`}
      widthClass="max-w-2xl"
      footer={
        <>
          <MsButton type="button" variant="ghost" size="sm" onClick={onClose}>취소</MsButton>
          <MsButton size="sm" onClick={handleSubmit}>저장</MsButton>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
      >
        {/* 권한 티어 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-005 border border-gray-010">
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-subtle">권한</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${TIER_COLOR[memberTier]}`}>
              {TIER_LABEL[memberTier]}
            </span>
          </div>
          {isCurrentAdmin && !isSelf && (
            <button
              type="button"
              onClick={() => updateMember(member.id, { role: memberIsAdmin ? 'member' : 'admin' })}
              className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                memberIsAdmin
                  ? 'text-red-050 border-red-020 hover:bg-red-005'
                  : 'text-blue-060 border-blue-020 hover:bg-blue-005'
              }`}
            >
              {memberIsAdmin ? '관리자 해제' : '관리자 지정'}
            </button>
          )}
        </div>

        {/* 기본 정보 */}
        <section>
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <MsInput autoFocus label="이름" type="text" value={form.name} onChange={f('name')} />
            <MsInput label="영문이름" type="text" value={form.nameEn} onChange={f('nameEn')} placeholder="Hong Gil-dong" />
            <MsInput label="이메일" type="email" value={form.email} onChange={f('email')} />
            <MsInput label="연락처" type="text" value={form.phone} onChange={f('phone')} placeholder="010-0000-0000" />
            <MsInput label="입사일" type="date" value={form.joinDate} onChange={f('joinDate')} />
            <MsInput label="직무" type="text" value={form.jobFunction} onChange={f('jobFunction')} placeholder="프론트엔드 개발" />
          </div>
        </section>

        {/* 조직 · 역할 */}
        <section>
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">조직 · 역할</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <MsInput label="역할" type="text" value={form.position} onChange={f('position')} placeholder="예) iOS 개발자" />
                </div>
                <MsCheckbox
                  size="md"
                  checked={isPrimaryHead}
                  disabled={!mostSpecificOrgId}
                  onChange={e => setIsPrimaryHead(e.target.checked)}
                  label={<span className={`text-xs font-medium ${mostSpecificOrgId ? 'text-gray-060' : 'text-gray-030'}`}>조직장</span>}
                  className="pt-5"
                />
              </div>
            </div>
            <div className="col-span-2">
              <MsSelect label="보고 대상" value={form.managerId} onChange={f('managerId')}>
                <option value="">없음</option>
                {allLeaders.map(m => (
                  <option key={m.id} value={m.id}>{m.name} · {m.position}</option>
                ))}
              </MsSelect>
            </div>
            {!hasOrgUnits && (
              <MsInput label="주조직" type="text" value={form.department} onChange={f('department')} />
            )}
            {hasOrgUnits && (
              <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={setOrgSel} />
            )}
          </div>
        </section>

        {/* 근무 상태 */}
        <section className="border-t border-gray-010 pt-4">
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">근무 상태</p>
          <div className="grid grid-cols-2 gap-3">
            <MsSelect
              label="활성상태"
              value={form.activityStatus}
              onChange={f('activityStatus')}
            >
              <option value="active">정상 근무</option>
              <option value="leave_short">단기 휴직</option>
              <option value="leave_long">장기 휴직</option>
              <option value="terminated">퇴사</option>
              <option value="other">기타</option>
            </MsSelect>
            {form.activityStatus !== 'active' && (
              <MsInput
                label="사유 (선택)"
                type="text"
                value={form.statusReason}
                onChange={f('statusReason')}
                placeholder="예) 출산휴직, 병가 등"
              />
            )}
          </div>
          {form.activityStatus === 'leave_long' && (
            <p className="mt-2 text-xs text-fg-subtle">장기 휴직은 사이클 자동 제외 권장입니다.</p>
          )}
          {form.activityStatus === 'terminated' && (
            <p className="mt-2 text-xs text-fg-subtle">퇴사 처리는 사이클 자동 제외됩니다. 보고관계 정리는 아래 "퇴사 처리" 버튼을 함께 사용하세요.</p>
          )}
        </section>

        {/* 겸임 */}
        <section className="border-t border-gray-010 pt-4">
          <SecondaryOrgSection userId={member.id} />
        </section>

        {/* 퇴사 처리 */}
        {member.role !== 'admin' && (
          <div className="border-t border-gray-010 pt-3">
            {!showTerminate ? (
              <button
                type="button"
                onClick={() => setShowTerminate(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-fg-subtlest hover:text-red-040 transition-colors"
              >
                <MsCancelIcon size={12} className="size-3.5" /> 퇴사 처리
              </button>
            ) : (
              <div className="p-3 rounded-lg border border-red-020 bg-red-005/50 space-y-3">
                <p className="text-xs font-semibold text-red-060">퇴사 처리</p>
                <p className="text-xs text-red-050/80">퇴사 처리 시 보고 관계가 해제되고 조직도에서 제외됩니다.</p>
                <MsInput
                  type="date"
                  label="퇴사일"
                  value={leaveDate}
                  onChange={e => setLeaveDate(e.target.value)}
                  className="border-red-020 focus:ring-red-005 focus:border-red-020"
                />
                <div className="flex justify-end gap-2">
                  <MsButton type="button" variant="ghost" size="sm" onClick={() => setShowTerminate(false)}>취소</MsButton>
                  <MsButton
                    type="button"
                    variant="red"
                    size="sm"
                    onClick={() => { terminateMember(member.id, leaveDate); onClose(); }}
                    disabled={!leaveDate}
                  >
                    퇴사 확정
                  </MsButton>
                </div>
              </div>
            )}
          </div>
        )}

        <button type="submit" className="hidden" />
      </form>
    </ModalShell>
  );
}
