import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Goal } from '../types';
import { MOCK_GOALS } from '../data/mockData';

interface GoalState {
  goals: Goal[];
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  getGoalsForUser: (userId: string) => Goal[];
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: MOCK_GOALS,
      addGoal: (goal) => set(s => ({ goals: [...s.goals, goal] })),
      updateGoal: (id, updates) =>
        set(s => ({ goals: s.goals.map(g => g.id === id ? { ...g, ...updates } : g) })),
      getGoalsForUser: (userId) => get().goals.filter(g => g.userId === userId),
    }),
    { name: 'review-goals' }
  )
);
