export type UserRole = 'admin' | 'manager' | 'employee';
export type ReviewStatus = 'draft' | 'active' | 'self_review' | 'manager_review' | 'calibration' | 'closed';
export type ReviewType = 'scheduled' | 'adhoc';
export type FeedbackType = 'praise' | 'suggestion' | 'note';
export type QuestionType = 'rating' | 'text' | 'competency';
export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted';
export type GoalStatus = 'on_track' | 'at_risk' | 'completed' | 'cancelled';
export type NotificationType = 'deadline' | 'feedback' | 'review_result' | 'nudge' | 'system';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  position: string;
  managerId?: string;
  avatarColor: string;
}

export interface ReviewCycle {
  id: string;
  title: string;
  type: ReviewType;
  status: ReviewStatus;
  templateId: string;
  targetDepartments: string[];
  selfReviewDeadline: string;
  managerReviewDeadline: string;
  createdBy: string;
  createdAt: string;
  completionRate: number;
}

export interface ReviewTemplate {
  id: string;
  name: string;
  description: string;
  questions: TemplateQuestion[];
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
}

export interface TemplateQuestion {
  id: string;
  text: string;
  type: QuestionType;
  target: 'self' | 'manager' | 'both';
  isPrivate: boolean;
  ratingScale?: number;
  isRequired: boolean;
  helpText?: string;
  exampleAnswer?: string;
  order: number;
}

export interface ReviewSubmission {
  id: string;
  cycleId: string;
  reviewerId: string;
  revieweeId: string;
  type: 'self' | 'downward';
  status: SubmissionStatus;
  answers: Answer[];
  overallRating?: number;
  submittedAt?: string;
  lastSavedAt: string;
}

export interface Answer {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
}

export interface Feedback {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: FeedbackType;
  content: string;
  isAnonymous: boolean;
  cycleId?: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  progress: number;
  dueDate: string;
  status: GoalStatus;
  cycleId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}
