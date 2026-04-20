import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, OrgUnit, OrgUnitType, SecondaryOrgAssignment } from '../types';
import { sheetWriter, generateEmployeeId } from '../utils/sheetWriter';
import { orgUnitWriter, secondaryOrgWriter } from '../utils/sheetWriter';
import { initAccount } from '../utils/authApi';

export interface Team {
  id: string;
  name: string;
}

function deriveTeams(users: User[]): Team[] {
  const depts = Array.from(new Set(users.map(u => u.department)));
  return depts.map(d => ({ id: d, name: d }));
}

function generateOrgUnitId(type: OrgUnitType, name: string): string {
  const prefix = { mainOrg: 'MO', subOrg: 'SO', team: 'TM', squad: 'SQ' }[type];
  const slug = name.replace(/\s+/g, '_').toUpperCase().slice(0, 8);
  return `${prefix}_${slug}_${Date.now().toString(36).slice(-4)}`;
}

interface TeamStore {
  users: User[];
  teams: Team[];
  orgUnits: OrgUnit[];
  secondaryOrgs: SecondaryOrgAssignment[];
  isLoading: boolean;

  // 구성원 CRUD
  createTeam: (name: string) => void;
  renameTeam: (teamId: string, newName: string) => void;
  deleteTeam: (teamId: string) => void;
  addMember: (userId: string, teamId: string, managerId?: string) => void;
  removeMember: (userId: string) => void;
  createMember: (member: Omit<User, 'id'>) => Promise<void>;
  updateMember: (userId: string, patch: Partial<Omit<User, 'id'>>) => void;
  terminateMember: (userId: string, leaveDate: string) => void;

  // 조직 단위 CRUD
  addOrgUnit: (unit: Omit<OrgUnit, 'id'>) => void;
  updateOrgUnit: (id: string, patch: Partial<Omit<OrgUnit, 'id'>>) => void;
  deleteOrgUnit: (id: string) => void;
  reorderOrgUnit: (id: string, direction: 'up' | 'down') => void;

  // 겸임 CRUD
  upsertSecondaryOrg: (assignment: SecondaryOrgAssignment) => void;
  removeSecondaryOrg: (userId: string, orgId: string) => void;

  // 시트 연동
  syncFromSheet: (
    users: User[],
    orgUnits?: OrgUnit[],
    secondaryOrgs?: SecondaryOrgAssignment[],
  ) => void;
  setLoading: (v: boolean) => void;
}

export const useTeamStore = create<TeamStore>()(
  persist(
    (set, get) => ({
  users: [],
  teams: [],
  orgUnits: [],
  secondaryOrgs: [],
  isLoading: false,

  /* ── 구성원 ──────────────────────────────────────────────────────── */
  createTeam: (name) =>
    set(state => {
      if (state.teams.find(t => t.name === name)) return state;
      return { teams: [...state.teams, { id: name, name }] };
    }),

  renameTeam: (teamId, newName) =>
    set(state => {
      if (!newName.trim() || state.teams.find(t => t.name === newName && t.id !== teamId)) return state;
      const updatedUsers = state.users.map(u =>
        u.department === teamId ? { ...u, department: newName } : u
      );
      const affected = updatedUsers.filter(u => u.department === newName);
      if (affected.length > 0) sheetWriter.batchUpsert(affected);
      return {
        teams: state.teams.map(t => t.id === teamId ? { id: newName, name: newName } : t),
        users: updatedUsers,
      };
    }),

  deleteTeam: (teamId) =>
    set(state => ({
      teams: state.teams.filter(t => t.id !== teamId),
      users: state.users.map(u =>
        u.department === teamId ? { ...u, department: '미배정', managerId: undefined } : u
      ),
    })),

  addMember: (userId, teamId, managerId) =>
    set(state => {
      const updatedUsers = state.users.map(u =>
        u.id === userId ? { ...u, department: teamId, managerId } : u
      );
      const updated = updatedUsers.find(u => u.id === userId);
      if (updated) sheetWriter.update(updated);
      return { users: updatedUsers };
    }),

  removeMember: (userId) => {
    sheetWriter.remove(userId);
    set(state => ({ users: state.users.filter(u => u.id !== userId) }));
  },

  createMember: async (member) => {
    // 1. Apps Script에 사번 생성 위임 (전체 탭 스캔 → 중복 없는 다음 번호 반환)
    const assignedId = await sheetWriter.create(member);

    // 2. 네트워크 오류 등 실패 시 클라이언트 폴백
    const id = assignedId ?? generateEmployeeId(get().users);
    const newUser: User = { id, ...member };

    // 3. 폴백으로 생성된 경우 시트에 명시적 기록
    if (!assignedId) sheetWriter.createWithId(newUser);

    set(s => ({ users: [...s.users, newUser] }));
    initAccount(id, member.email).catch(e => console.error('[Auth] initAccount:', e));
  },

  updateMember: (userId, patch) =>
    set(state => {
      const existing = state.users.find(u => u.id === userId);
      if (!existing) return state;
      const updated = { ...existing, ...patch };
      sheetWriter.update(updated);
      return { users: state.users.map(u => u.id === userId ? updated : u) };
    }),

  terminateMember: (userId, leaveDate) =>
    set(state => {
      const existing = state.users.find(u => u.id === userId);
      if (!existing) return state;
      const updated = { ...existing, isActive: false, leaveDate, managerId: undefined };
      sheetWriter.update(updated);
      return { users: state.users.map(u => u.id === userId ? updated : u) };
    }),

  /* ── 조직 단위 ───────────────────────────────────────────────────── */
  addOrgUnit: (unit) =>
    set(state => {
      const id = generateOrgUnitId(unit.type, unit.name);
      const newUnit: OrgUnit = { id, ...unit };
      orgUnitWriter.upsert(newUnit);
      return { orgUnits: [...state.orgUnits, newUnit] };
    }),

  updateOrgUnit: (id, patch) =>
    set(state => {
      const existing = state.orgUnits.find(u => u.id === id);
      if (!existing) return state;
      const updated = { ...existing, ...patch };
      orgUnitWriter.upsert(updated);
      return { orgUnits: state.orgUnits.map(u => u.id === id ? updated : u) };
    }),

  deleteOrgUnit: (id) => {
    // 하위 조직도 함께 삭제
    const allUnits = get().orgUnits;
    const getDescendantIds = (unitId: string): string[] => {
      const children = allUnits.filter(u => u.parentId === unitId).map(u => u.id);
      return [unitId, ...children.flatMap(getDescendantIds)];
    };
    const toDelete = getDescendantIds(id);
    toDelete.forEach(uid => orgUnitWriter.delete(uid));
    set(state => ({ orgUnits: state.orgUnits.filter(u => !toDelete.includes(u.id)) }));
  },

  reorderOrgUnit: (id, direction) =>
    set(state => {
      const unit = state.orgUnits.find(u => u.id === id);
      if (!unit) return state;
      const siblings = state.orgUnits
        .filter(u => u.type === unit.type && u.parentId === unit.parentId)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex(u => u.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return state;
      const swapUnit = siblings[swapIdx];
      const newUnits = state.orgUnits.map(u => {
        if (u.id === id) return { ...u, order: swapUnit.order };
        if (u.id === swapUnit.id) return { ...u, order: unit.order };
        return u;
      });
      orgUnitWriter.upsert(newUnits.find(u => u.id === id)!);
      orgUnitWriter.upsert(newUnits.find(u => u.id === swapUnit.id)!);
      return { orgUnits: newUnits };
    }),

  /* ── 겸임 ────────────────────────────────────────────────────────── */
  upsertSecondaryOrg: (assignment) => {
    secondaryOrgWriter.upsert(assignment);
    set(state => {
      const filtered = state.secondaryOrgs.filter(
        a => !(a.userId === assignment.userId && a.orgId === assignment.orgId)
      );
      return { secondaryOrgs: [...filtered, assignment] };
    });
  },

  removeSecondaryOrg: (userId, orgId) => {
    secondaryOrgWriter.delete(userId, orgId);
    set(state => ({
      secondaryOrgs: state.secondaryOrgs.filter(
        a => !(a.userId === userId && a.orgId === orgId)
      ),
    }));
  },

  /* ── 시트 동기화 ─────────────────────────────────────────────────── */
  syncFromSheet: (newUsers, newOrgUnits, newSecondaryOrgs) =>
    set(() => ({
      users: newUsers,
      teams: deriveTeams(newUsers),
      ...(newOrgUnits !== undefined ? { orgUnits: newOrgUnits } : {}),
      ...(newSecondaryOrgs !== undefined ? { secondaryOrgs: newSecondaryOrgs } : {}),
    })),

  setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'team-data-v1',
      partialize: (s) => ({
        users:         s.users,
        teams:         s.teams,
        orgUnits:      s.orgUnits,
        secondaryOrgs: s.secondaryOrgs,
      }),
    },
  ),
);
