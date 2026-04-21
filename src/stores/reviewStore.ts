import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReviewCycle, ReviewTemplate, ReviewSubmission, Answer } from '../types';
import { cycleWriter, templateWriter, submissionWriter } from '../utils/reviewSheetWriter';
import { useSheetsSyncStore } from './sheetsSyncStore';
import { DEFAULT_TEMPLATE } from '../data/defaultTemplate';

type PersistedState = {
  cycles: ReviewCycle[];
  templates: ReviewTemplate[];
  submissions: ReviewSubmission[];
};

interface ReviewState {
  cycles: ReviewCycle[];
  templates: ReviewTemplate[];
  submissions: ReviewSubmission[];
  isLoading: boolean;
  reviewSyncError: string | null;

  // CRUD
  addCycle: (cycle: ReviewCycle) => void;
  updateCycle: (id: string, updates: Partial<ReviewCycle>) => void;
  deleteCycle: (id: string) => void;
  addTemplate: (template: ReviewTemplate) => void;
  updateTemplate: (id: string, updates: Partial<ReviewTemplate>) => void;
  deleteTemplate: (id: string) => void;
  upsertSubmission: (submission: ReviewSubmission) => void;
  saveAnswer: (submissionId: string, answer: Answer) => void;
  submitSubmission: (submissionId: string, overallRating?: number) => void;
  getSubmission: (cycleId: string, reviewerId: string, revieweeId: string, type: 'self' | 'downward') => ReviewSubmission | undefined;

  // 시트 동기화
  syncFromSheet: (data: { cycles?: ReviewCycle[]; templates?: ReviewTemplate[]; submissions?: ReviewSubmission[] }) => void;
  setLoading: (v: boolean) => void;
}

function isReviewSyncEnabled() {
  return useSheetsSyncStore.getState().reviewSyncEnabled;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      cycles:     [],
      templates:  [DEFAULT_TEMPLATE],
      submissions: [],
      isLoading:  false,
      reviewSyncError: null,

      /* ── 사이클 ───────────────────────────────────────────────── */
      addCycle: (cycle) => {
        set(s => ({ cycles: [...s.cycles, cycle] }));
        if (isReviewSyncEnabled()) cycleWriter.upsert(cycle);
      },

      updateCycle: (id, updates) => {
        set(s => ({ cycles: s.cycles.map(c => c.id === id ? { ...c, ...updates } : c) }));
        if (isReviewSyncEnabled()) {
          const updated = get().cycles.find(c => c.id === id);
          if (updated) cycleWriter.upsert(updated);
        }
      },

      deleteCycle: (id) => {
        if (isReviewSyncEnabled()) {
          // DB에서 관련 제출 먼저 삭제 후 사이클 삭제
          get().submissions
            .filter(sub => sub.cycleId === id)
            .forEach(sub => submissionWriter.delete(sub.id));
          cycleWriter.delete(id);
        }
        set(s => ({
          cycles: s.cycles.filter(c => c.id !== id),
          submissions: s.submissions.filter(sub => sub.cycleId !== id),
        }));
      },

      /* ── 템플릿 ───────────────────────────────────────────────── */
      addTemplate: (template) => {
        set(s => ({ templates: [...s.templates, template] }));
        if (isReviewSyncEnabled()) templateWriter.upsert(template);
      },

      updateTemplate: (id, updates) => {
        set(s => ({ templates: s.templates.map(t => t.id === id ? { ...t, ...updates } : t) }));
        if (isReviewSyncEnabled()) {
          const updated = get().templates.find(t => t.id === id);
          if (updated) templateWriter.upsert(updated);
        }
      },

      deleteTemplate: (id) => {
        set(s => ({ templates: s.templates.filter(t => t.id !== id) }));
        if (isReviewSyncEnabled()) templateWriter.delete(id);
      },

      /* ── 제출 ─────────────────────────────────────────────────── */
      upsertSubmission: (submission) => {
        set(s => {
          const exists = s.submissions.find(sub => sub.id === submission.id);
          if (exists) return { submissions: s.submissions.map(sub => sub.id === submission.id ? submission : sub) };
          return { submissions: [...s.submissions, submission] };
        });
        if (isReviewSyncEnabled()) submissionWriter.upsert(submission);
      },

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
        if (isReviewSyncEnabled()) {
          const sub = get().submissions.find(s => s.id === submissionId);
          if (sub) submissionWriter.upsert(sub);
        }
      },

      getSubmission: (cycleId, reviewerId, revieweeId, type) =>
        get().submissions.find(
          s => s.cycleId === cycleId && s.reviewerId === reviewerId &&
               s.revieweeId === revieweeId && s.type === type
        ),

      /* ── 시트 동기화 ──────────────────────────────────────────── */
      syncFromSheet: ({ cycles, templates, submissions }) =>
        set(s => ({
          cycles:      cycles      ?? s.cycles,
          templates:   templates   ?? s.templates,
          submissions: submissions ?? s.submissions,
        })),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'review-data-v3',
      partialize: (state): PersistedState => ({
        cycles:      state.cycles,
        templates:   state.templates,
        submissions: state.submissions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.templates.length === 0) {
          state.templates = [DEFAULT_TEMPLATE];
        }
      },
    }
  )
);
