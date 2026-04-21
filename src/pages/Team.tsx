import { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePermission } from '../hooks/usePermission';
import { useTeamStore } from '../stores/teamStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { useShowToast } from '../components/ui/Toast';
import { resetAccount } from '../utils/authApi';
import { UserAvatar } from '../components/ui/UserAvatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Heading } from '../components/catalyst/heading';
import {
  Building2, Users, UserCheck, Plus, X, Pencil, Search,
  ChevronRight, ChevronDown, Trash2, KeyRound, RefreshCw,
  UserPlus, Layers, GripVertical, ArrowRight,
} from 'lucide-react';
import type { User, OrgUnit, OrgUnitType, SecondaryOrgAssignment } from '../types';

/* ── Constants ──────────────────────────────────────────────────────── */
const ORG_TYPE_LABEL: Record<OrgUnitType, string> = {
  mainOrg: '주조직', subOrg: '부조직', team: '팀', squad: '스쿼드',
};
const ORG_TYPE_PLACEHOLDER: Record<OrgUnitType, string> = {
  mainOrg: '예) 개발본부', subOrg: '예) 플랫폼부', team: '예) 프론트엔드팀', squad: '예) 플랫폼스쿼드',
};
const ORG_TYPE_NEXT: Record<OrgUnitType, OrgUnitType | null> = {
  mainOrg: 'subOrg', subOrg: 'team', team: 'squad', squad: null,
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
    u.department.toLowerCase().includes(lq) ||
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
      <div className={`relative bg-white rounded-xl shadow-xl ring-1 ring-zinc-950/5 w-full mx-4 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-950/5">
          <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X className="size-4" />
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
  const sel = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5';
  const lbl = 'block text-xs font-medium text-zinc-500 mb-1';

  const mainOrgs = orgUnits.filter(u => u.type === 'mainOrg').sort((a, b) => a.order - b.order);
  const subOrgs  = orgUnits.filter(u => u.type === 'subOrg'  && u.parentId === value.mainOrgId);
  const teams    = orgUnits.filter(u => u.type === 'team'    && u.parentId === (value.subOrgId || value.mainOrgId));
  const squads   = orgUnits.filter(u => u.type === 'squad'   && u.parentId === value.teamId);

  return (
    <div className="col-span-2 space-y-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">조직 배정</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>주조직</label>
          <select value={value.mainOrgId}
            onChange={e => onChange({ mainOrgId: e.target.value, subOrgId: '', teamId: '', squadId: '' })}
            className={sel}>
            <option value="">선택</option>
            {mainOrgs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        {(subOrgs.length > 0 || value.subOrgId) && (
          <div>
            <label className={lbl}>부조직</label>
            <select value={value.subOrgId}
              onChange={e => onChange({ ...value, subOrgId: e.target.value, teamId: '', squadId: '' })}
              className={sel}>
              <option value="">선택 안 함</option>
              {subOrgs.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        {(teams.length > 0 || value.teamId) && (
          <div>
            <label className={lbl}>팀</label>
            <select value={value.teamId}
              onChange={e => onChange({ ...value, teamId: e.target.value, squadId: '' })}
              className={sel}>
              <option value="">선택 안 함</option>
              {teams.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
        {(squads.length > 0 || value.squadId) && (
          <div>
            <label className={lbl}>스쿼드</label>
            <select value={value.squadId}
              onChange={e => onChange({ ...value, squadId: e.target.value })}
              className={sel}>
              <option value="">선택 안 함</option>
              {squads.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Secondary Org Section ──────────────────────────────────────────── */
function SecondaryOrgSection({ userId }: { userId: string }) {
  const { orgUnits, secondaryOrgs, upsertSecondaryOrg, removeSecondaryOrg } = useTeamStore();
  const myAssignments = secondaryOrgs.filter(a => a.userId === userId);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ orgId: '', position: '', startDate: '', endDate: '', ratio: '' });

  const sel = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5';
  const inp = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white';
  const allOrgs = orgUnits.filter(u => u.type !== 'squad');

  const handleAdd = () => {
    if (!form.orgId || !form.position) return;
    const org = orgUnits.find(u => u.id === form.orgId);
    upsertSecondaryOrg({
      userId, orgId: form.orgId, orgName: org?.name,
      position:  form.position,
      startDate: form.startDate || new Date().toISOString().slice(0, 10),
      endDate:   form.endDate || undefined,
      ratio:     form.ratio ? parseFloat(form.ratio) : undefined,
    });
    setAdding(false);
    setForm({ orgId: '', position: '', startDate: '', endDate: '', ratio: '' });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">겸임 발령</p>
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
            <Plus className="size-3" /> 추가
          </button>
        )}
      </div>
      {myAssignments.length === 0 && !adding && (
        <p className="text-xs text-zinc-400 py-1">겸임 발령이 없습니다.</p>
      )}
      {myAssignments.map(a => (
        <div key={`${a.userId}-${a.orgId}`}
          className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-800">{a.orgName ?? a.orgId}</p>
            <p className="text-xs text-zinc-500">{a.position}{a.ratio ? ` · ${a.ratio}%` : ''}</p>
            <p className="text-xs text-zinc-400">{a.startDate}{a.endDate ? ` ~ ${a.endDate}` : ' ~'}</p>
          </div>
          <button onClick={() => removeSecondaryOrg(userId, a.orgId)}
            className="p-1 text-zinc-300 hover:text-rose-500 transition-colors flex-shrink-0">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      {adding && (
        <div className="p-3 rounded-lg border border-primary-100 bg-primary-50/40 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">겸임 조직</label>
              <select value={form.orgId} onChange={e => setForm(f => ({ ...f, orgId: e.target.value }))} className={sel}>
                <option value="">선택</option>
                {allOrgs.map(u => <option key={u.id} value={u.id}>{u.name} ({ORG_TYPE_LABEL[u.type]})</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">겸임 직책</label>
              <input type="text" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                placeholder="예) 팀원" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">시작일</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">종료일</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">겸임 비율 (%)</label>
              <input type="number" min="0" max="100" value={form.ratio}
                onChange={e => setForm(f => ({ ...f, ratio: e.target.value }))}
                placeholder="예) 30" className={inp} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900">취소</button>
            <button type="button" onClick={handleAdd} disabled={!form.orgId || !form.position}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40">
              저장
            </button>
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
  let unit = orgUnits.find(u => u.id === orgId);
  while (unit) {
    if (unit.type === 'mainOrg') result.mainOrgId = unit.id;
    else if (unit.type === 'subOrg') result.subOrgId = unit.id;
    else if (unit.type === 'team') result.teamId = unit.id;
    else if (unit.type === 'squad') result.squadId = unit.id;
    unit = unit.parentId ? orgUnits.find(u => u.id === unit!.parentId) : undefined;
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
  const { users, orgUnits, createMember } = useTeamStore();
  const allLeaders = users.filter(u => u.role !== 'member');
  const adminUser  = users.find(u => u.role === 'admin');

  const [form, setForm] = useState({
    name: '', nameEn: '', email: '', phone: '', joinDate: '',
    position: '', jobFunction: '',
    role: 'member' as 'leader' | 'member',
    managerId: initialManagerId ?? '',
  });
  const [orgSel, setOrgSel] = useState(() => buildInitOrgSel(initialOrgId, orgUnits));

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const inp = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white';
  const sel = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5';
  const lbl = 'block text-xs font-medium text-zinc-500 mb-1';
  const hasOrgUnits = orgUnits.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;

    const department = hasOrgUnits
      ? (orgUnits.find(u => u.id === orgSel.mainOrgId)?.name ?? '미배정')
      : '미배정';
    const subOrg  = orgSel.subOrgId  ? orgUnits.find(u => u.id === orgSel.subOrgId)?.name  : undefined;
    const team    = orgSel.teamId    ? orgUnits.find(u => u.id === orgSel.teamId)?.name    : undefined;
    const squad   = orgSel.squadId   ? orgUnits.find(u => u.id === orgSel.squadId)?.name   : undefined;
    const managerId = form.managerId || adminUser?.id || undefined;

    createMember({
      name:        form.name.trim(),
      nameEn:      form.nameEn.trim()   || undefined,
      email:       form.email.trim(),
      phone:       form.phone.trim()    || undefined,
      joinDate:    form.joinDate        || undefined,
      position:    form.position.trim() || '담당자',
      jobFunction: form.jobFunction.trim() || undefined,
      role:        form.role,
      department,
      subOrg, team, squad,
      managerId,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });
    onClose();
  };

  return (
    <Modal title="구성원 추가" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* 기본 정보 */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>이름 *</label>
              <input autoFocus type="text" value={form.name} onChange={f('name')} placeholder="홍길동" className={inp} />
            </div>
            <div>
              <label className={lbl}>영문이름</label>
              <input type="text" value={form.nameEn} onChange={f('nameEn')} placeholder="Hong Gil-dong" className={inp} />
            </div>
            <div>
              <label className={lbl}>이메일 *</label>
              <input type="email" value={form.email} onChange={f('email')} placeholder="name@company.com" className={inp} />
            </div>
            <div>
              <label className={lbl}>연락처</label>
              <input type="text" value={form.phone} onChange={f('phone')} placeholder="010-0000-0000" className={inp} />
            </div>
            <div>
              <label className={lbl}>입사일</label>
              <input type="date" value={form.joinDate} onChange={f('joinDate')} className={inp} />
            </div>
            <div>
              <label className={lbl}>직무</label>
              <input type="text" value={form.jobFunction} onChange={f('jobFunction')} placeholder="프론트엔드 개발" className={inp} />
            </div>
          </div>
        </div>

        {/* 조직·직책 */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">조직 · 직책</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>직책</label>
              <input type="text" value={form.position} onChange={f('position')} placeholder="개발자" className={inp} />
            </div>
            <div>
              <label className={lbl}>역할</label>
              <select value={form.role} onChange={f('role')} className={sel}>
                <option value="member">팀원</option>
                <option value="leader">조직장</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>보고 대상</label>
              <select value={form.managerId} onChange={f('managerId')} className={sel}>
                <option value="">없음 (자동 배정)</option>
                {allLeaders.map(m => (
                  <option key={m.id} value={m.id}>{m.name} · {m.position}</option>
                ))}
              </select>
            </div>
            {hasOrgUnits && (
              <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={setOrgSel} />
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-zinc-950/5">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">취소</button>
          <button type="submit" disabled={!form.name.trim() || !form.email.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed">
            추가
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Edit Member Modal ──────────────────────────────────────────────── */
function EditMemberModal({ member, onClose }: { member: User; onClose: () => void }) {
  const { users, orgUnits, updateMember, terminateMember } = useTeamStore();
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();
  const allLeaders = users.filter(u => u.role !== 'member' && u.id !== member.id);
  const [showTerminate, setShowTerminate] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().slice(0, 10));
  const [resetting, setResetting] = useState(false);

  const [form, setForm] = useState({
    name:        member.name,
    nameEn:      member.nameEn      ?? '',
    email:       member.email,
    phone:       member.phone       ?? '',
    joinDate:    member.joinDate    ?? '',
    position:    member.position,
    jobFunction: member.jobFunction ?? '',
    department:  member.department,
    role:        (member.role === 'leader' ? 'leader' : 'member') as 'leader' | 'member',
    managerId:   member.managerId   ?? '',
  });

  const [orgSel, setOrgSel] = useState(() => {
    const mainOrg = orgUnits.find(u => u.type === 'mainOrg' && u.name === member.department);
    const subOrg  = mainOrg && member.subOrg
      ? orgUnits.find(u => u.type === 'subOrg' && u.parentId === mainOrg.id && u.name === member.subOrg)
      : undefined;
    const team    = member.team  ? orgUnits.find(u => u.type === 'team'  && u.name === member.team)  : undefined;
    const squad   = member.squad ? orgUnits.find(u => u.type === 'squad' && u.name === member.squad) : undefined;
    return { mainOrgId: mainOrg?.id ?? '', subOrgId: subOrg?.id ?? '', teamId: team?.id ?? '', squadId: squad?.id ?? '' };
  });

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const inp  = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white';
  const sel  = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5';
  const lbl  = 'block text-xs font-medium text-zinc-500 mb-1';
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
      position:    form.position.trim()    || member.position,
      jobFunction: form.jobFunction.trim() || undefined,
      department, subOrg, team, squad,
      role:      form.role,
      managerId: form.managerId || undefined,
    });
    onClose();
  };

  return (
    <Modal title={`${member.name} 정보 수정`} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* 기본 정보 */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>이름</label>
              <input autoFocus type="text" value={form.name} onChange={f('name')} className={inp} />
            </div>
            <div>
              <label className={lbl}>영문이름</label>
              <input type="text" value={form.nameEn} onChange={f('nameEn')} placeholder="Hong Gil-dong" className={inp} />
            </div>
            <div>
              <label className={lbl}>이메일</label>
              <input type="email" value={form.email} onChange={f('email')} className={inp} />
            </div>
            <div>
              <label className={lbl}>연락처</label>
              <input type="text" value={form.phone} onChange={f('phone')} placeholder="010-0000-0000" className={inp} />
            </div>
            <div>
              <label className={lbl}>입사일</label>
              <input type="date" value={form.joinDate} onChange={f('joinDate')} className={inp} />
            </div>
            <div>
              <label className={lbl}>직무</label>
              <input type="text" value={form.jobFunction} onChange={f('jobFunction')} placeholder="프론트엔드 개발" className={inp} />
            </div>
          </div>
        </div>

        {/* 조직·직책 */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">조직 · 직책</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>직책</label>
              <input type="text" value={form.position} onChange={f('position')} className={inp} />
            </div>
            <div>
              <label className={lbl}>역할</label>
              <select value={form.role} onChange={f('role')} className={sel}>
                <option value="member">팀원</option>
                <option value="leader">조직장</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={lbl}>보고 대상</label>
              <select value={form.managerId} onChange={f('managerId')} className={sel}>
                <option value="">없음</option>
                {allLeaders.map(m => (
                  <option key={m.id} value={m.id}>{m.name} · {m.position}</option>
                ))}
              </select>
            </div>
            {!hasOrgUnits && (
              <div>
                <label className={lbl}>주조직</label>
                <input type="text" value={form.department} onChange={f('department')} className={inp} />
              </div>
            )}
            {hasOrgUnits && (
              <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={setOrgSel} />
            )}
          </div>
        </div>

        {/* 겸임 */}
        <div className="border-t border-zinc-950/5 pt-4">
          <SecondaryOrgSection userId={member.id} />
        </div>

        {/* 비밀번호 초기화 (관리자 전용) */}
        {currentUser?.role === 'admin' && member.role !== 'admin' && (
          <div className="border-t border-zinc-950/5 pt-3">
            <button type="button" onClick={handleResetPassword} disabled={resetting}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-amber-600 disabled:opacity-40 transition-colors">
              <KeyRound className="size-3.5" />
              {resetting ? '초기화 중...' : `비밀번호 초기화 (사번: ${member.id})`}
            </button>
          </div>
        )}

        {/* 퇴사 처리 */}
        {member.role !== 'admin' && (
          <div className="border-t border-zinc-950/5 pt-3">
            {!showTerminate ? (
              <button type="button" onClick={() => setShowTerminate(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-rose-500 transition-colors">
                <X className="size-3.5" /> 퇴사 처리
              </button>
            ) : (
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 space-y-3">
                <p className="text-xs font-semibold text-rose-700">퇴사 처리</p>
                <p className="text-xs text-rose-600/80">퇴사 처리 시 보고 관계가 해제되고 조직도에서 제외됩니다.</p>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">퇴사일</label>
                  <input type="date" value={leaveDate} onChange={e => setLeaveDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-rose-200 rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-rose-500/10" />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowTerminate(false)}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900">취소</button>
                  <button type="button" onClick={() => { terminateMember(member.id, leaveDate); onClose(); }} disabled={!leaveDate}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-40">
                    퇴사 확정
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1 border-t border-zinc-950/5">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">취소</button>
          <button type="submit"
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700">
            저장
          </button>
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
  const allLeaders = users.filter(u => u.role !== 'member');
  const [orgSel, setOrgSel] = useState({ mainOrgId: '', subOrgId: '', teamId: '', squadId: '' });
  const [managerId, setManagerId] = useState<string>('__keep__');

  const mostSpecificId = orgSel.squadId || orgSel.teamId || orgSel.subOrgId || orgSel.mainOrgId;
  const mostSpecificUnit = orgUnits.find(u => u.id === mostSpecificId);

  // 조직 선택 시 조직장을 자동 제안
  useEffect(() => {
    setManagerId(mostSpecificUnit?.headId ?? '__keep__');
  }, [mostSpecificId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = 'w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5';
  const lbl = 'block text-xs font-medium text-zinc-500 mb-1';

  return (
    <Modal title={`${selectedUsers.length}명 조직 이동`} onClose={onClose} wide>
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* 선택된 구성원 미리보기 */}
        <div>
          <p className={lbl}>이동할 구성원</p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
            {selectedUsers.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1.5 px-2 py-1 text-xs bg-white border border-zinc-200 rounded-full text-zinc-700 font-medium">
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
          <p className="text-xs text-zinc-400">등록된 조직 구조가 없습니다.</p>
        )}

        {/* 보고 대상 */}
        <div>
          <label className={lbl}>보고 대상</label>
          <select value={managerId} onChange={e => setManagerId(e.target.value)} className={sel}>
            <option value="__keep__">변경하지 않음</option>
            <option value="">없음</option>
            {allLeaders.map(u => (
              <option key={u.id} value={u.id}>{u.name} · {u.position}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-zinc-950/5">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">취소</button>
          <button
            type="button"
            disabled={!orgSel.mainOrgId}
            onClick={() => onConfirm(orgSel, managerId === '__keep__' ? null : managerId)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight className="size-3.5" /> 이동 확정
          </button>
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

  const eligibleHeads = users.filter(u => u.role !== 'member');
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
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">{ORG_TYPE_LABEL[type]} 이름 *</label>
          <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={ORG_TYPE_PLACEHOLDER[type]}
            className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">조직장</label>
          <select value={headId} onChange={e => setHeadId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5">
            <option value="">미지정</option>
            {eligibleHeads.map(u => <option key={u.id} value={u.id}>{u.name} · {u.position}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900">취소</button>
          <button type="submit" disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Org Tree ─────────────────────────────────────────────────────── */
const ORG_TYPE_COLOR: Record<OrgUnitType, string> = {
  mainOrg: 'bg-indigo-500',
  subOrg:  'bg-emerald-400',
  team:    'bg-sky-400',
  squad:   'bg-zinc-300',
};

// 드래그 타겟으로 허용되는 부모 타입
const ALLOWED_CHILD: Partial<Record<OrgUnitType, OrgUnitType>> = {
  mainOrg: 'subOrg', subOrg: 'team', team: 'squad',
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
  depth, dnd,
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
}) {
  const { users, secondaryOrgs } = useTeamStore();
  const [expanded, setExpanded] = useState(depth === 0);
  const [hovered, setHovered] = useState(false);

  const children = allUnits
    .filter(u => u.parentId === unit.id)
    .sort((a, b) => a.order - b.order);
  const hasChildren = children.length > 0;

  const memberCount = useMemo(() => {
    const key: Record<OrgUnitType, keyof User> = {
      mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
    };
    const primaryIds = new Set(
      users.filter(u => u[key[unit.type]] === unit.name && u.isActive !== false).map(u => u.id)
    );
    const secondaryExtra = secondaryOrgs.filter(a => a.orgId === unit.id && !primaryIds.has(a.userId)).length;
    return primaryIds.size + secondaryExtra;
  }, [users, unit, secondaryOrgs]);

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
        <div className="h-0.5 bg-primary-500 rounded-full mx-2 my-px pointer-events-none" />
      )}

      <div
        draggable
        onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; dnd.onDragStart(unit.id); }}
        onDragOver={handleDragOver}
        onDragLeave={e => {
          const rel = e.relatedTarget as Node | null;
          if (!e.currentTarget.contains(rel)) { /* no-op — parent handles clear */ }
        }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(unit.id); }}
        onDragEnd={() => dnd.onDragEnd()}
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors ${
          dropPos === 'into'
            ? 'ring-2 ring-primary-400 bg-primary-50'
            : isSelected
              ? 'bg-primary-50 text-primary-700'
              : 'hover:bg-zinc-50 text-zinc-700'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(unit.id)}
      >
        {/* Drag handle */}
        <span
          className={`flex-shrink-0 cursor-grab active:cursor-grabbing transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}
          title="드래그로 순서·위치 변경"
        >
          <GripVertical className="size-3.5 text-zinc-300" />
        </span>

        {/* expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className={`size-4 flex items-center justify-center flex-shrink-0 rounded transition-colors ${hasChildren ? 'text-zinc-400 hover:text-zinc-700' : 'opacity-0 pointer-events-none'}`}
        >
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        {/* type dot */}
        <span className={`size-2 rounded-full flex-shrink-0 ${ORG_TYPE_COLOR[unit.type]}`} />

        {/* name */}
        <span className={`flex-1 text-sm truncate font-medium ${isSelected ? 'text-primary-700' : ''}`}>
          {unit.name}
        </span>

        {/* member count */}
        {memberCount > 0 && (
          <span className={`text-xs flex-shrink-0 ${isSelected ? 'text-primary-500' : 'text-zinc-400'}`}>
            {memberCount}
          </span>
        )}

        {/* action buttons */}
        {hovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button title="구성원 추가" onClick={() => onAddMember(unit.id)}
              className="p-1 rounded text-zinc-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
              <UserPlus className="size-3" />
            </button>
            {nextType && (
              <button title={`${ORG_TYPE_LABEL[nextType]} 추가`}
                onClick={() => onAddChild(nextType, unit.id)}
                className="p-1 rounded text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                <Plus className="size-3" />
              </button>
            )}
            <button title="편집" onClick={() => onEditUnit(unit)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors">
              <Pencil className="size-3" />
            </button>
            <button title="삭제" onClick={() => onDeleteUnit(unit)}
              className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
              <Trash2 className="size-3" />
            </button>
          </div>
        )}
      </div>

      {dropPos === 'below' && (
        <div className="h-0.5 bg-primary-500 rounded-full mx-2 my-px pointer-events-none" />
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Member Row ─────────────────────────────────────────────────────── */
function MemberRow({
  user, onEdit, onTerminate, secondaryOrgs,
  selected = false, onToggle, selectionActive = false,
  secondaryAssignmentHere, isOrgHeadHere = false,
}: {
  user: User;
  onEdit: ((u: User) => void) | null;
  onTerminate?: (u: User) => void;
  secondaryOrgs: SecondaryOrgAssignment[];
  selected?: boolean;
  onToggle?: (id: string) => void;
  selectionActive?: boolean;
  secondaryAssignmentHere?: SecondaryOrgAssignment;
  isOrgHeadHere?: boolean;
}) {
  const mySecondary = secondaryOrgs.filter(a => a.userId === user.id);
  const canSelect = onToggle && user.role !== 'admin';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors group border-b border-zinc-950/3 last:border-0 ${
        selected ? 'bg-primary-50/60' : 'hover:bg-zinc-50'
      } ${canSelect ? 'cursor-pointer' : ''}`}
      onClick={canSelect ? () => onToggle!(user.id) : undefined}
    >
      {/* 체크박스 */}
      {canSelect && (
        <div
          className={`flex-shrink-0 transition-opacity ${selectionActive || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle!(user.id)}
            className="size-4 rounded accent-indigo-600 cursor-pointer"
          />
        </div>
      )}

      <UserAvatar user={user} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-900">{user.name}</span>
          {(user.role !== 'leader' || isOrgHeadHere) && <StatusBadge type="role" value={user.role} />}
          {secondaryAssignmentHere ? (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 rounded border border-violet-200">
              겸임{secondaryAssignmentHere.position ? ` · ${secondaryAssignmentHere.position}` : ''}
            </span>
          ) : mySecondary.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-50 text-violet-600 rounded border border-violet-100">
              겸임 {mySecondary.length}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 mt-0.5 truncate">
          {secondaryAssignmentHere ? secondaryAssignmentHere.position || user.position : user.position}
          {user.email && <span className="ml-2 text-zinc-300">·</span>}
          {user.email && <span className="ml-1">{user.email}</span>}
        </p>
      </div>
      {onEdit && (
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => onEdit(user)} title="정보 수정"
            className="p-1.5 rounded-md text-zinc-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
            <Pencil className="size-3.5" />
          </button>
          {onTerminate && user.role !== 'admin' && (
            <button onClick={() => onTerminate(user)} title="퇴사 처리"
              className="p-1.5 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Admin View ─────────────────────────────────────────────────────── */
function AdminView() {
  const { users, orgUnits, teams, deleteOrgUnit, updateOrgUnit, updateMember, isLoading, terminateMember } = useTeamStore();
  const { orgSyncEnabled, orgLastSyncedAt, orgSyncError } = useSheetsSyncStore();
  const showToast = useShowToast();

  const [selectedOrgId, setSelectedOrgId]       = useState<string | null>(null);
  const [search, setSearch]                      = useState('');
  const [showTerminated, setShowTerminated]       = useState(false);
  const [addMemberModal, setAddMemberModal]       = useState<{ unitId?: string; managerId?: string } | null>(null);
  const [editingMember,  setEditingMember]        = useState<User | null>(null);
  const [orgModal, setOrgModal] = useState<
    | { mode: 'add'; type: OrgUnitType; parentId?: string }
    | { mode: 'edit'; unit: OrgUnit }
    | null
  >(null);

  /* ── 복수 선택 & 이동 ────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);

  const clearSelection = () => setSelectedIds(new Set());

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
    let cur = snap.find(u => u.id === unitId);
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? snap.find(u => u.id === cur!.parentId) : undefined;
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
    for (const user of users.filter(u => u.isActive !== false && u.role !== 'admin')) {
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

  const activeUsers     = useMemo(() => users.filter(u => u.isActive !== false), [users]);
  const terminatedUsers = useMemo(() => users.filter(u => u.isActive === false), [users]);

  const totalNonAdmin = activeUsers.filter(u => u.role !== 'admin').length;
  const totalLeaders  = activeUsers.filter(u => u.role === 'leader').length;

  /* 선택된 조직의 구성원 */
  const { secondaryOrgs } = useTeamStore();
  const selectedUnit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
  const panelUsers = useMemo(() => {
    if (showTerminated) return terminatedUsers;
    if (!selectedUnit) return activeUsers.filter(u => u.role !== 'admin');

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
    // 조직장을 맨 위로 정렬
    return members.sort((a, b) => {
      if (a.id === selectedUnit.headId) return -1;
      if (b.id === selectedUnit.headId) return 1;
      return 0;
    });
  }, [selectedUnit, activeUsers, terminatedUsers, showTerminated, secondaryOrgs]);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Heading>조직 · 구성원</Heading>
          {orgSyncEnabled && (
            isLoading ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-xs text-zinc-500">
                <RefreshCw className="size-3 animate-spin" /> 동기화 중
              </span>
            ) : orgSyncError ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-xs text-rose-500">
                시트 연결 오류
              </span>
            ) : orgLastSyncedAt ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-xs text-emerald-600">
                <RefreshCw className="size-3" />
                {new Date(orgLastSyncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 동기화됨
              </span>
            ) : null
          )}
        </div>
        <div className="flex items-center gap-2">
          {terminatedUsers.length > 0 && (
            <button onClick={() => { setShowTerminated(v => !v); setSelectedOrgId(null); clearSelection(); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                showTerminated
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300'
              }`}>
              <X className="size-3.5" /> 퇴사자 {terminatedUsers.length}명
            </button>
          )}
          <button onClick={() => {
              const unit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
              setAddMemberModal({ unitId: selectedOrgId ?? undefined, managerId: unit?.headId });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
            <UserPlus className="size-4" /> 구성원 추가
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users,     label: '전체 구성원', value: `${totalNonAdmin}명`,  sub: '재직 중' },
          { icon: Building2, label: '조직',        value: `${teams.length}개`,   sub: '등록된 조직' },
          { icon: UserCheck, label: '조직장',         value: `${totalLeaders}명`,   sub: '조직장' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-7 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Icon className="size-3.5 text-zinc-500" />
              </div>
              <span className="text-xs text-zinc-500">{label}</span>
            </div>
            <p className="text-2xl font-semibold text-zinc-950">{value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
        <input type="text" value={search}
          onChange={e => { setSearch(e.target.value); clearSelection(); }}
          placeholder="이름, 직책, 팀으로 검색..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:border-zinc-950/20" />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
            <X className="size-4" />
          </button>
        )}
      </div>

      {search ? (
        /* ── 검색 결과 ── */
        <div className="bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-950/5">
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-800">'{search}'</span> 검색 결과 {searchResults.length}명
            </p>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">검색 결과가 없습니다.</p>
          ) : (
            <div className="divide-y divide-zinc-950/3">
              {searchResults.map(u => (
                <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                  onEdit={setEditingMember} onTerminate={handleTerminate} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── 조직 트리 + 구성원 패널 ── */
        <div className="flex gap-0 bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card overflow-hidden"
          style={{ minHeight: '480px' }}>

          {/* Left: Org tree */}
          <div className="w-64 flex-shrink-0 border-r border-zinc-950/5 flex flex-col">
            <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-950/5">
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600">조직 구조</span>
              </div>
              <button onClick={() => setOrgModal({ mode: 'add', type: 'mainOrg' })}
                title="주조직 추가"
                className="p-1 rounded text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                <Plus className="size-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* 전체 보기 */}
              <button
                onClick={() => { setSelectedOrgId(null); setShowTerminated(false); clearSelection(); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  !selectedOrgId && !showTerminated ? 'bg-primary-50 text-primary-700 font-medium' : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Users className="size-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">전체 구성원</span>
                <span className="text-xs text-zinc-400">{totalNonAdmin}</span>
              </button>

              {orgUnits.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-zinc-400 mb-2">조직 구조가 없습니다.</p>
                  <button onClick={() => setOrgModal({ mode: 'add', type: 'mainOrg' })}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                    + 주조직 추가
                  </button>
                </div>
              ) : (
                <div className="mt-1">
                  {mainOrgs.map(unit => (
                    <OrgTreeNode
                      key={unit.id}
                      unit={unit}
                      allUnits={orgUnits}
                      selectedId={selectedOrgId}
                      onSelect={id => { setSelectedOrgId(id); setShowTerminated(false); clearSelection(); }}
                      onEditUnit={unit => setOrgModal({ mode: 'edit', unit })}
                      onDeleteUnit={handleDeleteUnit}
                      onAddChild={(type, parentId) => setOrgModal({ mode: 'add', type, parentId })}
                      onAddMember={unitId => {
                        const unit = orgUnits.find(u => u.id === unitId);
                        setAddMemberModal({ unitId, managerId: unit?.headId });
                      }}
                      depth={0}
                      dnd={dnd}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Member panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-950/5">
              <div>
                {showTerminated ? (
                  <p className="text-sm font-semibold text-zinc-800">퇴사자 목록</p>
                ) : selectedUnit ? (
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${ORG_TYPE_COLOR[selectedUnit.type]}`} />
                    <p className="text-sm font-semibold text-zinc-800">{selectedUnit.name}</p>
                    <span className="text-xs text-zinc-400">{ORG_TYPE_LABEL[selectedUnit.type]}</span>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-zinc-800">전체 구성원</p>
                )}
                <p className="text-xs text-zinc-400 mt-0.5">{panelUsers.length}명</p>
              </div>
              <div className="flex items-center gap-2">
                {!showTerminated && panelUsers.filter(u => u.role !== 'admin').length > 0 && (
                  <input
                    type="checkbox"
                    title="전체 선택"
                    checked={panelUsers.filter(u => u.role !== 'admin').every(u => selectedIds.has(u.id))}
                    onChange={() => toggleSelectAll(panelUsers)}
                    className="size-4 rounded accent-indigo-600 cursor-pointer"
                  />
                )}
                {!showTerminated && (
                  <button
                    onClick={() => {
                      const unit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
                      setAddMemberModal({ unitId: selectedOrgId ?? undefined, managerId: unit?.headId });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
                    <UserPlus className="size-3.5" /> 구성원 추가
                  </button>
                )}
              </div>
            </div>

            {/* Member list */}
            {isLoading && panelUsers.length === 0 ? (
              <div className="flex-1 space-y-0 animate-pulse p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="size-8 rounded-full bg-zinc-200 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-zinc-200 rounded w-24" />
                      <div className="h-2.5 bg-zinc-100 rounded w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : panelUsers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                <Users className="size-8 text-zinc-200" />
                <p className="text-sm text-zinc-400">
                  {selectedUnit ? `${selectedUnit.name}에 구성원이 없습니다.` : '구성원이 없습니다.'}
                </p>
                {!showTerminated && (
                  <button
                    onClick={() => setAddMemberModal({ unitId: selectedOrgId ?? undefined })}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700">
                    + 구성원 추가
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {panelUsers.map(u => (
                  <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                    onEdit={setEditingMember}
                    onTerminate={!showTerminated ? handleTerminate : undefined}
                    selected={selectedIds.has(u.id)}
                    onToggle={!showTerminated ? toggleMember : undefined}
                    selectionActive={selectedIds.size > 0}
                    secondaryAssignmentHere={secondaryMapHere.get(u.id)}
                    isOrgHeadHere={!secondaryMapHere.has(u.id) && selectedUnit?.headId === u.id} />
                ))}
              </div>
            )}
            {selectedIds.size > 0 && !showTerminated && (
              <div className="border-t border-zinc-950/5 px-4 py-3 bg-indigo-50 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-medium text-indigo-700">{selectedIds.size}명 선택됨</span>
                <div className="flex items-center gap-2">
                  <button onClick={clearSelection} className="text-xs text-zinc-500 hover:text-zinc-700 transition-colors">선택 해제</button>
                  <button
                    onClick={() => setShowBulkMove(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                    <ArrowRight className="size-3" /> 조직 이동
                  </button>
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
    </div>
  );
}

/* ── Manager View ───────────────────────────────────────────────────── */
function ManagerView() {
  const { currentUser } = useAuthStore();
  const { users, secondaryOrgs } = useTeamStore();
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [search, setSearch] = useState('');

  if (!currentUser) return null;

  function collectTeam(uid: string): User[] {
    const directs = users.filter(u => u.managerId === uid);
    return [...directs, ...directs.flatMap(u => collectTeam(u.id))];
  }

  const myTeam = useMemo(() => collectTeam(currentUser.id).filter(u => u.isActive !== false), [users]);
  const displayed = search ? myTeam.filter(u => matchesSearch(u, search)) : myTeam;

  return (
    <div className="space-y-5">
      <Heading>내 팀</Heading>

      <div className="bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-950/5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="이름, 직책으로 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white" />
          </div>
          <span className="text-xs text-zinc-400 flex-shrink-0">전체 {myTeam.length}명</span>
        </div>

        {displayed.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-12">팀원이 없습니다.</p>
        ) : (
          <div className="divide-y divide-zinc-950/3">
            {displayed.map(u => (
              <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs} onEdit={setEditingMember} />
            ))}
          </div>
        )}
      </div>

      {editingMember && <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />}
    </div>
  );
}

function MemberView() {
  const { currentUser } = useAuthStore();
  const { users, secondaryOrgs } = useTeamStore();
  const [search, setSearch] = useState('');

  if (!currentUser) return null;

  const colleagues = useMemo(
    () => users.filter(u => u.isActive !== false && u.department === currentUser.department && u.id !== currentUser.id),
    [users, currentUser],
  );
  const displayed = search ? colleagues.filter(u => matchesSearch(u, search)) : colleagues;

  return (
    <div className="space-y-5">
      <Heading>우리 팀</Heading>
      <div className="bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-950/5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="이름, 직책으로 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white" />
          </div>
          <span className="text-xs text-zinc-400 flex-shrink-0">{currentUser.department} · {colleagues.length}명</span>
        </div>
        {displayed.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-12">같은 부서 구성원이 없습니다.</p>
        ) : (
          <div className="divide-y divide-zinc-950/3">
            {displayed.map(u => (
              <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs} onEdit={null} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Entry Point ────────────────────────────────────────────────────── */
export function Team() {
  const { currentUser } = useAuthStore();
  const { isAdmin } = usePermission();
  if (isAdmin) return <AdminView />;
  if (currentUser?.role === 'leader') return <ManagerView />;
  return <MemberView />;
}
