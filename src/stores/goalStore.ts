import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { Goal } from '../types';

interface GoalState {
  goals: Goal[];
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  getGoalsForUser: (userId: string) => Goal[];
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: [],
      addGoal: (goal) => set(s => ({ goals: [...s.goals, goal] })),
      updateGoal: (id, updates) =>
        set(s => ({ goals: s.goals.map(g => g.id === id ? { ...g, ...updates } : g) })),
      getGoalsForUser: (userId) => get().goals.filter(g => g.userId === userId),
    }),
    {
      name: 'review-goals-v2',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
