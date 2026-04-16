import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReviewCycle, ReviewTemplate, ReviewSubmission, Answer } from '../types';
import { MOCK_CYCLES, MOCK_TEMPLATES, MOCK_SUBMISSIONS, MOCK_USERS } from '../data/mockData';
import { syncSubmission } from '../utils/sheetsSync';
import { useSheetsSyncStore } from './sheetsSyncStore';

type PersistedState = {
  cycles: ReviewCycle[];
  templates: ReviewTemplate[];
  submissions: ReviewSubmission[];
};

interface ReviewState {
  cycles: ReviewCycle[];
  templates: ReviewTemplate[];
  submissions: ReviewSubmission[];
  addCycle: (cycle: ReviewCycle) => void;
  updateCycle: (id: string, updates: Partial<ReviewCycle>) => void;
  addTemplate: (template: ReviewTemplate) => void;
  updateTemplate: (id: string, updates: Partial<ReviewTemplate>) => void;
  deleteTemplate: (id: string) => void;
  upsertSubmission: (submission: ReviewSubmission) => void;
  saveAnswer: (submissionId: string, answer: Answer) => void;
  submitSubmission: (submissionId: string, overallRating?: number) => void;
  getSubmission: (cycleId: string, reviewerId: string, revieweeId: string, type: 'self' | 'downward') => ReviewSubmission | undefined;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      cycles: MOCK_CYCLES,
      templates: MOCK_TEMPLATES,
      submissions: MOCK_SUBMISSIONS,

      addCycle: (cycle) => set(s => ({ cycles: [...s.cycles, cycle] })),

      updateCycle: (id, updates) =>
        set(s => ({ cycles: s.cycles.map(c => c.id === id ? { ...c, ...updates } : c) })),

      addTemplate: (template) => set(s => ({ templates: [...s.templates, template] })),

      updateTemplate: (id, updates) =>
        set(s => ({ templates: s.templates.map(t => t.id === id ? { ...t, ...updates } : t) })),

      deleteTemplate: (id) =>
        set(s => ({ templates: s.templates.filter(t => t.id !== id) })),

      upsertSubmission: (submission) =>
        set(s => {
          const exists = s.submissions.find(sub => sub.id === submission.id);
          if (exists) return { submissions: s.submissions.map(sub => sub.id === submission.id ? submission : sub) };
          return { submissions: [...s.submissions, submission] };
        }),

      saveAnswer: (submissionId, answer) =>
        set(s => ({
          submissions: s.submissions.map(sub => {
            if (sub.id !== submissionId) return sub;
            const existing = sub.answers.findIndex(a => a.questionId === answer.questionId);
            const newAnswers = existing >= 0
              ? sub.answers.map((a, i) => i === existing ? answer : a)
              : [...sub.answers, answer];
            return { ...sub, answers: newAnswers, status: 'in_progress', lastSavedAt: new Date().toISOString() };
          }),
        })),

      submitSubmission: (submissionId, overallRating) => {
        const submittedAt = new Date().toISOString();
        set(s => ({
          submissions: s.submissions.map(sub =>
            sub.id === submissionId
              ? { ...sub, status: 'submitted', submittedAt, overallRating }
              : sub
          ),
        }));

        // Google Sheets 자동 동기화 (fire-and-forget)
        const { scriptUrl, enabled } = useSheetsSyncStore.getState();
        if (enabled && scriptUrl) {
          const { submissions, cycles } = get();
          const sub = submissions.find(s => s.id === submissionId);
          if (sub) {
            const updated = { ...sub, status: 'submitted' as const, submittedAt, overallRating };
            const cycle   = cycles.find(c => c.id === sub.cycleId);
            const template: ReviewTemplate | undefined = MOCK_TEMPLATES.find(t => t.id === cycle?.templateId);
            if (cycle && template) {
              syncSubmission(updated, cycle, template, MOCK_USERS, scriptUrl).catch(
                err => console.warn('[SheetsSync] 동기화 실패:', err),
              );
            }
          }
        }
      },

      getSubmission: (cycleId, reviewerId, revieweeId, type) => {
        return get().submissions.find(
          s => s.cycleId === cycleId && s.reviewerId === reviewerId && s.revieweeId === revieweeId && s.type === type
        );
      },
    }),
    {
      name: 'review-data-v2',
      partialize: (state): PersistedState => ({
        cycles: state.cycles,
        templates: state.templates,
        submissions: state.submissions,
      }),
      merge: (persistedState, currentState) => {
        const ps = (persistedState ?? {}) as Partial<PersistedState>;
        if (!ps.submissions) {
          // No persisted state — use fresh mock data as-is
          return { ...currentState };
        }
        // Merge: keep persisted submissions, add any new mock submissions not yet in localStorage
        const persistedSubIds = new Set(ps.submissions.map(s => s.id));
        const missingSubmissions = MOCK_SUBMISSIONS.filter(s => !persistedSubIds.has(s.id));
        return {
          ...currentState,
          cycles: ps.cycles ?? currentState.cycles,
          templates: ps.templates ?? currentState.templates,
          submissions: [...ps.submissions, ...missingSubmissions],
        };
      },
    }
  )
);
