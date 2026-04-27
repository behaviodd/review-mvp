import { describe, expect, it } from 'vitest';
import { ensureSystemPermissionGroups } from './teamStore';
import type { PermissionGroup, User } from '../types';

const now = '2026-04-27T00:00:00.000Z';

function user(id: string, role: User['role'] = 'member'): User {
  return {
    id,
    role,
    name: id,
    email: `${id}@example.com`,
    position: '구성원',
    avatarColor: 'bg-gray-040',
    department: '미배정',
  };
}

function customGroup(): PermissionGroup {
  return {
    id: 'pg_custom',
    name: '커스텀',
    permissions: ['templates.manage'],
    memberIds: ['member'],
    isSystem: false,
    createdAt: now,
    createdBy: 'admin',
  };
}

describe('ensureSystemPermissionGroups', () => {
  it('restores all system groups when sheet data is empty', () => {
    const groups = ensureSystemPermissionGroups([], [user('admin', 'admin')]);
    const ids = groups.map(g => g.id);

    expect(ids).toContain('pg_owner');
    expect(ids).toContain('pg_review_admin');
    expect(ids).toContain('pg_org_admin');
    expect(ids).toContain('pg_master_login');
    expect(groups.find(g => g.id === 'pg_owner')?.memberIds).toContain('admin');
  });

  it('preserves custom groups while repairing system group metadata', () => {
    const staleOwner: PermissionGroup = {
      id: 'pg_owner',
      name: '옛 소유자',
      permissions: ['cycles.manage'],
      memberIds: ['legacy-admin'],
      isSystem: false,
      createdAt: now,
      createdBy: 'legacy',
    };

    const groups = ensureSystemPermissionGroups([staleOwner, customGroup()], [user('admin', 'admin')]);
    const owner = groups.find(g => g.id === 'pg_owner');
    const custom = groups.find(g => g.id === 'pg_custom');

    expect(owner?.isSystem).toBe(true);
    expect(owner?.permissions).toContain('permission_groups.manage');
    expect(owner?.memberIds).toEqual(expect.arrayContaining(['legacy-admin', 'admin']));
    expect(custom).toBeTruthy();
  });
});
