import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { usePermission } from '../hooks/usePermission';
import { useTeamStore } from '../stores/teamStore';
import type { User } from '../types';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Badge } from '../components/catalyst/badge';
import { Heading } from '../components/catalyst/heading';
import { Divider } from '../components/catalyst/divider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/catalyst/table';
import {
  Building2, Users, UserCheck, Mail, ChevronDown, ChevronRight,
  Plus, Trash2, X, UserPlus,
} from 'lucide-react';

const ROLE_COLOR = {
  admin:    'indigo' as const,
  manager:  'emerald' as const,
  employee: 'zinc' as const,
};
const ROLE_LABEL = { admin: '관리자', manager: '팀장', employee: '팀원' };
const AVATAR_COLORS = [
  '#4f46e5','#059669','#0891b2','#7c3aed','#0369a1',
  '#6d28d9','#0f766e','#be185d','#b45309','#dc2626',
];

/* ── Shared Modal Shell ─────────────────────────────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-modal ring-1 ring-zinc-950/5 w-full max-w-md mx-4">
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

/* ── Create Team Modal ──────────────────────────────────────────────── */
function CreateTeamModal({ onClose }: { onClose: () => void }) {
  const { createTeam } = useTeamStore();
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    createTeam(trimmed);
    onClose();
  };

  return (
    <Modal title="팀 만들기" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">팀 이름</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예) 마케팅팀"
            className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:border-zinc-950/20 focus:bg-white"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">
            취소
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            만들기
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Add Member Modal ───────────────────────────────────────────────── */
function AddMemberModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const { users, teams, addMember, createMember } = useTeamStore();
  const [tab, setTab] = useState<'existing' | 'new'>('existing');

  // Existing users not in this team
  const eligible = users.filter(u => u.department !== teamId && u.role !== 'admin');
  const managers = users.filter(u => u.department === teamId && u.role === 'manager');

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState(managers[0]?.id ?? '');

  // New member form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newRole, setNewRole] = useState<'manager' | 'employee'>('employee');
  const [newManagerId, setNewManagerId] = useState(managers[0]?.id ?? '');

  const handleAddExisting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    addMember(selectedUserId, teamId, selectedManagerId || undefined);
    onClose();
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;
    createMember({
      name: newName.trim(),
      email: newEmail.trim(),
      position: newPosition.trim() || '팀원',
      role: newRole,
      department: teamId,
      managerId: newRole === 'employee' ? (newManagerId || undefined) : undefined,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });
    onClose();
  };

  return (
    <Modal title={`${teamId}에 구성원 추가`} onClose={onClose}>
      {/* Tab */}
      <div className="flex gap-1 mb-4 bg-zinc-100 rounded-lg p-1">
        {(['existing', 'new'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === t ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            {t === 'existing' ? '기존 구성원' : '새 구성원 추가'}
          </button>
        ))}
      </div>

      {tab === 'existing' ? (
        <form onSubmit={handleAddExisting} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">구성원 선택</label>
            {eligible.length === 0 ? (
              <p className="text-sm text-zinc-400 py-2">배정 가능한 구성원이 없습니다.</p>
            ) : (
              <select
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5"
              >
                <option value="">선택하세요</option>
                {eligible.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.department} · {u.position})
                  </option>
                ))}
              </select>
            )}
          </div>
          {managers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">보고 대상 (선택)</label>
              <select
                value={selectedManagerId}
                onChange={e => setSelectedManagerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5"
              >
                <option value="">없음</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">취소</button>
            <button
              type="submit"
              disabled={!selectedUserId}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              추가
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleCreateNew} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">이름 *</label>
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">직책</label>
              <input
                type="text"
                value={newPosition}
                onChange={e => setNewPosition(e.target.value)}
                placeholder="개발자"
                className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">이메일 *</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">역할</label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as 'manager' | 'employee')}
              className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5"
            >
              <option value="employee">팀원</option>
              <option value="manager">팀장</option>
            </select>
          </div>
          {newRole === 'employee' && managers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">보고 대상</label>
              <select
                value={newManagerId}
                onChange={e => setNewManagerId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5"
              >
                <option value="">없음</option>
                {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">취소</button>
            <button
              type="submit"
              disabled={!newName.trim() || !newEmail.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              추가
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/* ── Delete Team Confirm Modal ──────────────────────────────────────── */
function DeleteTeamModal({ teamId, memberCount, onClose }: { teamId: string; memberCount: number; onClose: () => void }) {
  const { deleteTeam } = useTeamStore();

  const handleConfirm = () => {
    deleteTeam(teamId);
    onClose();
  };

  return (
    <Modal title="팀 삭제" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          <span className="font-semibold text-zinc-950">'{teamId}'</span>을 삭제하시겠어요?
          {memberCount > 0 && (
            <> 소속 구성원 <span className="font-semibold">{memberCount}명</span>은 '미배정' 상태가 됩니다.</>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors">취소</button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ── Admin View ─────────────────────────────────────────────────────── */
function AdminView() {
  const { users, teams, removeMember } = useTeamStore();
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(['개발팀', '디자인팀', '인사팀']));
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [addMemberTeam, setAddMemberTeam] = useState<string | null>(null);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);

  const toggle = (dept: string) =>
    setExpandedDepts(prev => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });

  const grouped = teams.map(team => {
    const members = users.filter(u => u.department === team.id);
    const manager = members.find(u => u.role === 'manager');
    const employees = members.filter(u => u.role !== 'admin' && u.role !== 'manager');
    const nonAdmins = members.filter(u => u.role !== 'admin');
    return { team, manager, employees, total: nonAdmins.length, nonAdmins };
  });

  const totalMembers = users.filter(u => u.role !== 'admin').length;
  const totalManagers = users.filter(u => u.role === 'manager').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Heading>팀 구성</Heading>
        <button
          onClick={() => setShowCreateTeam(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="size-4" />
          팀 만들기
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users,     label: '전체 구성원', value: `${totalMembers}명`,         sub: '관리자 제외' },
          { icon: Building2, label: '팀',          value: `${grouped.length}개`,        sub: '운영 중' },
          { icon: UserCheck, label: '팀장',         value: `${totalManagers}명`,          sub: '팀 리더' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Icon className="size-4 text-zinc-500" />
              </div>
              <span className="text-xs/5 text-zinc-500">{label}</span>
            </div>
            <p className="text-2xl font-semibold text-zinc-950">{value}</p>
            <p className="text-xs/5 text-zinc-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Team Cards */}
      <div className="space-y-3">
        {grouped.map(({ team, manager, employees, total, nonAdmins }) => {
          const isOpen = expandedDepts.has(team.id);
          return (
            <div key={team.id} className="bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card overflow-hidden">
              {/* Team Header */}
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  onClick={() => toggle(team.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-75 transition-opacity"
                >
                  <div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Building2 className="size-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm/6 font-semibold text-zinc-950">{team.name}</p>
                    {manager && <p className="text-xs/5 text-zinc-500">팀장: {manager.name}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs/5 font-medium text-zinc-500 tabular-nums">{total}명</span>
                    {isOpen
                      ? <ChevronDown className="size-4 text-zinc-400" />
                      : <ChevronRight className="size-4 text-zinc-400" />
                    }
                  </div>
                </button>

                {/* Team actions */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  <button
                    onClick={() => setAddMemberTeam(team.id)}
                    title="구성원 추가"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <UserPlus className="size-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTeamId(team.id)}
                    title="팀 삭제"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>

              {/* Member Table */}
              {isOpen && (
                <>
                  <Divider soft />
                  {nonAdmins.length === 0 ? (
                    <div className="py-10 text-center">
                      <Users className="size-7 text-zinc-200 mx-auto mb-2" />
                      <p className="text-sm text-zinc-400">구성원이 없습니다.</p>
                      <button
                        onClick={() => setAddMemberTeam(team.id)}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                      >
                        <Plus className="size-3.5" /> 구성원 추가
                      </button>
                    </div>
                  ) : (
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeader>이름</TableHeader>
                          <TableHeader>직책</TableHeader>
                          <TableHeader>역할</TableHeader>
                          <TableHeader>이메일</TableHeader>
                          <TableHeader>보고 대상</TableHeader>
                          <TableHeader><span className="sr-only">액션</span></TableHeader>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...(manager ? [manager] : []), ...employees].map(user => {
                          const reportsTo = users.find(u => u.id === user.managerId);
                          return (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <UserAvatar user={user} size="sm" />
                                  <span className="text-sm/6 font-medium text-zinc-950">{user.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-zinc-500">{user.position}</TableCell>
                              <TableCell>
                                <Badge color={ROLE_COLOR[user.role]}>{ROLE_LABEL[user.role]}</Badge>
                              </TableCell>
                              <TableCell>
                                <a href={`mailto:${user.email}`} className="flex items-center gap-1.5 text-zinc-500 hover:text-indigo-600 transition-colors text-sm/6">
                                  <Mail className="size-3.5 shrink-0" />
                                  {user.email}
                                </a>
                              </TableCell>
                              <TableCell className="text-zinc-500">
                                {reportsTo ? reportsTo.name : '—'}
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={() => removeMember(user.id)}
                                  title="팀에서 제거"
                                  className="p-1 rounded text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                >
                                  <X className="size-3.5" />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {showCreateTeam && <CreateTeamModal onClose={() => setShowCreateTeam(false)} />}
      {addMemberTeam && <AddMemberModal teamId={addMemberTeam} onClose={() => setAddMemberTeam(null)} />}
      {deleteTeamId && (
        <DeleteTeamModal
          teamId={deleteTeamId}
          memberCount={users.filter(u => u.department === deleteTeamId && u.role !== 'admin').length}
          onClose={() => setDeleteTeamId(null)}
        />
      )}
    </div>
  );
}

/* ── Manager View ───────────────────────────────────────────────────── */
function ManagerView() {
  const { currentUser } = useAuthStore();
  const { users } = useTeamStore();
  const myTeam = users.filter(u => u.managerId === currentUser?.id);

  return (
    <div className="space-y-6">
      <Heading>팀 구성</Heading>

      <div className="bg-white rounded-xl ring-1 ring-zinc-950/5 shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-950/5">
          <div className="size-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Users className="size-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm/6 font-semibold text-zinc-950">
              {currentUser?.department ?? '내 팀'}
            </p>
            <p className="text-xs/5 text-zinc-500">팀원 {myTeam.length}명</p>
          </div>
        </div>

        {myTeam.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="size-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm/6 text-zinc-500">등록된 팀원이 없습니다.</p>
          </div>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>이름</TableHeader>
                <TableHeader>직책</TableHeader>
                <TableHeader>이메일</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {myTeam.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <UserAvatar user={user} size="sm" />
                      <span className="text-sm/6 font-medium text-zinc-950">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-500">{user.position}</TableCell>
                  <TableCell>
                    <a href={`mailto:${user.email}`} className="flex items-center gap-1.5 text-zinc-500 hover:text-indigo-600 transition-colors text-sm/6">
                      <Mail className="size-3.5 shrink-0" />
                      {user.email}
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────── */
export function Team() {
  const { isAdmin } = usePermission();
  return isAdmin ? <AdminView /> : <ManagerView />;
}
