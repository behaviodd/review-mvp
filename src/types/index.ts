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
  role?: string;      // 겸임조직 내 역할 (자유 텍스트)
  startDate: string;
  endDate?: string;
  ratio?: number;     // 겸임 비율 %
  note?: string;
}

export type CycleTargetMode = 'org' | 'manager' | 'custom';

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
  tags?: string[];
  archivedAt?: string;
  templateSnapshot?: ReviewTemplate;
  templateSnapshotAt?: string;
  fromCycleId?: string;
  // Phase 3.2a
  folderId?: string;
  targetMode?: CycleTargetMode;
  targetManagerId?: string;
  targetUserIds?: string[];
  // Phase 3.2b
  scheduledPublishAt?: string;
  autoAdvance?: AutoAdvanceRule;
  reminderPolicy?: ReminderRule[];
  editLockedAt?: string;
  autoArchived?: boolean;
  closedAt?: string;
  // Phase 3.3a
  anonymity?: AnonymityPolicy;
  visibility?: VisibilityPolicy;
  referenceInfo?: ReferenceInfoPolicy;
  // Phase 3.3b-1
  reviewKinds?: ReviewKind[];
  peerSelection?: PeerSelectionPolicy;
  // Phase 3.3c-2
  distribution?: DistributionPolicy;
}

export interface CycleFolder {
  id: string;
  name: string;
  order: number;
  color?: string;
  createdBy: string;
  createdAt: string;
}

export interface TemplateSection {
  id: string;
  name: string;
  order: number;
}

export interface ReviewTemplate {
  id: string;
  name: string;
  description: string;
  questions: TemplateQuestion[];
  sections?: TemplateSection[];
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
  allowMultiple?: boolean;
  order: number;
  sectionId?: string;
}

export interface ReminderRecord {
  at: string;
  by: string;
  channel: 'inapp';
  ruleId?: string;   // 자동 규칙 발송 시 규칙 id; 수동 리마인드는 undefined
}

export interface AutoAdvanceRule {
  stage: 'self_to_manager';
  graceHours: number;
  threshold?: number;  // 0~100 (제출율 %)
}

export type ReminderTrigger = 'before_deadline' | 'overdue';
export type ReminderAudience = 'not_started' | 'in_progress' | 'all_pending';
export type ReminderStage = 'self' | 'manager' | 'both';

export interface ReminderRule {
  id: string;
  trigger: ReminderTrigger;
  offsetHours: number;
  audience: ReminderAudience;
  stage: ReminderStage;
  channel: 'inapp';
}

// Phase 3.3a — 정책 3종
export interface AnonymityPolicy {
  peer?: boolean;
  upward?: boolean;
  downward?: boolean;
  self?: boolean;
}

export type VisibilityWhen = 'submission' | 'cycle_close';

export interface VisibilityPolicy {
  downwardToReviewee?: VisibilityWhen;
  peerToReviewee?: VisibilityWhen;
  upwardToReviewee?: VisibilityWhen;
}

export interface ReferenceInfoPolicy {
  includeGoals?: boolean;
  includePreviousReview?: boolean;
}

// Phase 3.3b-1
export type ReviewKind = 'self' | 'peer' | 'upward' | 'downward';
export type PeerSelectionMethod = 'reviewee_picks' | 'leader_approves' | 'admin_assigns';
export interface PeerSelectionPolicy {
  method: PeerSelectionMethod;
  minPeers: number;
  maxPeers: number;
  selectionDeadline?: string;
}

// Phase 3.3c-2
export type PeerProposalStatus = 'pending' | 'approved' | 'rejected';
export interface PeerProposal {
  status: PeerProposalStatus;
  proposedAt: string;
  proposedBy: string;        // reviewee
  decidedAt?: string;
  decidedBy?: string;        // leader
  rejectionReason?: string;
}

export type DistributionMethod = 'guide' | 'hard';
export interface DistributionBand {
  label: string;             // 'S' | 'A' | 'B' | 'C' | 'D' 등
  ratio: number;             // 0-100 %
  minRating?: number;        // 5점 척도의 구간 (선택)
  maxRating?: number;
}
export interface DistributionPolicy {
  method: DistributionMethod;
  bands: DistributionBand[];
}

export interface DeadlineExtension {
  until: string;          // ISO date
  extendedBy: string;     // actorId
  extendedAt: string;     // ISO datetime
  reason?: string;
}

export interface ReviewerChange {
  from: string;
  to: string;
  at: string;
  by: string;
  reason?: string;
}

export interface ReviewSubmission {
  id: string;
  cycleId: string;
  reviewerId: string;
  revieweeId: string;
  type: ReviewKind;   // self | peer | upward | downward (3.3b-1)
  status: SubmissionStatus;
  answers: Answer[];
  overallRating?: number;
  submittedAt?: string;
  lastSavedAt: string;
  remindersSent?: ReminderRecord[];
  deadlineOverride?: DeadlineExtension;
  proxyWrittenBy?: string;
  reviewerHistory?: ReviewerChange[];
  autoExcluded?: { at: string; reason: 'inactive' | 'leave_date' | 'removed' };
  peerProposal?: PeerProposal;    // peer 타입 + leader_approves 방식에서만 사용
}

export type AuditAction =
  | 'cycle.status_transition'
  | 'cycle.repushed'
  | 'cycle.settings_updated'
  | 'submission.reminder_sent'
  | 'submission.deadline_extended'
  | 'submission.reviewer_reassigned'
  | 'submission.proxy_write_started'
  | 'submission.proxy_submitted'
  | 'submission.reopened';

export interface AuditLogEntry {
  id: string;
  cycleId: string;
  actorId: string;
  action: AuditAction;
  targetIds: string[];
  summary: string;
  meta?: Record<string, unknown>;
  at: string;
}

export interface Answer {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
  selectedOptions?: string[];
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
