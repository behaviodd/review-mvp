import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Feedback } from '../types';
import { MOCK_FEEDBACK } from '../data/mockData';

interface FeedbackState {
  feedbacks: Feedback[];
  addFeedback: (feedback: Feedback) => void;
  getFeedbackForUser: (userId: string) => { received: Feedback[]; sent: Feedback[] };
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      feedbacks: MOCK_FEEDBACK,
      addFeedback: (feedback) => set(s => ({ feedbacks: [feedback, ...s.feedbacks] })),
      getFeedbackForUser: (userId) => {
        const all = get().feedbacks;
        return {
          received: all.filter(f => f.toUserId === userId),
          sent: all.filter(f => f.fromUserId === userId),
        };
      },
    }),
    { name: 'review-feedback' }
  )
);
