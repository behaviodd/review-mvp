import { create } from 'zustand';
import type { User, UserRole } from '../types';
import { MOCK_USERS } from '../data/mockData';

export interface Team {
  id: string;
  name: string;
}

function deriveTeams(users: User[]): Team[] {
  const depts = Array.from(new Set(users.map(u => u.department)));
  return depts.map(d => ({ id: d, name: d }));
}

interface TeamStore {
  users: User[];
  teams: Team[];

  createTeam: (name: string) => void;
  deleteTeam: (teamId: string) => void;
  addMember: (userId: string, teamId: string, managerId?: string) => void;
  removeMember: (userId: string) => void;
  createMember: (member: Omit<User, 'id'>) => void;
}

export const useTeamStore = create<TeamStore>((set) => ({
  users: [...MOCK_USERS],
  teams: deriveTeams(MOCK_USERS),

  createTeam: (name) =>
    set(state => {
      if (state.teams.find(t => t.name === name)) return state;
      return { teams: [...state.teams, { id: name, name }] };
    }),

  deleteTeam: (teamId) =>
    set(state => ({
      teams: state.teams.filter(t => t.id !== teamId),
      // members in deleted team become unassigned
      users: state.users.map(u =>
        u.department === teamId ? { ...u, department: '미배정', managerId: undefined } : u
      ),
    })),

  addMember: (userId, teamId, managerId) =>
    set(state => ({
      users: state.users.map(u =>
        u.id === userId ? { ...u, department: teamId, managerId } : u
      ),
    })),

  removeMember: (userId) =>
    set(state => ({
      users: state.users.map(u =>
        u.id === userId ? { ...u, department: '미배정', managerId: undefined } : u
      ),
    })),

  createMember: (member) =>
    set(state => {
      const id = `u${String(Date.now()).slice(-6)}`;
      return { users: [...state.users, { id, ...member }] };
    }),
}));
