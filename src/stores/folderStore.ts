import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeStorage } from '../utils/safeStorage';
import type { CycleFolder } from '../types';

interface FolderState {
  folders: CycleFolder[];
  addFolder: (folder: Omit<CycleFolder, 'id' | 'createdAt' | 'order'>) => CycleFolder;
  updateFolder: (id: string, patch: Partial<Omit<CycleFolder, 'id' | 'createdAt'>>) => void;
  deleteFolder: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
}

const FOLDER_COLORS = [
  '#f76e9c', '#863dff', '#35ade9', '#39c661',
  '#ed7a4f', '#b89f14', '#8a99a8',
];

function pickColor(existing: CycleFolder[]): string {
  const used = new Set(existing.map(f => f.color).filter(Boolean));
  return FOLDER_COLORS.find(c => !used.has(c)) ?? FOLDER_COLORS[existing.length % FOLDER_COLORS.length];
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set, get) => ({
      folders: [],
      addFolder: (input) => {
        const id = `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const now = new Date().toISOString();
        const folder: CycleFolder = {
          ...input,
          id,
          createdAt: now,
          order: get().folders.length,
          color: input.color ?? pickColor(get().folders),
        };
        set(s => ({ folders: [...s.folders, folder] }));
        return folder;
      },
      updateFolder: (id, patch) =>
        set(s => ({ folders: s.folders.map(f => f.id === id ? { ...f, ...patch } : f) })),
      deleteFolder: (id) =>
        set(s => ({ folders: s.folders.filter(f => f.id !== id) })),
      reorder: (orderedIds) =>
        set(s => ({
          folders: s.folders
            .map(f => ({ ...f, order: orderedIds.indexOf(f.id) }))
            .filter(f => f.order >= 0)
            .sort((a, b) => a.order - b.order),
        })),
    }),
    {
      name: 'review-cycle-folders-v1',
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);
