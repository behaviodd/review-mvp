import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { User } from '../types';

interface AuthState {
  currentUser: User | null;
  mustChangePassword: boolean;
  login: (user: User, mustChangePassword?: boolean) => void;
  logout: () => void;
  clearMustChangePassword: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      mustChangePassword: false,
      login: (user, mustChangePassword = false) =>
        set({ currentUser: user, mustChangePassword }),
      logout: () => set({ currentUser: null, mustChangePassword: false }),
      clearMustChangePassword: () => set({ mustChangePassword: false }),
    }),
    {
      name: 'review-auth',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
