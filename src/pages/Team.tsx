import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { useTeamStore } from '../stores/teamStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { useShowToast } from '../components/ui/Toast';
import { resetAccount } from '../utils/authApi';
import { isUserActive, getMembersInOrgTree } from '../utils/userCompat';
import { UserAvatar } from '../components/ui/UserAvatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { KeyRound, Layers, Users } from 'lucide-react';
import {
  MsPlusIcon, MsCancelIcon, MsEditIcon, MsSearchIcon,
  MsChevronRightMonoIcon, MsChevronDownMonoIcon, MsDeleteIcon, MsRefreshIcon,
  MsFriendAddIcon, MsGrabIcon, MsProfileIcon, MsChevronRightLineIcon, MsGroupIcon, MsWarningIcon,
  MsLogoutIcon,
} from '../components/ui/MsIcons';
import type { User, OrgUnit, OrgUnitType, SecondaryOrgAssignment } from '../types';
import { MsButton } from '../components/ui/MsButton';
import { MsCheckbox, MsInput, MsSelect } from '../components/ui/MsControl';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { impersonationLogWriter } from '../utils/sheetWriter';

/* ── Constants ──────────────────────────────────────────────────────── */
const ORG_TYPE_LABEL: Record<OrgUnitType, string> = {
  mainOrg: '주조직', subOrg: '부조직', team: '팀', squad: '스쿼드',
};
const ORG_TYPE_PLACEHOLDER: Record<OrgUnitType, string> = {
  mainOrg: '예) 개발본부', subOrg: '예) 플랫폼부', team: '예) 프론트엔드팀', squad: '예) 플랫폼스쿼드',
};
// R5-a: squad 가 squad 의 부모가 될 수 있도록 자기재귀 허용 → 5단계 이상 표현 가능.
//        UI 라벨은 모두 '스쿼드' 로 표시되지만 트리 깊이는 무제한.
const ORG_TYPE_NEXT: Record<OrgUnitType, OrgUnitType | null> = {
  mainOrg: 'subOrg', subOrg: 'team', team: 'squad', squad: 'squad',
};
const AVATAR_COLORS = [
  '#4f46e5','#059669','#0891b2','#7c3aed','#0369a1',
  '#6d28d9','#0f766e','#be185d','#b45309','#dc2626',
];

/* ── Helpers ────────────────────────────────────────────────────────── */
function matchesSearch(u: User, q: string) {
  const lq = q.toLowerCase();
  return (
    u.name.toLowerCase().includes(lq) ||
    u.position.toLowerCase().includes(lq) ||
    (u.department ?? '').toLowerCase().includes(lq) ||
    u.email.toLowerCase().includes(lq)
  );
}

/* ── Modal Shell ────────────────────────────────────────────────────── */
function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-modal border border-gray-020 w-full mx-4 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-010">
          <h3 className="text-sm font-semibold text-gray-099">{title}</h3>
          <button onClick={onClose} className="text-gray-040 hover:text-gray-060 transition-colors">
            <MsCancelIcon size={16} className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Cascading Org Selector ─────────────────────────────────────────── */
function OrgSelector({
  orgUnits, value, onChange,
}: {
  orgUnits: OrgUnit[];
  value: { mainOrgId: string; subOrgId: string; teamId: string; squadId: string };
  onChange: (v: typeof value) => void;
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

/* ── Secondary Org Section ──────────────────────────────────────────── */
function SecondaryOrgSection({ userId }: { userId: string }) {
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
        <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide">겸임 조직</p>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-pink-050 hover:text-pink-060 font-medium">
            <MsPlusIcon size={12} className="size-3" /> 추가
          </button>
        )}
      </div>
      {myAssignments.length === 0 && !adding && (
        <p className="text-xs text-gray-040 py-1">겸임 조직이 없습니다.</p>
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
                <MsCheckbox size="md" checked={isHead} onChange={() => toggleHead(a)} label={<span className="text-[10px] font-medium text-gray-050">조직장</span>} />
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
                className="text-xs text-gray-040 hover:text-gray-070 text-left w-full truncate transition-colors">
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
                {allOrgs.map(u => <option key={u.id} value={u.id}>{u.name} ({ORG_TYPE_LABEL[u.type]})</option>)}
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

/* ── Add Member Modal ───────────────────────────────────────────────── */

// 클릭한 조직 노드로부터 계층 전체를 역추적해 orgSel 초기값 구성
function buildInitOrgSel(orgId: string | undefined, orgUnits: OrgUnit[]) {
  const result = { mainOrgId: '', subOrgId: '', teamId: '', squadId: '' };
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

function AddMemberModal({
  onClose,
  initialOrgId,
  initialManagerId,
}: {
  onClose: () => void;
  initialOrgId?: string;
  initialManagerId?: string;
}) {
  const { users, orgUnits, createMember, updateOrgUnit } = useTeamStore();
  const headIds    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const allLeaders = users.filter(u => u.role === 'admin' || headIds.has(u.id));
  const adminUser  = users.find(u => u.role === 'admin');

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', nameEn: '', email: '', phone: '', joinDate: '',
    primaryRole: '', jobFunction: '', isPrimaryHead: false,
    managerId: initialManagerId ?? '',
  });
  const [orgSel, setOrgSel] = useState(() => buildInitOrgSel(initialOrgId, orgUnits));

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const hasOrgUnits = orgUnits.length > 0;

  const mostSpecificOrgId = orgSel.squadId || orgSel.teamId || orgSel.subOrgId || orgSel.mainOrgId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || submitting) return;
    setSubmitting(true);

    const department = hasOrgUnits
      ? (orgUnits.find(u => u.id === orgSel.mainOrgId)?.name ?? '미배정')
      : '미배정';
    const subOrg  = orgSel.subOrgId  ? orgUnits.find(u => u.id === orgSel.subOrgId)?.name  : undefined;
    const team    = orgSel.teamId    ? orgUnits.find(u => u.id === orgSel.teamId)?.name    : undefined;
    const squad   = orgSel.squadId   ? orgUnits.find(u => u.id === orgSel.squadId)?.name   : undefined;
    const managerId = form.managerId || adminUser?.id || undefined;

    const newId = await createMember({
      name:        form.name.trim(),
      nameEn:      form.nameEn.trim()     || undefined,
      email:       form.email.trim(),
      phone:       form.phone.trim()      || undefined,
      joinDate:    form.joinDate          || undefined,
      position:    form.primaryRole.trim() || '',
      jobFunction: form.jobFunction.trim() || undefined,
      role:        'member',
      department,
      subOrg, team, squad,
      managerId,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });

    if (form.isPrimaryHead && mostSpecificOrgId) {
      updateOrgUnit(mostSpecificOrgId, { headId: newId });
    }
    onClose();
  };


  return (
    <Modal title="구성원 추가" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* 기본 정보 */}
        <div>
          <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <MsInput autoFocus label="이름 *" type="text" value={form.name} onChange={f('name')} placeholder="홍길동" />
            <MsInput label="영문이름" type="text" value={form.nameEn} onChange={f('nameEn')} placeholder="Hong Gil-dong" />
            <MsInput label="이메일 *" type="email" value={form.email} onChange={f('email')} placeholder="name@company.com" />
            <MsInput label="연락처" type="text" value={form.phone} onChange={f('phone')} placeholder="010-0000-0000" />
            <MsInput label="입사일" type="date" value={form.joinDate} onChange={f('joinDate')} />
            <MsInput label="직무" type="text" value={form.jobFunction} onChange={f('jobFunction')} placeholder="프론트엔드 개발" />
          </div>
        </div>

        {/* 조직 · 역할 */}
        <div>
          <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">조직 · 역할</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <MsInput label="역할" type="text" value={form.primaryRole} onChange={f('primaryRole')} placeholder="예) iOS 개발자" />
                </div>
                <MsCheckbox size="md" checked={form.isPrimaryHead} disabled={!mostSpecificOrgId} onChange={e => setForm(p => ({ ...p, isPrimaryHead: e.target.checked }))} label={<span className={`text-xs font-medium ${mostSpecificOrgId ? 'text-gray-060' : 'text-gray-030'}`}>조직장</span>} className="pt-5" />
              </div>
            </div>
            <div className="col-span-2">
              <MsSelect label="보고 대상" value={form.managerId} onChange={f('managerId')}>
                <option value="">없음 (자동 배정)</option>
                {allLeaders.map(m => (
                  <option key={m.id} value={m.id}>{m.name} · {m.position}</option>
                ))}
              </MsSelect>
            </div>
            {hasOrgUnits && (
              <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={setOrgSel} />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-gray-010">
          <MsButton type="button" variant="ghost" onClick={onClose}>취소</MsButton>
          <MsButton type="submit" loading={submitting} disabled={!form.name.trim() || !form.email.trim()}>추가</MsButton>
        </div>
      </form>
    </Modal>
  );
}

/* ── Edit Member Modal ──────────────────────────────────────────────── */
function EditMemberModal({ member, onClose }: { member: User; onClose: () => void }) {
  const { users, orgUnits, updateMember, terminateMember, updateOrgUnit } = useTeamStore();
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();
  const headIds    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const allLeaders = users.filter(u => (u.role === 'admin' || headIds.has(u.id)) && u.id !== member.id);

  const liveUser       = users.find(u => u.id === member.id) ?? member;
  const isCurrentAdmin = currentUser?.role === 'admin';
  const isSelf         = currentUser?.id === member.id;
  const memberIsAdmin  = liveUser.role === 'admin';
  const memberIsLeader = !memberIsAdmin && headIds.has(member.id);
  const memberTier     = memberIsAdmin ? 'admin' : memberIsLeader ? 'leader' : 'member';
  const TIER_LABEL: Record<string, string> = { admin: '관리자', leader: '조직장', member: '멤버' };
  const TIER_COLOR: Record<string, string> = {
    admin:  'bg-blue-010 text-blue-070 border-blue-020',
    leader: 'bg-green-010 text-green-060 border-green-020',
    member: 'bg-gray-010 text-gray-050 border-gray-020',
  };
  const [showTerminate, setShowTerminate] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [resetting, setResetting] = useState(false);

  const [orgSel, setOrgSel] = useState(() => {
    const mainOrg = orgUnits.find(u => u.type === 'mainOrg' && u.name === member.department);
    const subOrg  = mainOrg && member.subOrg
      ? orgUnits.find(u => u.type === 'subOrg' && u.parentId === mainOrg.id && u.name === member.subOrg)
      : undefined;
    const team    = member.team  ? orgUnits.find(u => u.type === 'team'  && u.name === member.team)  : undefined;
    const squad   = member.squad ? orgUnits.find(u => u.type === 'squad' && u.name === member.squad) : undefined;
    return { mainOrgId: mainOrg?.id ?? '', subOrgId: subOrg?.id ?? '', teamId: team?.id ?? '', squadId: squad?.id ?? '' };
  });

  const mostSpecificOrgId = orgSel.squadId || orgSel.teamId || orgSel.subOrgId || orgSel.mainOrgId;
  const currentUnit = mostSpecificOrgId ? orgUnits.find(u => u.id === mostSpecificOrgId) : null;
  const [isPrimaryHead, setIsPrimaryHead] = useState(() =>
    !!(mostSpecificOrgId && orgUnits.find(u => u.id === mostSpecificOrgId)?.headId === member.id)
  );
  // 조직 선택이 바뀌면 조직장 체크 상태도 갱신
  useEffect(() => {
    setIsPrimaryHead(!!(currentUnit?.headId === member.id));
  }, [mostSpecificOrgId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState({
    name:        member.name,
    nameEn:      member.nameEn      ?? '',
    email:       member.email,
    phone:       member.phone       ?? '',
    joinDate:    member.joinDate    ?? '',
    position:    member.position,
    jobFunction: member.jobFunction ?? '',
    department:  member.department,
    managerId:   member.managerId   ?? '',
  });

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const hasOrgUnits = orgUnits.length > 0;

  const handleResetPassword = async () => {
    if (!confirm(`${member.name}님의 비밀번호를 사번(${member.id})으로 초기화하시겠습니까?`)) return;
    setResetting(true);
    const ok = await resetAccount(member.id);
    setResetting(false);
    ok
      ? showToast('success', `${member.name}님 비밀번호 초기화 완료. 초기 비밀번호: 사번(${member.id})`)
      : showToast('error', '비밀번호 초기화에 실패했습니다.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let department = form.department.trim() || member.department;
    let subOrg: string | undefined, team: string | undefined, squad: string | undefined;
    if (hasOrgUnits) {
      department = orgUnits.find(u => u.id === orgSel.mainOrgId)?.name ?? department;
      subOrg  = orgSel.subOrgId  ? orgUnits.find(u => u.id === orgSel.subOrgId)?.name  : undefined;
      team    = orgSel.teamId    ? orgUnits.find(u => u.id === orgSel.teamId)?.name    : undefined;
      squad   = orgSel.squadId   ? orgUnits.find(u => u.id === orgSel.squadId)?.name   : undefined;
    }
    updateMember(member.id, {
      name:        form.name.trim()        || member.name,
      nameEn:      form.nameEn.trim()      || undefined,
      email:       form.email.trim()       || member.email,
      phone:       form.phone.trim()       || undefined,
      joinDate:    form.joinDate.trim()    || undefined,
      position:    form.position.trim(),
      jobFunction: form.jobFunction.trim() || undefined,
      department, subOrg, team, squad,
      managerId: form.managerId || undefined,
    });

    // 조직장 설정/해제
    if (mostSpecificOrgId) {
      if (isPrimaryHead) {
        updateOrgUnit(mostSpecificOrgId, { headId: member.id });
      } else if (currentUnit?.headId === member.id) {
        updateOrgUnit(mostSpecificOrgId, { headId: undefined });
      }
    }
    onClose();
  };

  return (
    <Modal title={`${member.name} 정보 수정`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* 권한 티어 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-005 border border-gray-010">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-050">권한</span>
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
        <div>
          <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <MsInput autoFocus label="이름" type="text" value={form.name} onChange={f('name')} />
            <MsInput label="영문이름" type="text" value={form.nameEn} onChange={f('nameEn')} placeholder="Hong Gil-dong" />
            <MsInput label="이메일" type="email" value={form.email} onChange={f('email')} />
            <MsInput label="연락처" type="text" value={form.phone} onChange={f('phone')} placeholder="010-0000-0000" />
            <MsInput label="입사일" type="date" value={form.joinDate} onChange={f('joinDate')} />
            <MsInput label="직무" type="text" value={form.jobFunction} onChange={f('jobFunction')} placeholder="프론트엔드 개발" />
          </div>
        </div>

        {/* 조직 · 역할 */}
        <div>
          <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">조직 · 역할</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <MsInput label="역할" type="text" value={form.position} onChange={f('position')} placeholder="예) iOS 개발자" />
                </div>
                <MsCheckbox size="md" checked={isPrimaryHead} disabled={!mostSpecificOrgId} onChange={e => setIsPrimaryHead(e.target.checked)} label={<span className={`text-xs font-medium ${mostSpecificOrgId ? 'text-gray-060' : 'text-gray-030'}`}>조직장</span>} className="pt-5" />
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
              <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={v => { setOrgSel(v); }} />
            )}
          </div>
        </div>

        {/* 겸임 */}
        <div className="border-t border-gray-010 pt-4">
          <SecondaryOrgSection userId={member.id} />
        </div>

        {/* 비밀번호 초기화 (관리자 전용) */}
        {currentUser?.role === 'admin' && member.role !== 'admin' && (
          <div className="border-t border-gray-010 pt-3">
            <button type="button" onClick={handleResetPassword} disabled={resetting}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-040 hover:text-yellow-060 disabled:opacity-40 transition-colors">
              <KeyRound className="size-3.5" />
              {resetting ? '초기화 중...' : `비밀번호 초기화 (사번: ${member.id})`}
            </button>
          </div>
        )}

        {/* 퇴사 처리 */}
        {member.role !== 'admin' && (
          <div className="border-t border-gray-010 pt-3">
            {!showTerminate ? (
              <button type="button" onClick={() => setShowTerminate(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-040 hover:text-red-040 transition-colors">
                <MsCancelIcon size={12} className="size-3.5" /> 퇴사 처리
              </button>
            ) : (
              <div className="p-3 rounded-lg border border-red-020 bg-red-005/50 space-y-3">
                <p className="text-xs font-semibold text-red-060">퇴사 처리</p>
                <p className="text-xs text-red-050/80">퇴사 처리 시 보고 관계가 해제되고 조직도에서 제외됩니다.</p>
                <div>
                  <MsInput
                    type="date"
                    label="퇴사일"
                    value={leaveDate}
                    onChange={e => setLeaveDate(e.target.value)}
                    className="border-red-020 focus:ring-red-005 focus:border-red-020"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <MsButton type="button" variant="ghost" size="sm" onClick={() => setShowTerminate(false)}>취소</MsButton>
                  <MsButton type="button" variant="red" size="sm" onClick={() => { terminateMember(member.id, leaveDate); onClose(); }} disabled={!leaveDate}>퇴사 확정</MsButton>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1 border-t border-gray-010">
          <MsButton type="button" variant="ghost" onClick={onClose}>취소</MsButton>
          <MsButton type="submit">저장</MsButton>
        </div>
      </form>
    </Modal>
  );
}

/* ── Bulk Move Modal ────────────────────────────────────────────────── */
function BulkMoveModal({
  selectedUsers,
  onConfirm,
  onClose,
}: {
  selectedUsers: User[];
  onConfirm: (orgSel: {
    mainOrgId: string; subOrgId: string; teamId: string; squadId: string;
  }, managerId: string | null) => void;
  onClose: () => void;
}) {
  const { orgUnits, users } = useTeamStore();
  const headIds    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const allLeaders = users.filter(u => u.role === 'admin' || headIds.has(u.id));
  const [orgSel, setOrgSel] = useState({ mainOrgId: '', subOrgId: '', teamId: '', squadId: '' });
  const [managerId, setManagerId] = useState<string>('__keep__');

  const mostSpecificId = orgSel.squadId || orgSel.teamId || orgSel.subOrgId || orgSel.mainOrgId;
  const mostSpecificUnit = orgUnits.find(u => u.id === mostSpecificId);

  // 조직 선택 시 조직장을 자동 제안
  useEffect(() => {
    setManagerId(mostSpecificUnit?.headId ?? '__keep__');
  }, [mostSpecificId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title={`${selectedUsers.length}명 조직 이동`} onClose={onClose} wide>
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* 선택된 구성원 미리보기 */}
        <div>
          <p className="block text-xs font-medium text-gray-050 mb-1">이동할 구성원</p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2.5 bg-gray-005 rounded-lg border border-gray-010">
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
        </div>

        {/* 이동할 조직 선택 */}
        {orgUnits.length > 0 ? (
          <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={setOrgSel} />
        ) : (
          <p className="text-xs text-gray-040">등록된 조직 구조가 없습니다.</p>
        )}

        {/* 보고 대상 */}
        <MsSelect label="보고 대상" value={managerId} onChange={e => setManagerId(e.target.value)}>
          <option value="__keep__">변경하지 않음</option>
          <option value="">없음</option>
          {allLeaders.map(u => (
            <option key={u.id} value={u.id}>{u.name} · {u.position}</option>
          ))}
        </MsSelect>

        <div className="flex justify-end gap-2 pt-1 border-t border-gray-010">
          <MsButton type="button" variant="ghost" onClick={onClose}>취소</MsButton>
          <MsButton
            type="button"
            disabled={!orgSel.mainOrgId}
            onClick={() => onConfirm(orgSel, managerId === '__keep__' ? null : managerId)}
            leftIcon={<MsChevronRightLineIcon size={14} />}
          >
            이동 확정
          </MsButton>
        </div>
      </div>
    </Modal>
  );
}

/* ── Org Unit Form Modal ────────────────────────────────────────────── */
function OrgUnitFormModal({
  editing, addType, addParentId, onClose,
}: {
  editing?: OrgUnit;
  addType?: OrgUnitType;
  addParentId?: string;
  onClose: () => void;
}) {
  const { orgUnits, addOrgUnit, updateOrgUnit, users } = useTeamStore();
  const isEdit   = !!editing;
  const type     = editing?.type ?? addType ?? 'mainOrg';
  const parentId = editing?.parentId ?? addParentId;
  const parentUnit = parentId ? orgUnits.find(u => u.id === parentId) : undefined;

  const [name,   setName]   = useState(editing?.name   ?? '');
  const [headId, setHeadId] = useState(editing?.headId ?? '');

  const eligibleHeads = users.filter(u => isUserActive(u));
  const title = isEdit
    ? `${ORG_TYPE_LABEL[type]} 편집`
    : `${ORG_TYPE_LABEL[type]} 추가${parentUnit ? ` — ${parentUnit.name}` : ''}`;

  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) return;
          if (isEdit && editing) {
            updateOrgUnit(editing.id, { name: name.trim(), headId: headId || undefined });
          } else {
            const siblings = orgUnits.filter(u => u.type === type && u.parentId === parentId);
            const maxOrder = siblings.reduce((m, u) => Math.max(m, u.order), 0);
            addOrgUnit({ name: name.trim(), type, parentId, headId: headId || undefined, order: maxOrder + 1 });
          }
          onClose();
        }}
        className="space-y-4"
      >
        <MsInput autoFocus label={`${ORG_TYPE_LABEL[type]} 이름 *`} type="text" value={name} onChange={e => setName(e.target.value)} placeholder={ORG_TYPE_PLACEHOLDER[type]} />
        <MsSelect label="조직장" value={headId} onChange={e => setHeadId(e.target.value)}>
          <option value="">미지정</option>
          {eligibleHeads.map(u => <option key={u.id} value={u.id}>{u.name} · {u.position}</option>)}
        </MsSelect>
        <div className="flex justify-end gap-2 pt-1">
          <MsButton type="button" variant="ghost" onClick={onClose}>취소</MsButton>
          <MsButton type="submit" disabled={!name.trim()}>{isEdit ? '저장' : '추가'}</MsButton>
        </div>
      </form>
    </Modal>
  );
}

/* ── Org Tree ─────────────────────────────────────────────────────── */
const ORG_TYPE_COLOR: Record<OrgUnitType, string> = {
  mainOrg: 'bg-blue-050',
  subOrg:  'bg-green-040',
  team:    'bg-blue-050',
  squad:   'bg-gray-030',
};

// 드래그 타겟으로 허용되는 부모 타입
// R5-a: squad → squad 자기재귀로 깊이 무제한
const ALLOWED_CHILD: Partial<Record<OrgUnitType, OrgUnitType>> = {
  mainOrg: 'subOrg', subOrg: 'team', team: 'squad', squad: 'squad',
};

interface DnDState {
  draggingId: string | null;
  dropTarget: { id: string; pos: 'above' | 'below' | 'into' } | null;
}

interface DnDCallbacks {
  state: DnDState;
  onDragStart: (id: string) => void;
  onDragEnd:   () => void;
  onDragOver:  (id: string, pos: 'above' | 'below' | 'into') => void;
  onDrop:      (targetId: string) => void;
}

function OrgTreeNode({
  unit, allUnits, selectedId, onSelect,
  onEditUnit, onDeleteUnit, onAddChild, onAddMember,
  depth, dnd, canEdit = false,
}: {
  unit: OrgUnit;
  allUnits: OrgUnit[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEditUnit: (unit: OrgUnit) => void;
  onDeleteUnit: (unit: OrgUnit) => void;
  onAddChild: (type: OrgUnitType, parentId: string) => void;
  onAddMember: (unitId: string) => void;
  depth: number;
  dnd: DnDCallbacks;
  canEdit?: boolean;
}) {
  const { users, secondaryOrgs } = useTeamStore();
  const [expanded, setExpanded] = useState(depth === 0);
  const [hovered, setHovered] = useState(false);

  const children = allUnits
    .filter(u => u.parentId === unit.id)
    .sort((a, b) => a.order - b.order);
  const hasChildren = children.length > 0;

  const memberCount = useMemo(() => {
    // R1+R5-a: orgUnitId 트리 기반 룩업 우선, legacy 4단계 텍스트 매칭 fallback
    const treeMembers = new Set(
      getMembersInOrgTree(unit.id, users, allUnits)
        .filter(isUserActive)
        .map(u => u.id)
    );
    // legacy: 텍스트 필드 매칭 (마이그 전 데이터 호환)
    const key: Record<OrgUnitType, keyof User> = {
      mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
    };
    const legacyIds = users
      .filter(u => u[key[unit.type]] === unit.name && isUserActive(u))
      .map(u => u.id);
    legacyIds.forEach(id => treeMembers.add(id));
    const secondaryExtra = secondaryOrgs.filter(a => a.orgId === unit.id && !treeMembers.has(a.userId)).length;
    return treeMembers.size + secondaryExtra;
  }, [users, unit, allUnits, secondaryOrgs]);

  const nextType = ORG_TYPE_NEXT[unit.type];
  const isSelected = selectedId === unit.id;
  const isDragging = dnd.state.draggingId === unit.id;
  const dropPos = dnd.state.dropTarget?.id === unit.id ? dnd.state.dropTarget.pos : null;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dnd.state.draggingId || dnd.state.draggingId === unit.id) return;

    const dragged = allUnits.find(u => u.id === dnd.state.draggingId);
    if (!dragged) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;

    let pos: 'above' | 'below' | 'into';
    if (dragged.type === unit.type) {
      // 같은 레벨: 위 25% → above, 아래 25% → below, 중간 → into(하위 이동)
      const canHaveChild = ALLOWED_CHILD[unit.type] !== undefined;
      if (canHaveChild && ratio >= 0.25 && ratio <= 0.75) pos = 'into';
      else pos = ratio < 0.5 ? 'above' : 'below';
    } else if (ALLOWED_CHILD[unit.type] === dragged.type) {
      pos = 'into';
    } else {
      return;
    }
    dnd.onDragOver(unit.id, pos);
  };

  return (
    <div className={isDragging ? 'opacity-40' : ''}>
      {dropPos === 'above' && (
        <div className="h-0.5 bg-pink-040 rounded-full mx-2 my-px pointer-events-none" />
      )}

      <div
        draggable={canEdit}
        onDragStart={canEdit ? e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; dnd.onDragStart(unit.id); } : undefined}
        onDragOver={canEdit ? handleDragOver : undefined}
        onDragLeave={canEdit ? e => {
          const rel = e.relatedTarget as Node | null;
          if (!e.currentTarget.contains(rel)) { /* no-op — parent handles clear */ }
        } : undefined}
        onDrop={canEdit ? e => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(unit.id); } : undefined}
        onDragEnd={canEdit ? () => dnd.onDragEnd() : undefined}
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors ${
          dropPos === 'into'
            ? 'ring-2 ring-pink-040 bg-pink-005'
            : isSelected
              ? 'bg-pink-005 text-pink-060'
              : 'hover:bg-gray-005 text-gray-070'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(unit.id)}
      >
        {/* Drag handle */}
        {canEdit && (
          <span
            className={`flex-shrink-0 text-gray-040 cursor-grab active:cursor-grabbing transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}
            title="드래그로 순서·위치 변경"
          >
            <MsGrabIcon size={12} />
          </span>
        )}

        {/* expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className={`size-4 flex items-center justify-center flex-shrink-0 rounded transition-colors ${hasChildren ? 'text-gray-040 hover:text-gray-070' : 'opacity-0 pointer-events-none'}`}
        >
          {expanded ? <MsChevronDownMonoIcon size={12} /> : <MsChevronRightMonoIcon size={12} />}
        </button>

        {/* type dot */}
        <span className={`size-2 rounded-full flex-shrink-0 ${ORG_TYPE_COLOR[unit.type]}`} />

        {/* name */}
        <span className={`flex-1 text-sm truncate font-medium ${isSelected ? 'text-pink-060' : ''}`}>
          {unit.name}
        </span>

        {/* R5-a: depth hint (4단계 이상에서 표시) */}
        {depth >= 4 && (
          <span className="text-[10px] font-semibold text-gray-040 bg-gray-005 px-1.5 py-0.5 rounded-full flex-shrink-0" title={`트리 ${depth + 1}단계`}>
            Lv.{depth + 1}
          </span>
        )}

        {/* member count */}
        {memberCount > 0 && (
          <span className={`text-xs flex-shrink-0 ${isSelected ? 'text-pink-040' : 'text-gray-040'}`}>
            {memberCount}
          </span>
        )}

        {/* action buttons */}
        {canEdit && hovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button title="구성원 추가" onClick={() => onAddMember(unit.id)}
              className="p-1 rounded text-gray-040 hover:text-pink-050 hover:bg-pink-005 transition-colors">
              <MsFriendAddIcon size={12} />
            </button>
            {nextType && (
              <button title={`${ORG_TYPE_LABEL[nextType]} 추가`}
                onClick={() => onAddChild(nextType, unit.id)}
                className="p-1 rounded text-gray-040 hover:text-green-060 hover:bg-green-005 transition-colors">
                <MsPlusIcon size={12} />
              </button>
            )}
            <button title="편집" onClick={() => onEditUnit(unit)}
              className="p-1 rounded text-gray-040 hover:text-gray-070 hover:bg-gray-010 transition-colors">
              <MsEditIcon size={12} />
            </button>
            <button title="삭제" onClick={() => onDeleteUnit(unit)}
              className="p-1 rounded text-gray-040 hover:text-red-040 hover:bg-red-005 transition-colors">
              <MsDeleteIcon size={12} />
            </button>
          </div>
        )}
      </div>

      {dropPos === 'below' && (
        <div className="h-0.5 bg-pink-040 rounded-full mx-2 my-px pointer-events-none" />
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <OrgTreeNode
              key={child.id}
              unit={child}
              allUnits={allUnits}
              selectedId={selectedId}
              onSelect={onSelect}
              onEditUnit={onEditUnit}
              onDeleteUnit={onDeleteUnit}
              onAddChild={onAddChild}
              onAddMember={onAddMember}
              depth={depth + 1}
              dnd={dnd}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Member Row ─────────────────────────────────────────────────────── */
function MemberRow({
  user, onEdit, onTerminate, onImpersonate, secondaryOrgs,
  selected = false, onToggle, selectionActive = false,
  secondaryAssignmentHere, isOrgHeadHere = false, isAnyOrgHead = false,
}: {
  user: User;
  onEdit: ((u: User) => void) | null;
  onTerminate?: (u: User) => void;
  onImpersonate?: (u: User) => void;
  secondaryOrgs: SecondaryOrgAssignment[];
  selected?: boolean;
  onToggle?: (id: string) => void;
  selectionActive?: boolean;
  secondaryAssignmentHere?: SecondaryOrgAssignment;
  isOrgHeadHere?: boolean;  // 현재 선택된 조직의 조직장
  isAnyOrgHead?: boolean;   // 어느 조직이든 조직장 여부
}) {
  const navigate = useNavigate();
  const mySecondary = secondaryOrgs.filter(a => a.userId === user.id);
  const canSelect = onToggle && user.role !== 'admin';
  const goToProfile = (e: React.MouseEvent) => { e.stopPropagation(); navigate(`/team/${user.id}`); };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors group border-b border-gray-005 last:border-0 ${
        selected ? 'bg-pink-005/60' : 'hover:bg-gray-005'
      } ${canSelect ? 'cursor-pointer' : ''}`}
      onClick={canSelect ? () => onToggle!(user.id) : undefined}
    >
      {/* 체크박스 */}
      {canSelect && (
        <div
          className={`flex items-center flex-shrink-0 transition-opacity ${selectionActive || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={e => e.stopPropagation()}
        >
          <MsCheckbox checked={selected} onChange={() => onToggle!(user.id)} />
        </div>
      )}

      <UserAvatar user={user} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={goToProfile}
            className="text-sm font-medium text-gray-099 hover:text-pink-050 hover:underline transition-colors"
          >
            {user.name}
          </button>
          {user.role === 'admin'
            ? <StatusBadge type="role" value="admin" />
            : (isOrgHeadHere || isAnyOrgHead)
              ? <StatusBadge type="role" value="leader" />
              : null}
          {secondaryAssignmentHere ? (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-010 text-purple-060 rounded border border-purple-010">
              겸임{secondaryAssignmentHere.role ? ` · ${secondaryAssignmentHere.role}` : ''}
            </span>
          ) : mySecondary.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-005 text-purple-050 rounded border border-purple-010">
              겸임 {mySecondary.length}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-040 mt-0.5 truncate">
          {secondaryAssignmentHere ? secondaryAssignmentHere.role ?? '' : user.position}
          {user.email && <span className="ml-2 text-gray-030">·</span>}
          {user.email && <span className="ml-1">{user.email}</span>}
        </p>
      </div>
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={goToProfile} title="프로필 보기"
          className="p-1.5 rounded-md text-gray-040 hover:text-blue-060 hover:bg-blue-005 transition-colors">
          <MsProfileIcon size={12} className="size-3.5" />
        </button>
        {onEdit && (
          <button onClick={() => onEdit(user)} title="정보 수정"
            className="p-1.5 rounded-md text-gray-040 hover:text-pink-050 hover:bg-pink-005 transition-colors">
            <MsEditIcon size={12} className="size-3.5" />
          </button>
        )}
        {onImpersonate && user.role !== 'admin' && isUserActive(user) && (
          <button onClick={() => onImpersonate(user)} title="마스터 로그인 (조회 전용)"
            className="p-1.5 rounded-md text-gray-040 hover:text-orange-070 hover:bg-orange-005 transition-colors">
            <MsLogoutIcon size={12} className="size-3.5" />
          </button>
        )}
        {onTerminate && user.role !== 'admin' && (
          <button onClick={() => onTerminate(user)} title="퇴사 처리"
            className="p-1.5 rounded-md text-gray-040 hover:text-red-040 hover:bg-red-005 transition-colors">
            <MsCancelIcon size={12} className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Admin View ─────────────────────────────────────────────────────── */
function AdminView({ canEdit = false }: { canEdit?: boolean }) {
  const { users, orgUnits, teams, deleteOrgUnit, updateOrgUnit, updateMember, isLoading, terminateMember } = useTeamStore();
  const { orgSyncEnabled, orgLastSyncedAt, orgSyncError } = useSheetsSyncStore();
  const { can } = usePermission();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore(s => s.startImpersonation);
  const showToast = useShowToast();

  const [selectedOrgId, setSelectedOrgId]       = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned]      = useState(false);
  const [search, setSearch]                      = useState('');
  const [showTerminated, setShowTerminated]       = useState(false);
  const [addMemberModal, setAddMemberModal]       = useState<{ unitId?: string; managerId?: string } | null>(null);
  const [editingMember,  setEditingMember]        = useState<User | null>(null);
  const [orgModal, setOrgModal] = useState<
    | { mode: 'add'; type: OrgUnitType; parentId?: string }
    | { mode: 'edit'; unit: OrgUnit }
    | null
  >(null);
  // R5-b: 마스터 로그인 시작 확인
  const [impersonateTarget, setImpersonateTarget] = useState<User | null>(null);

  /* ── 복수 선택 & 이동 ────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);

  const clearSelection = () => setSelectedIds(new Set());

  const selectAll = () => { setSelectedOrgId(null); setShowUnassigned(false); setShowTerminated(false); clearSelection(); };
  const selectUnassigned = () => { setSelectedOrgId(null); setShowUnassigned(true); setShowTerminated(false); clearSelection(); };
  const selectOrg = (id: string) => { setSelectedOrgId(id); setShowUnassigned(false); setShowTerminated(false); clearSelection(); };

  const headerActions = useMemo(() => canEdit ? (
    <MsButton
      onClick={() => {
        const unit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
        setAddMemberModal({ unitId: selectedOrgId ?? undefined, managerId: unit?.headId });
      }}
      leftIcon={<MsFriendAddIcon size={16} />}
    >
      구성원 추가
    </MsButton>
  ) : undefined, [canEdit, selectedOrgId, orgUnits]);
  const activeUserCount = users.filter(u => isUserActive(u)).length;
  useSetPageHeader('구성원', headerActions, {
    subtitle: `구성원 ${activeUserCount}명 · 조직 ${orgUnits.length}개`,
  });

  const toggleMember = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = (list: User[]) => {
    const selectable = list.filter(u => u.role !== 'admin').map(u => u.id);
    const allSelected = selectable.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      selectable.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleBulkMove = (
    orgSel: { mainOrgId: string; subOrgId: string; teamId: string; squadId: string },
    managerId: string | null
  ) => {
    const department = orgUnits.find(u => u.id === orgSel.mainOrgId)?.name ?? '미배정';
    const subOrg  = orgSel.subOrgId  ? orgUnits.find(u => u.id === orgSel.subOrgId)?.name  : undefined;
    const team    = orgSel.teamId    ? orgUnits.find(u => u.id === orgSel.teamId)?.name    : undefined;
    const squad   = orgSel.squadId   ? orgUnits.find(u => u.id === orgSel.squadId)?.name   : undefined;

    const patch: Partial<Omit<User, 'id'>> = { department, subOrg, team, squad };
    if (managerId !== null) patch.managerId = managerId || undefined;

    selectedIds.forEach(id => updateMember(id, patch));

    const count = selectedIds.size;
    clearSelection();
    setShowBulkMove(false);
    showToast('success', `${count}명이 ${department}으로 이동되었습니다.`);
  };

  /* ── Drag-and-Drop ──────────────────────────────────────────────── */
  const [dndState, setDndState] = useState<DnDState>({ draggingId: null, dropTarget: null });

  const getDescendantIds = (id: string): string[] => {
    const children = orgUnits.filter(u => u.parentId === id).map(u => u.id);
    return [id, ...children.flatMap(getDescendantIds)];
  };

  // 조직 이동 시 소속 구성원 org 필드도 함께 업데이트
  type OrgChange = { id: string; parentId: string | undefined; type: OrgUnitType; order: number };

  const TYPE_FIELD_MAP: Record<OrgUnitType, keyof User> = {
    mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
  };
  const TYPE_DEPTH_MAP: Record<OrgUnitType, number> = {
    mainOrg: 0, subOrg: 1, team: 2, squad: 3,
  };

  const getOrgPath = (unitId: string, snap: OrgUnit[]) => {
    const path: OrgUnit[] = [];
    let cur: OrgUnit | undefined = snap.find(u => u.id === unitId);
    while (cur) {
      path.unshift(cur);
      const parentId = cur.parentId;
      cur = parentId ? snap.find(u => u.id === parentId) : undefined;
    }
    return {
      department: path.find(u => u.type === 'mainOrg')?.name,
      subOrg:     path.find(u => u.type === 'subOrg')?.name,
      team:       path.find(u => u.type === 'team')?.name,
      squad:      path.find(u => u.type === 'squad')?.name,
    };
  };

  // 조직 변경 목록을 받아 ① 소속 구성원 org 필드 업데이트 ② 조직 단위 업데이트
  const applyWithMemberSync = (orgChanges: OrgChange[]) => {
    // 변경 후 org 단위 스냅샷 (가상)
    const newSnap = orgUnits.map(u => {
      const c = orgChanges.find(ch => ch.id === u.id);
      return c ? { ...u, ...c } : u;
    });

    // 각 구성원이 변경된 조직 중 가장 하위 조직에 속하는지 확인 후 경로 재계산
    for (const user of users.filter(u => isUserActive(u) && u.role !== 'admin')) {
      let bestId: string | null = null;
      let bestDepth = -1;
      for (const c of orgChanges) {
        const oldUnit = orgUnits.find(u => u.id === c.id);
        if (!oldUnit) continue;
        const field = TYPE_FIELD_MAP[oldUnit.type];
        const depth = TYPE_DEPTH_MAP[oldUnit.type];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((user as any)[field] === oldUnit.name && depth > bestDepth) {
          bestDepth = depth;
          bestId = c.id;
        }
      }
      if (!bestId) continue;

      const p = getOrgPath(bestId, newSnap);
      updateMember(user.id, {
        department: p.department ?? user.department,
        subOrg:     p.subOrg,
        team:       p.team,
        squad:      p.squad,
      });
    }

    // 조직 단위 업데이트
    orgChanges.forEach(({ id, parentId, type, order }) =>
      updateOrgUnit(id, { parentId, type, order })
    );
  };

  // 드래그된 유닛의 모든 하위 유닛을 OrgChange 형태로 수집 (parent/type 변경 없음 — 경로 재계산용)
  const descendantChanges = (unitId: string): OrgChange[] =>
    getDescendantIds(unitId)
      .filter(id => id !== unitId)
      .map(id => {
        const u = orgUnits.find(u => u.id === id)!;
        return { id: u.id, parentId: u.parentId, type: u.type, order: u.order };
      });

  const handleDrop = (targetId: string) => {
    const { draggingId, dropTarget } = dndState;
    setDndState({ draggingId: null, dropTarget: null });
    if (!draggingId || draggingId === targetId || !dropTarget) return;

    const dragged = orgUnits.find(u => u.id === draggingId);
    const target  = orgUnits.find(u => u.id === targetId);
    if (!dragged || !target) return;

    const pos = dropTarget.pos;

    if (pos === 'into') {
      if (getDescendantIds(draggingId).includes(targetId)) return;

      if (dragged.type === target.type) {
        // 같은 레벨 → 하위 이동 + 타입 재귀 조정 + 구성원 이동
        const newType = ALLOWED_CHILD[target.type];
        if (!newType) return;

        const computeOrgChanges = (
          unitId: string, newParentId: string | undefined, type: OrgUnitType, snap: OrgUnit[]
        ): OrgChange[] => {
          const siblings = snap.filter(u => u.parentId === newParentId && u.id !== unitId);
          const maxOrder = siblings.reduce((m, u) => Math.max(m, u.order), 0);
          const result: OrgChange[] = [{ id: unitId, parentId: newParentId, type, order: maxOrder + 1 }];
          const ct = ALLOWED_CHILD[type];
          if (!ct) return result;
          snap.filter(u => u.parentId === unitId).forEach(child =>
            result.push(...computeOrgChanges(child.id, unitId, ct, snap))
          );
          return result;
        };
        applyWithMemberSync(computeOrgChanges(draggingId, targetId, newType, orgUnits));

      } else {
        // 호환 부모 타입 → reparent (type 유지, parent 변경) + 구성원 이동
        const maxOrder = orgUnits.filter(u => u.parentId === targetId)
          .reduce((m, u) => Math.max(m, u.order), 0);
        applyWithMemberSync([
          { id: draggingId, parentId: targetId, type: dragged.type, order: maxOrder + 1 },
          ...descendantChanges(draggingId),
        ]);
      }

    } else {
      // 형제 재정렬 (above / below)
      if (dragged.type !== target.type) return;
      const newParentId = target.parentId;
      const siblings = orgUnits
        .filter(u => u.type === target.type && u.parentId === newParentId && u.id !== draggingId)
        .sort((a, b) => a.order - b.order);
      const ordered = [...siblings];
      ordered.splice(pos === 'above'
        ? siblings.findIndex(u => u.id === targetId)
        : siblings.findIndex(u => u.id === targetId) + 1,
        0, dragged);

      if (dragged.parentId !== newParentId) {
        // 크로스-parent 이동: 구성원 org 필드도 갱신
        const reorderChanges: OrgChange[] = ordered.map((u, i) => ({
          id: u.id, parentId: newParentId, type: u.type, order: i + 1,
        }));
        const desc = descendantChanges(draggingId).filter(d => !reorderChanges.some(r => r.id === d.id));
        applyWithMemberSync([...reorderChanges, ...desc]);
      } else {
        // 순수 순서 변경: 구성원 업데이트 불필요
        ordered.forEach((u, i) => updateOrgUnit(u.id, { order: i + 1, parentId: newParentId }));
      }
    }
  };

  const dnd: DnDCallbacks = {
    state: dndState,
    onDragStart: (id) => setDndState({ draggingId: id, dropTarget: null }),
    onDragEnd:   ()   => setDndState({ draggingId: null, dropTarget: null }),
    onDragOver:  (id, pos) => setDndState(s => ({ ...s, dropTarget: { id, pos } })),
    onDrop: handleDrop,
  };

  const activeUsers     = useMemo(() => users.filter(u => isUserActive(u)), [users]);
  const terminatedUsers = useMemo(() => users.filter(u => !isUserActive(u)), [users]);

  const totalNonAdmin = activeUsers.filter(u => u.role !== 'admin').length;
  const headIdsAll    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const totalLeaders  = activeUsers.filter(u => headIdsAll.has(u.id)).length;

  /* 소속 없는 구성원: 어떤 mainOrg 이름과도 department가 일치하지 않는 활성 비관리자 */
  const mainOrgNames = useMemo(() => new Set(orgUnits.filter(u => u.type === 'mainOrg').map(u => u.name)), [orgUnits]);
  const unassignedUsers = useMemo(() =>
    activeUsers.filter(u => u.role !== 'admin' && !mainOrgNames.has(u.department))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [activeUsers, mainOrgNames]
  );

  /* 선택된 조직의 구성원 */
  const { secondaryOrgs } = useTeamStore();
  const selectedUnit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
  const panelUsers = useMemo(() => {
    if (showTerminated) return terminatedUsers;
    if (showUnassigned) return unassignedUsers;
    if (!selectedUnit) return activeUsers.filter(u => u.role !== 'admin').sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const key: Record<OrgUnitType, keyof User> = {
      mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
    };
    const primaryIds = new Set(
      activeUsers.filter(u => u[key[selectedUnit.type]] === selectedUnit.name).map(u => u.id)
    );
    // 겸임으로 이 조직에 소속된 구성원 추가
    const secondaryIds = new Set(
      secondaryOrgs.filter(a => a.orgId === selectedUnit.id).map(a => a.userId)
    );
    const members = activeUsers.filter(u => primaryIds.has(u.id) || secondaryIds.has(u.id));
    // 조직장 맨 위, 이후 가나다/abc 순
    return members.sort((a, b) => {
      if (a.id === selectedUnit.headId) return -1;
      if (b.id === selectedUnit.headId) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [selectedUnit, activeUsers, terminatedUsers, showTerminated, showUnassigned, unassignedUsers, secondaryOrgs]);

  const searchResults = useMemo(() =>
    search.trim()
      ? activeUsers.filter(u => matchesSearch(u, search))
      : [],
    [activeUsers, search]
  );

  // 현재 선택된 조직의 겸임 구성원 맵 (userId → assignment)
  const secondaryMapHere = useMemo(() => {
    if (!selectedUnit) return new Map<string, SecondaryOrgAssignment>();
    return new Map(
      secondaryOrgs.filter(a => a.orgId === selectedUnit.id).map(a => [a.userId, a])
    );
  }, [secondaryOrgs, selectedUnit]);

  const mainOrgs = useMemo(() =>
    orgUnits.filter(u => u.type === 'mainOrg').sort((a, b) => a.order - b.order),
    [orgUnits]
  );

  const handleDeleteUnit = (unit: OrgUnit) => {
    if (confirm(`'${unit.name}' 및 모든 하위 조직을 삭제할까요?`)) deleteOrgUnit(unit.id);
  };

  const handleTerminate = (user: User) => {
    if (confirm(`${user.name}님을 퇴사 처리하시겠습니까?`)) {
      terminateMember(user.id, new Date().toISOString().slice(0, 10));
    }
  };

  // R5-b: 마스터 로그인 시작
  const handleImpersonate = (user: User) => {
    setImpersonateTarget(user);
  };

  const confirmImpersonate = (reason?: string) => {
    if (!impersonateTarget) return;
    const log = startImpersonation(impersonateTarget, reason);
    if (!log) {
      showToast('error', '마스터 로그인을 시작할 수 없습니다.');
      setImpersonateTarget(null);
      return;
    }
    // 시트로 비동기 push (실패해도 세션 진행)
    impersonationLogWriter.start(log);
    showToast('success', `${impersonateTarget.name}(으)로 접속했습니다. 작성/수정은 차단됩니다.`);
    setImpersonateTarget(null);
    navigate('/'); // 대상자 대시보드로 이동
  };

  return (
    <div className="space-y-5">
      {/* 동기화 상태 + 퇴사자 토글 */}
      <div className="flex items-center gap-2 flex-wrap">
        {orgSyncEnabled && (
          isLoading ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-010 text-xs text-gray-050">
              <MsRefreshIcon size={12} className="animate-spin" /> 동기화 중
            </span>
          ) : orgSyncError ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-005 text-xs text-red-040">
              시트 연결 오류
            </span>
          ) : orgLastSyncedAt ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-005 text-xs text-green-060">
              <MsRefreshIcon size={12} className="size-3" />
              {new Date(orgLastSyncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 동기화됨
            </span>
          ) : null
        )}
        {terminatedUsers.length > 0 && (
          <button onClick={() => { setShowTerminated(v => !v); setSelectedOrgId(null); setShowUnassigned(false); clearSelection(); }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showTerminated
                ? 'bg-red-005 text-red-050 border-red-020'
                : 'bg-white text-gray-050 border-gray-020 hover:border-gray-030'
            }`}>
            <MsCancelIcon size={12} className="size-3.5" /> 퇴사자 {terminatedUsers.length}명
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: MsGroupIcon, label: '전체 구성원', value: `${totalNonAdmin}명`,  sub: '재직 중' },
          { icon: MsGroupIcon, label: '조직',        value: `${teams.length}개`,   sub: '등록된 조직' },
          { icon: MsProfileIcon, label: '조직장',         value: `${totalLeaders}명`,   sub: '조직장' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-020 shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-7 rounded-lg bg-gray-010 flex items-center justify-center">
                <Icon className="size-3.5 text-gray-050" />
              </div>
              <span className="text-xs text-gray-050">{label}</span>
            </div>
            <p className="text-2xl font-semibold text-gray-099">{value}</p>
            <p className="text-xs text-gray-040 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <MsInput
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); clearSelection(); }}
        placeholder="이름, 직책, 팀으로 검색..."
        leftSlot={<MsSearchIcon size={16} />}
        rightSlot={search ? (
          <button onClick={() => setSearch('')} className="text-gray-040 hover:text-gray-060">
            <MsCancelIcon size={16} />
          </button>
        ) : undefined}
        className="rounded-xl"
      />

      {search ? (
        /* ── 검색 결과 ── */
        <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-010">
            <p className="text-xs text-gray-050">
              <span className="font-medium text-gray-080">'{search}'</span> 검색 결과 {searchResults.length}명
            </p>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-gray-040 text-center py-12">검색 결과가 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-005">
              {searchResults.map(u => (
                <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                  onEdit={canEdit ? setEditingMember : null}
                  onTerminate={canEdit ? handleTerminate : undefined}
                  onImpersonate={can.impersonate ? handleImpersonate : undefined}
                  isAnyOrgHead={headIdsAll.has(u.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── 조직 트리 + 구성원 패널 ── */
        <div className="flex gap-0 bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden"
          style={{ minHeight: '480px' }}>

          {/* Left: Org tree */}
          <div className="w-64 flex-shrink-0 border-r border-gray-010 flex flex-col">
            <div className="flex items-center justify-between px-3 py-3 border-b border-gray-010">
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-gray-040" />
                <span className="text-xs font-semibold text-gray-060">조직 구조</span>
              </div>
              {canEdit && (
                <button onClick={() => setOrgModal({ mode: 'add', type: 'mainOrg' })}
                  title="주조직 추가"
                  className="p-1 rounded text-gray-040 hover:text-green-060 hover:bg-green-005 transition-colors">
                  <MsPlusIcon size={12} className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* 전체 보기 */}
              <button
                onClick={selectAll}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  !selectedOrgId && !showTerminated && !showUnassigned ? 'bg-pink-005 text-pink-060 font-medium' : 'text-gray-060 hover:bg-gray-005'
                }`}
              >
                <MsGroupIcon size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left">전체 구성원</span>
                <span className="text-xs text-gray-040">{totalNonAdmin}</span>
              </button>

              {/* 소속 없음 */}
              {unassignedUsers.length > 0 && (
                <button
                  onClick={selectUnassigned}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    showUnassigned ? 'bg-pink-005 text-pink-060 font-medium' : 'text-gray-060 hover:bg-gray-005'
                  }`}
                >
                  <MsWarningIcon size={14} className="flex-shrink-0 text-yellow-050" />
                  <span className="flex-1 text-left">소속 없음</span>
                  <span className="text-xs text-yellow-050 font-semibold">{unassignedUsers.length}</span>
                </button>
              )}

              {orgUnits.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-gray-040 mb-2">조직 구조가 없습니다.</p>
                  {canEdit && (
                    <button onClick={() => setOrgModal({ mode: 'add', type: 'mainOrg' })}
                      className="text-xs text-pink-050 hover:text-pink-060 font-medium">
                      + 주조직 추가
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1">
                  {mainOrgs.map(unit => (
                    <OrgTreeNode
                      key={unit.id}
                      unit={unit}
                      allUnits={orgUnits}
                      selectedId={selectedOrgId}
                      onSelect={selectOrg}
                      onEditUnit={unit => setOrgModal({ mode: 'edit', unit })}
                      onDeleteUnit={handleDeleteUnit}
                      onAddChild={(type, parentId) => setOrgModal({ mode: 'add', type, parentId })}
                      onAddMember={unitId => {
                        const unit = orgUnits.find(u => u.id === unitId);
                        setAddMemberModal({ unitId, managerId: unit?.headId });
                      }}
                      depth={0}
                      dnd={dnd}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Member panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-010">
              <div>
                {showTerminated ? (
                  <p className="text-sm font-semibold text-gray-080">퇴사자 목록</p>
                ) : showUnassigned ? (
                  <p className="text-sm font-semibold text-gray-080">소속 없음</p>
                ) : selectedUnit ? (
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${ORG_TYPE_COLOR[selectedUnit.type]}`} />
                    <p className="text-sm font-semibold text-gray-080">{selectedUnit.name}</p>
                    <span className="text-xs text-gray-040">{ORG_TYPE_LABEL[selectedUnit.type]}</span>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-080">전체 구성원</p>
                )}
                <p className="text-xs text-gray-040 mt-0.5">{panelUsers.length}명</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !showTerminated && panelUsers.filter(u => u.role !== 'admin').length > 0 && (
                  <MsCheckbox
                    title="전체 선택"
                    checked={panelUsers.filter(u => u.role !== 'admin').every(u => selectedIds.has(u.id))}
                    indeterminate={panelUsers.filter(u => u.role !== 'admin').some(u => selectedIds.has(u.id)) && !panelUsers.filter(u => u.role !== 'admin').every(u => selectedIds.has(u.id))}
                    onChange={() => toggleSelectAll(panelUsers)}
                  />
                )}
                {canEdit && !showTerminated && (
                  <MsButton
                    onClick={() => {
                      const unit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
                      setAddMemberModal({ unitId: selectedOrgId ?? undefined, managerId: unit?.headId });
                    }}
                    size="sm"
                    leftIcon={<MsFriendAddIcon size={12} />}
                  >
                    구성원 추가
                  </MsButton>
                )}
              </div>
            </div>

            {/* Member list */}
            {isLoading && panelUsers.length === 0 ? (
              <div className="flex-1 space-y-0 animate-pulse p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="size-8 rounded-full bg-gray-020 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-020 rounded w-24" />
                      <div className="h-2.5 bg-gray-010 rounded w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : panelUsers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                <Users className="size-8 text-gray-020" />
                <p className="text-sm text-gray-040">
                  {selectedUnit ? `${selectedUnit.name}에 구성원이 없습니다.` : '구성원이 없습니다.'}
                </p>
                {canEdit && !showTerminated && (
                  <button
                    onClick={() => setAddMemberModal({ unitId: selectedOrgId ?? undefined })}
                    className="text-xs font-medium text-pink-050 hover:text-pink-060">
                    + 구성원 추가
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {panelUsers.map(u => (
                  <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                    onEdit={canEdit ? setEditingMember : null}
                    onTerminate={canEdit && !showTerminated ? handleTerminate : undefined}
                    onImpersonate={can.impersonate && !showTerminated ? handleImpersonate : undefined}
                    selected={selectedIds.has(u.id)}
                    onToggle={canEdit && !showTerminated ? toggleMember : undefined}
                    selectionActive={selectedIds.size > 0}
                    secondaryAssignmentHere={secondaryMapHere.get(u.id)}
                    isOrgHeadHere={!secondaryMapHere.has(u.id) && selectedUnit?.headId === u.id}
                    isAnyOrgHead={headIdsAll.has(u.id)} />
                ))}
              </div>
            )}
            {canEdit && selectedIds.size > 0 && !showTerminated && (
              <div className="border-t border-gray-010 px-4 py-3 bg-blue-005 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-medium text-blue-070">{selectedIds.size}명 선택됨</span>
                <div className="flex items-center gap-2">
                  <MsButton variant="ghost" size="sm" onClick={clearSelection}>선택 해제</MsButton>
                  <MsButton
                    size="sm"
                    leftIcon={<MsChevronRightLineIcon size={12} />}
                    onClick={() => setShowBulkMove(true)}
                    className="bg-blue-060 text-white hover:bg-blue-070"
                  >
                    조직 이동
                  </MsButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showBulkMove && (
        <BulkMoveModal
          selectedUsers={users.filter(u => selectedIds.has(u.id))}
          onConfirm={handleBulkMove}
          onClose={() => setShowBulkMove(false)}
        />
      )}
      {addMemberModal && (
        <AddMemberModal
          onClose={() => setAddMemberModal(null)}
          initialOrgId={addMemberModal.unitId}
          initialManagerId={addMemberModal.managerId}
        />
      )}
      {editingMember && (
        <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />
      )}
      {orgModal && (
        <OrgUnitFormModal
          editing={orgModal.mode === 'edit' ? orgModal.unit : undefined}
          addType={orgModal.mode === 'add' ? orgModal.type : undefined}
          addParentId={orgModal.mode === 'add' ? orgModal.parentId : undefined}
          onClose={() => setOrgModal(null)}
        />
      )}

      {/* R5-b: 마스터 로그인 시작 확인 */}
      <ConfirmDialog
        open={impersonateTarget !== null}
        onClose={() => setImpersonateTarget(null)}
        onConfirm={(reason) => confirmImpersonate(reason)}
        title="마스터 로그인 시작"
        description={impersonateTarget ? (
          <>
            <strong>{impersonateTarget.name}</strong>({impersonateTarget.email})으로 접속합니다.
            <br />
            화면 조회만 가능하며 작성·수정·제출은 차단됩니다.
            <br />
            모든 동작은 감사 로그에 기록됩니다.
          </>
        ) : null}
        confirmLabel="접속"
        tone="danger"
      />
    </div>
  );
}

/* ── Entry Point ────────────────────────────────────────────────────── */
export function Team() {
  const { isAdmin } = usePermission();
  return <AdminView canEdit={isAdmin} />;
}
