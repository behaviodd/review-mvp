import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type {
  User, OrgUnit, OrgUnitType, SecondaryOrgAssignment,
  ReviewerAssignment, OrgSnapshot, PermissionGroup, PermissionCode,
} from '../types';
import { sheetWriter, generateEmployeeId } from '../utils/sheetWriter';
import { orgUnitWriter, secondaryOrgWriter, reviewerAssignmentWriter } from '../utils/sheetWriter';
import { migrateToR1, isMigrationApplied, type SchemaVersion } from '../utils/migrations/r1_org_redesign';

const ALL_PERMISSIONS: PermissionCode[] = [
  'cycles.manage',
  'templates.manage',
  'org.manage',
  'reviewer_assignments.manage',
  'permission_groups.manage',
  'auth.impersonate',
  'audit.view',
  'reports.view_all',
  'settings.manage',
];

export function buildSystemPermissionGroups(users: User[], createdAt = new Date().toISOString()): PermissionGroup[] {
  return [
    {
      id: 'pg_owner',
      name: '소유자',
      description: '시스템 전체 권한. admin role 사용자는 자동 가입되며 수동 추가/삭제 불가.',
      permissions: ALL_PERMISSIONS,
      memberIds: users.filter(u => u.role === 'admin').map(u => u.id),
      isSystem: true,
      createdAt,
      createdBy: 'system',
    },
    {
      id: 'pg_review_admin',
      name: '리뷰 관리자',
      description: '사이클/템플릿 관리 + 전사 리포트.',
      permissions: ['cycles.manage', 'templates.manage', 'reports.view_all'],
      memberIds: [],
      isSystem: true,
      createdAt,
      createdBy: 'system',
    },
    {
      id: 'pg_org_admin',
      name: '구성원 관리자',
      description: '조직/구성원/평가권자 관리.',
      permissions: ['org.manage', 'reviewer_assignments.manage'],
      memberIds: [],
      isSystem: true,
      createdAt,
      createdBy: 'system',
    },
    {
      id: 'pg_master_login',
      name: '마스터 로그인',
      description: '다른 사용자 화면 조회 + 감사 로그 열람. 신뢰할 수 있는 직원에게만 부여.',
      permissions: ['auth.impersonate', 'audit.view'],
      memberIds: [],
      isSystem: true,
      createdAt,
      createdBy: 'system',
    },
  ];
}

export function ensureSystemPermissionGroups(groups: PermissionGroup[], users: User[]): PermissionGroup[] {
  const seeds = buildSystemPermissionGroups(users);
  const byId = new Map(groups.map(g => [g.id, g]));

  for (const seed of seeds) {
    const existing = byId.get(seed.id);
    if (!existing) {
      byId.set(seed.id, seed);
      continue;
    }

    if (seed.id === 'pg_owner') {
      const mergedMembers = Array.from(new Set([...existing.memberIds, ...seed.memberIds]));
      byId.set(seed.id, {
        ...existing,
        name: seed.name,
        description: seed.description,
        permissions: seed.permissions,
        memberIds: mergedMembers,
        isSystem: true,
      });
      continue;
    }

    byId.set(seed.id, {
      ...existing,
      name: seed.name,
      description: seed.description,
      permissions: seed.permissions,
      isSystem: true,
    });
  }

  return Array.from(byId.values());
}

export interface Team {
  id: string;
  name: string;
}

function deriveTeams(users: User[]): Team[] {
  const depts = Array.from(new Set(users.map(u => u.department)));
  return depts.map(d => ({ id: d, name: d }));
}

/** _구성원의 주조직 값 중 _조직구조에 없는 것을 가상 OrgUnit 으로 파생.
 *  isDerived=true 마킹 — 시트에 저장 안 되고 편집/삭제 불가. */
function deriveOrgUnitsFromMembers(users: User[], existingOrgUnits: OrgUnit[]): OrgUnit[] {
  const existingNames = new Set(existingOrgUnits.map(u => u.name));
  const seen = new Set<string>();
  const derived: OrgUnit[] = [];
  let order = 900;
  for (const user of users) {
    const dept = user.department?.trim();
    if (dept && !existingNames.has(dept) && !seen.has(dept)) {
      seen.add(dept);
      derived.push({ id: `__auto__${dept}`, name: dept, type: 'mainOrg', order: order++, isDerived: true });
    }
  }
  return derived;
}

/** _구성원 역할='조직장' 사용자를 소속 OrgUnit 의 headId 로 반영.
 *  _조직구조 시트에 이미 headId 가 명시된 경우는 건드리지 않음(명시값 우선). */
function deriveHeadsFromMembers(users: User[], orgUnits: OrgUnit[]): OrgUnit[] {
  const orgById   = new Map(orgUnits.map(u => [u.id, u]));
  const orgByName = new Map(orgUnits.map(u => [u.name, u]));
  const updates   = new Map<string, string>(); // orgUnit.id → headId

  for (const user of users) {
    if (user.role !== 'leader') continue;
    // 같은 org 에 leader 가 여럿일 때 첫 번째만 사용 (이미 update 됐으면 skip)
    const orgUnit =
      (user.orgUnitId ? orgById.get(user.orgUnitId) : undefined) ??
      (user.department ? orgByName.get(user.department.trim()) : undefined);
    if (orgUnit && !orgUnit.headId && !updates.has(orgUnit.id)) {
      updates.set(orgUnit.id, user.id);
    }
  }

  if (updates.size === 0) return orgUnits;
  return orgUnits.map(u => {
    const headId = updates.get(u.id);
    return headId ? { ...u, headId } : u;
  });
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
  // R1: 평가권 + 인사 스냅샷
  reviewerAssignments: ReviewerAssignment[];
  orgSnapshots: OrgSnapshot[];
  // R6: 권한 그룹
  permissionGroups: PermissionGroup[];
  schemaVersion: SchemaVersion;
  isLoading: boolean;

  // 구성원 CRUD
  createTeam: (name: string) => void;
  renameTeam: (teamId: string, newName: string) => void;
  deleteTeam: (teamId: string) => void;
  addMember: (userId: string, teamId: string, managerId?: string) => void;
  removeMember: (userId: string) => void;
  createMember: (member: Omit<User, 'id'>) => Promise<string>;
  updateMember: (userId: string, patch: Partial<Omit<User, 'id'>>) => void;
  terminateMember: (userId: string, leaveDate: string) => void;

  // 조직 단위 CRUD
  addOrgUnit: (unit: Omit<OrgUnit, 'id'>) => void;
  updateOrgUnit: (id: string, patch: Partial<Omit<OrgUnit, 'id'>>) => void;
  /** 여러 OrgUnit 의 patch 를 1회 setState + 1회 batch HTTP 로 적용. DnD 순서 변경/이동에 사용. */
  bulkUpdateOrgUnits: (patches: { id: string; patch: Partial<Omit<OrgUnit, 'id'>> }[]) => void;
  /** 여러 User 의 patch 를 1회 setState + 1회 batch HTTP 로 적용. DnD 후 소속 정합성 갱신에 사용. */
  bulkUpdateMembers: (patches: { id: string; patch: Partial<Omit<User, 'id'>> }[]) => void;
  deleteOrgUnit: (id: string) => void;
  reorderOrgUnit: (id: string, direction: 'up' | 'down') => void;

  // 겸임 CRUD
  upsertSecondaryOrg: (assignment: SecondaryOrgAssignment) => void;
  removeSecondaryOrg: (userId: string, orgId: string) => void;

  // R1: 평가권 CRUD
  upsertAssignment: (
    input: Omit<ReviewerAssignment, 'id' | 'createdAt'>,
  ) => ReviewerAssignment;
  endAssignment: (assignmentId: string, endDate?: string) => void;
  /** 자동 지정 일괄 적용 — 각 입력에 대해 기존 동일 rank 활성 배정을 종료 후 신규 생성 */
  bulkUpsertAssignments: (
    inputs: Omit<ReviewerAssignment, 'id' | 'createdAt'>[],
  ) => ReviewerAssignment[];

  // R1: 인사 스냅샷
  createSnapshot: (description: string, actorId: string) => OrgSnapshot;
  getSnapshot: (snapshotId: string) => OrgSnapshot | undefined;

  // R1: 마이그레이션 강제 실행 (디버그/관리자용)
  runMigrationR1: () => void;

  // R6: 권한 그룹 CRUD
  createPermissionGroup: (
    input: Omit<PermissionGroup, 'id' | 'createdAt' | 'isSystem'>,
  ) => PermissionGroup;
  updatePermissionGroup: (
    id: string,
    patch: Partial<Pick<PermissionGroup, 'name' | 'description' | 'permissions' | 'memberIds'>>,
  ) => void;
  deletePermissionGroup: (id: string) => boolean;  // 시스템 그룹 false
  addMemberToGroup: (groupId: string, userId: string) => void;
  removeMemberFromGroup: (groupId: string, userId: string) => void;
  /** 사용자 id 가 보유한 모든 권한 코드 (그룹 합집합). admin role 은 자동으로 모든 권한. */
  getUserPermissions: (userId: string) => PermissionCode[];

  // R6: 시드/마이그레이션
  seedSystemGroups: () => void;

  // 시트 연동
  syncFromSheet: (
    users: User[],
    orgUnits?: OrgUnit[],
    secondaryOrgs?: SecondaryOrgAssignment[],
    reviewerAssignments?: ReviewerAssignment[],
    orgSnapshots?: OrgSnapshot[],
    permissionGroups?: PermissionGroup[],
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
  reviewerAssignments: [],
  orgSnapshots: [],
  permissionGroups: [],
  schemaVersion: 'pre-r1' as SchemaVersion,
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
    const assignedId = await sheetWriter.create(member);
    const id = assignedId ?? generateEmployeeId(get().users);
    const newUser: User = { id, ...member };
    if (!assignedId) sheetWriter.createWithId(newUser);
    set(s => ({ users: [...s.users, newUser] }));
    return id;
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
      // R1: type 은 deprecated 이지만 마이그레이션 전 코드 호환을 위해 fallback 'team'.
      const id = generateOrgUnitId(unit.type ?? 'team', unit.name);
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

      // 새 조직장이 지정되면 해당 구성원 역할을 '조직장'으로 자동 기입
      let users = state.users;
      if (patch.headId && patch.headId !== existing.headId) {
        const headUser = state.users.find(u => u.id === patch.headId);
        if (headUser) {
          const updatedUser = { ...headUser, position: '조직장' };
          sheetWriter.update(updatedUser);
          users = state.users.map(u => u.id === patch.headId ? updatedUser : u);
        }
      }

      return { orgUnits: state.orgUnits.map(u => u.id === id ? updated : u), users };
    }),

  bulkUpdateOrgUnits: (patches) => {
    if (patches.length === 0) return;
    set(state => {
      const byId = new Map(patches.map(p => [p.id, p.patch] as const));
      const nextUnits = state.orgUnits.map(u => {
        const patch = byId.get(u.id);
        return patch ? { ...u, ...patch } : u;
      });
      const changedUnits = nextUnits.filter(u => byId.has(u.id));
      // 1 HTTP 로 일괄 시트 반영 (Apps Script 미배포면 자동 fallback).
      void orgUnitWriter.batchUpsert(changedUnits);
      return { orgUnits: nextUnits };
    });
  },

  bulkUpdateMembers: (patches) => {
    if (patches.length === 0) return;
    set(state => {
      const byId = new Map(patches.map(p => [p.id, p.patch] as const));
      const nextUsers = state.users.map(u => {
        const patch = byId.get(u.id);
        return patch ? { ...u, ...patch } : u;
      });
      const changedUsers = nextUsers.filter(u => byId.has(u.id));
      // 1 HTTP 로 일괄 시트 반영.
      void sheetWriter.batchUpsert(changedUsers);
      return { users: nextUsers };
    });
  },

  deleteOrgUnit: (id) => {
    if (id.startsWith('__auto__')) return; // 자동 파생 조직은 삭제 불가
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

  /* ── R1: 평가권 ───────────────────────────────────────────────── */
  upsertAssignment: (input) => {
    const id = `ra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const newAssignment: ReviewerAssignment = { id, createdAt, ...input };
    // 종료 대상 파악 (set 이전 current state 에서 읽음)
    const toClose = get().reviewerAssignments.filter(
      a => a.revieweeId === input.revieweeId && a.rank === input.rank && !a.endDate,
    );
    set(state => {
      const closed = state.reviewerAssignments.map(a =>
        toClose.some(c => c.id === a.id) ? { ...a, endDate: createdAt } : a
      );
      return { reviewerAssignments: [...closed, newAssignment] };
    });
    // 시트 동기화 — 기존 배정 종료 + 신규 배정 저장
    toClose.forEach(a => void reviewerAssignmentWriter.end(a.id, createdAt));
    void reviewerAssignmentWriter.upsert(newAssignment);
    return newAssignment;
  },

  endAssignment: (assignmentId, endDate) => {
    const at = endDate ?? new Date().toISOString();
    set(state => ({
      reviewerAssignments: state.reviewerAssignments.map(a =>
        a.id === assignmentId ? { ...a, endDate: at } : a
      ),
    }));
    // 시트 동기화
    void reviewerAssignmentWriter.end(assignmentId, at);
  },

  bulkUpsertAssignments: (inputs) => {
    const createdAt = new Date().toISOString();
    const created: ReviewerAssignment[] = inputs.map(input => ({
      id: `ra_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      ...input,
    }));
    // 종료 대상 파악 (set 이전 current state 에서 읽음)
    const current = get().reviewerAssignments;
    const toClose = created.flatMap(a =>
      current.filter(
        existing => existing.revieweeId === a.revieweeId && existing.rank === a.rank && !existing.endDate,
      )
    );
    set(state => {
      let assignments = [...state.reviewerAssignments];
      for (const a of created) {
        // 동일 revieweeId + rank 활성 배정 종료
        assignments = assignments.map(existing =>
          toClose.some(c => c.id === existing.id) && existing.revieweeId === a.revieweeId
            ? { ...existing, endDate: createdAt }
            : existing
        );
        assignments.push(a);
      }
      return { reviewerAssignments: assignments };
    });
    // 시트 동기화 — 종료 + 신규 일괄 저장
    toClose.forEach(a => void reviewerAssignmentWriter.end(a.id, createdAt));
    created.forEach(a => void reviewerAssignmentWriter.upsert(a));
    return created;
  },

  /* ── R1: 인사 스냅샷 ───────────────────────────────────────────── */
  createSnapshot: (description, actorId) => {
    const id = `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const state = get();
    const snapshot: OrgSnapshot = {
      id,
      createdAt: new Date().toISOString(),
      createdBy: actorId,
      description,
      // 깊은 복제 (JSON serialize/parse)
      users: JSON.parse(JSON.stringify(state.users)),
      orgUnits: JSON.parse(JSON.stringify(state.orgUnits)),
      assignments: JSON.parse(JSON.stringify(state.reviewerAssignments)),
    };
    set(s => ({ orgSnapshots: [...s.orgSnapshots, snapshot] }));
    return snapshot;
  },

  getSnapshot: (snapshotId) =>
    get().orgSnapshots.find(s => s.id === snapshotId),

  /* ── R6: 권한 그룹 ─────────────────────────────────────────────── */
  createPermissionGroup: (input) => {
    const id = `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const group: PermissionGroup = {
      id,
      createdAt: new Date().toISOString(),
      isSystem: false,
      ...input,
    };
    set(s => ({ permissionGroups: [...s.permissionGroups, group] }));
    return group;
  },

  updatePermissionGroup: (id, patch) =>
    set(state => ({
      permissionGroups: state.permissionGroups.map(g => {
        if (g.id !== id) return g;
        // 시스템 그룹은 멤버만 변경 허용 (이름/설명/권한 잠금)
        if (g.isSystem) {
          return { ...g, memberIds: patch.memberIds ?? g.memberIds };
        }
        return { ...g, ...patch };
      }),
    })),

  deletePermissionGroup: (id) => {
    const target = get().permissionGroups.find(g => g.id === id);
    if (!target || target.isSystem) return false;
    set(state => ({ permissionGroups: state.permissionGroups.filter(g => g.id !== id) }));
    return true;
  },

  addMemberToGroup: (groupId, userId) =>
    set(state => ({
      permissionGroups: state.permissionGroups.map(g =>
        g.id === groupId && !g.memberIds.includes(userId)
          ? { ...g, memberIds: [...g.memberIds, userId] }
          : g
      ),
    })),

  removeMemberFromGroup: (groupId, userId) =>
    set(state => ({
      permissionGroups: state.permissionGroups.map(g =>
        g.id === groupId
          ? { ...g, memberIds: g.memberIds.filter(id => id !== userId) }
          : g
      ),
    })),

  getUserPermissions: (userId) => {
    const state = get();
    const user = state.users.find(u => u.id === userId);
    // admin role 은 자동으로 모든 권한 (소유자)
    if (user?.role === 'admin') {
      return ALL_PERMISSIONS;
    }
    // 그룹 합집합
    const set2 = new Set<PermissionCode>();
    for (const g of state.permissionGroups) {
      if (g.memberIds.includes(userId)) {
        g.permissions.forEach(p => set2.add(p));
      }
    }
    return Array.from(set2);
  },

  seedSystemGroups: () => {
    set(s => {
      return { permissionGroups: ensureSystemPermissionGroups(s.permissionGroups, s.users) };
    });
  },

  /* ── R1: 마이그레이션 ─────────────────────────────────────────── */
  runMigrationR1: () => {
    const state = get();
    if (isMigrationApplied(state.schemaVersion)) return;
    const result = migrateToR1({
      users: state.users,
      orgUnits: state.orgUnits,
      existingAssignments: state.reviewerAssignments,
    });
    set({
      users: result.users,
      reviewerAssignments: [...state.reviewerAssignments, ...result.newAssignments],
      schemaVersion: result.schemaVersion,
    });
    if (result.report.warnings.length > 0) {
      console.warn('[R1 migration]', result.report);
    } else {
      console.info('[R1 migration]', result.report);
    }
  },

  /* ── 시트 동기화 ─────────────────────────────────────────────────── */
  syncFromSheet: (newUsers, newOrgUnits, newSecondaryOrgs, newReviewerAssignments, newOrgSnapshots, newPermissionGroups) => {
    // _조직구조에 없는 주조직 값은 가상 OrgUnit 으로 파생 — 편집/삭제 불가(isDerived=true)
    // 이후 _구성원 역할='조직장' 사용자를 소속 OrgUnit.headId 로 반영
    const augmentedOrgUnits = newOrgUnits !== undefined
      ? deriveHeadsFromMembers(
          newUsers,
          [...newOrgUnits, ...deriveOrgUnitsFromMembers(newUsers, newOrgUnits)],
        )
      : undefined;
    return set(() => ({
      users: newUsers,
      teams: deriveTeams(newUsers),
      ...(augmentedOrgUnits !== undefined ? { orgUnits: augmentedOrgUnits } : {}),
      ...(newSecondaryOrgs !== undefined ? { secondaryOrgs: newSecondaryOrgs } : {}),
      ...(newReviewerAssignments !== undefined ? { reviewerAssignments: newReviewerAssignments } : {}),
      ...(newOrgSnapshots !== undefined ? { orgSnapshots: newOrgSnapshots } : {}),
      ...(newPermissionGroups !== undefined
        ? { permissionGroups: ensureSystemPermissionGroups(newPermissionGroups, newUsers) }
        : {}),
    }));
  },

  setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      // R7 Phase 5: v1 → v2 — Phase 4 의 buggy fingerprint 로 인해 일부 클라이언트
      // localStorage 가 stale 상태일 수 있어 강제 fresh fetch 유도.
      name: 'team-data-v2',
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        users:               s.users,
        teams:               s.teams,
        orgUnits:            s.orgUnits,
        secondaryOrgs:       s.secondaryOrgs,
        reviewerAssignments: s.reviewerAssignments,
        orgSnapshots:        s.orgSnapshots,
        permissionGroups:    s.permissionGroups,
        schemaVersion:       s.schemaVersion,
      }),
      // R1/R6: 부팅 시 마이그레이션 + 시스템 그룹 시드
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        setTimeout(() => {
          try {
            // R1
            if (!isMigrationApplied(state.schemaVersion)) {
              useTeamStore.getState().runMigrationR1();
            }
            // R6: 시스템 그룹 시드 — 누락된 시스템 그룹만 추가, 소유자 멤버십 동기화
            useTeamStore.getState().seedSystemGroups();
          } catch (e) {
            console.error('[R1/R6 boot] rehydrate failed:', e);
          }
        }, 0);
      },
    },
  ),
);
