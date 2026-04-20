export type UserRole = 'admin' | 'leader' | 'member';
export type OrgUnitType = 'mainOrg' | 'subOrg' | 'team' | 'squad';
export type ReviewStatus = 'draft' | 'active' | 'self_review' | 'manager_review' | 'calibration' | 'closed';
export type ReviewType = 'scheduled' | 'adhoc';
export type FeedbackType = 'praise' | 'suggestion' | 'note';
export type QuestionType = 'rating' | 'text' | 'competency' | 'multiple_choice';
export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted';
export type GoalStatus = 'on_track' | 'at_risk' | 'completed' | 'cancelled';
export type NotificationType = 'deadline' | 'feedback' | 'review_result' | 'system';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;   // 주조직명 (backward compat + 리뷰 타겟팅 기준)
  position: string;
  managerId?: string;
  avatarColor: string;
  // 계층 조직 (다단계)
  subOrg?: string;      // 부조직명
  team?: string;        // 팀명
  squad?: string;       // 스쿼드명
  // 시트 연동 확장 필드
  nameEn?: string;
  phone?: string;
  joinDate?: string;
  jobFunction?: string;
  secondaryDept?: string;
  secondaryPosition?: string;
  isActive?: boolean;
  leaveDate?: string;
}

export interface OrgUnit {
  id: string;
  name: string;
  type: OrgUnitType;
  parentId?: string;
  headId?: string;   // 조직장 사번
  order: number;
}

export interface SecondaryOrgAssignment {
  userId: string;
  orgId: string;
  orgName?: string;   // 겸임조직명 (비정규화 표시용)
  position: string;   // 겸임직책
  startDate: string;
  endDate?: string;
  ratio?: number;     // 겸임 비율 %
  note?: string;
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
  target: 'self' | 'leader' | 'both';
  isPrivate: boolean;
  ratingScale?: number;
  isRequired: boolean;
  helpText?: string;
  exampleAnswer?: string;
  options?: string[];
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
