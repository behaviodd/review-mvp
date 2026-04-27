import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { ProfileFieldConfig, ProfileFieldKey, ProfileFieldViewer } from '../types';

export const PROFILE_FIELD_LOCKED: ProfileFieldKey[] = ['name', 'email'];

export const PROFILE_FIELD_LABEL: Record<ProfileFieldKey, string> = {
  name:        '이름',
  nameEn:      '영문이름',
  email:       '이메일',
  phone:       '연락처',
  joinDate:    '입사일',
  jobFunction: '직무',
};

export const PROFILE_VIEWER_LABEL: Record<ProfileFieldViewer, string> = {
  self:       '본인',
  orgLeader:  '조직 리더',
  reviewer:   '평가권자',
  allMembers: '모든 구성원',
};

export const PROFILE_VIEWER_ORDER: ProfileFieldViewer[] = ['self', 'orgLeader', 'reviewer', 'allMembers'];

const DEFAULT_FIELDS: ProfileFieldConfig[] = [
  { key: 'name',        order: 0, viewers: ['self', 'orgLeader', 'reviewer', 'allMembers'] },
  { key: 'nameEn',      order: 1, viewers: ['self', 'orgLeader', 'reviewer', 'allMembers'] },
  { key: 'email',       order: 2, viewers: ['self', 'orgLeader', 'reviewer', 'allMembers'] },
  { key: 'phone',       order: 3, viewers: ['self', 'orgLeader'] },
  { key: 'joinDate',    order: 4, viewers: ['self', 'orgLeader', 'reviewer'] },
  { key: 'jobFunction', order: 5, viewers: ['self', 'orgLeader', 'reviewer', 'allMembers'] },
];

interface ProfileFieldState {
  fields: ProfileFieldConfig[];
  toggleViewer: (key: ProfileFieldKey, viewer: ProfileFieldViewer) => void;
  move: (key: ProfileFieldKey, direction: 'up' | 'down') => void;
  reset: () => void;
}

export const useProfileFieldStore = create<ProfileFieldState>()(
  persist(
    (set) => ({
      fields: DEFAULT_FIELDS,
      toggleViewer: (key, viewer) => set(s => ({
        fields: s.fields.map(f => {
          if (f.key !== key) return f;
          if (PROFILE_FIELD_LOCKED.includes(key)) return f;
          const has = f.viewers.includes(viewer);
          return { ...f, viewers: has ? f.viewers.filter(v => v !== viewer) : [...f.viewers, viewer] };
        }),
      })),
      move: (key, direction) => set(s => {
        const sorted = [...s.fields].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(f => f.key === key);
        if (idx === -1) return s;
        const swapWith = direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= sorted.length) return s;
        const a = sorted[idx];
        const b = sorted[swapWith];
        return {
          fields: s.fields.map(f => {
            if (f.key === a.key) return { ...f, order: b.order };
            if (f.key === b.key) return { ...f, order: a.order };
            return f;
          }),
        };
      }),
      reset: () => set({ fields: DEFAULT_FIELDS }),
    }),
    {
      name: 'review-profile-fields-v1',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
