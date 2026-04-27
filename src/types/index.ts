export type UserRole = 'admin' | 'leader' | 'member';
/** @deprecated R3 에서 제거 — 자유 재귀 트리는 depth 로 표현. 호환 어댑터 userCompat.ts 참조. */
export type OrgUnitType = 'mainOrg' | 'subOrg' | 'team' | 'squad';
export type ReviewStatus = 'draft' | 'active' | 'self_review' | 'manager_review' | 'calibration' | 'closed';
export type ReviewType = 'scheduled' | 'adhoc';
export type FeedbackType = 'praise' | 'suggestion' | 'note';
export type QuestionType = 'rating' | 'text' | 'competency' | 'multiple_choice';
export type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted';
export type GoalStatus = 'on_track' | 'at_risk' | 'completed' | 'cancelled';
export type NotificationType = 'deadline' | 'feedback' | 'review_result' | 'system';

// R1: 휴직 분류 4종 + active. 기존 User.isActive 를 대체.
export type ActivityStatus =
  | 'active'        // 정상 근무
  | 'leave_short'   // 단기 휴직 (사이클 기본 포함, 옵션으로 제외 가능)
  | 'leave_long'    // 장기 휴직 (사이클 자동 제외 권장)
  | 'terminated'    // 퇴사 (사이클 자동 제외)
  | 'other';        // 기타 (관리자 판단)

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  avatarColor: string;
  // R1: 단일 주조직 (자유 재귀 트리에서 OrgUnit.id 참조)
  orgUnitId?: string;          // 마이그레이션 후 모든 사용자에 채워짐
  // R1: 휴직 분류 (기존 isActive/leaveDate 대체)
  activityStatus?: ActivityStatus;
  statusChangedAt?: string;
  statusReason?: string;
  // 시트 연동 확장 필드
  nameEn?: string;
  phone?: string;
  joinDate?: string;
  jobFunction?: string;

  /** @deprecated R3 에서 제거. orgUnitId + OrgUnit 트리에서 mainOrg 이름 조회 → userCompat.legacyDepartment(). 단 R1 동안 호환을 위해 항상 값 유지. */
  department: string;
  /** @deprecated R3 에서 제거. userCompat.legacySubOrg() 사용. */
  subOrg?: string;
  /** @deprecated R3 에서 제거. userCompat.legacyTeam() 사용. */
  team?: string;
  /** @deprecated R3 에서 제거. userCompat.legacySquad() 사용. */
  squad?: string;
  /** @deprecated R5 에서 SecondaryOrgAssignment 로 일원화. */
  secondaryDept?: string;
  /** @deprecated R5 에서 SecondaryOrgAssignment 로 일원화. */
  secondaryPosition?: string;
  /** @deprecated R3 에서 제거. activityStatus 사용 (active/terminated 등). userCompat.isUserActive() 사용. */
  isActive?: boolean;
  /** @deprecated R3 에서 제거. statusChangedAt 사용. */
  leaveDate?: string;
  /** @deprecated R3 에서 제거. ReviewerAssignment(rank=1) 로 이전됨. */
  managerId?: string;
}

export interface OrgUnit {
  id: string;
  name: string;
  /** @deprecated R3 에서 제거 — 자유 재귀 트리는 depth 로만 표현. 호환은 userCompat.getOrgDepth(). 단 R1 동안 값 유지. */
  type: OrgUnitType;
  parentId?: string;          // null 또는 undefined = 루트
  headId?: string;            // 조직 리더 (목표 승인 + 일부 UI 가시성)
  order: number;
}

// R1: 평가권 테이블. 조직 리더(orgUnit.headId)와 분리되어 별도 운영.
export type ReviewerAssignmentSource =
  | 'org_head_inherited'  // 조직 리더 자동 부여 (시드 시 사용)
  | 'manual'              // 직접 지정
  | 'excel_import';       // 엑셀 일괄 업로드

export interface ReviewerAssignment {
  id: string;                   // 'ra_<random>'
  revieweeId: string;
  reviewerId: string;
  rank: number;                 // 1~N (UI 는 1~5 강제, 데이터는 무제한)
  source: ReviewerAssignmentSource;
  startDate: string;            // ISO
  endDate?: string;             // 활성: undefined
  createdAt: string;
  createdBy: string;            // actorId
  note?: string;
}

// R1: 인사 스냅샷. 사이클 발행 시 자동 생성 (hrSnapshotMode='snapshot' 일 때).
export interface OrgSnapshot {
  id: string;                   // 'snap_<random>'
  createdAt: string;
  createdBy: string;
  description: string;
  // 시점 동결 데이터 — 깊은 복제
  users: User[];
  orgUnits: OrgUnit[];
  assignments: ReviewerAssignment[];
}

// R6: 권한 코드 enum.
// admin role 사용자는 자동으로 모든 권한 보유 (소유자 그룹).
// 그 외 사용자는 PermissionGroup 멤버십에 따라 권한 누적 (합집합).
export type PermissionCode =
  | 'cycles.manage'                  // 사이클 생성/편집/삭제/발행
  | 'templates.manage'               // 템플릿 관리
  | 'org.manage'                     // 조직/구성원 추가·수정·퇴사
  | 'reviewer_assignments.manage'    // 평가권자 배정
  | 'permission_groups.manage'       // 권한 그룹 관리 (소유자만)
  | 'auth.impersonate'               // 마스터 로그인 사용
  | 'audit.view'                     // 감사 로그 열람
  | 'reports.view_all'               // 전사 리포트 열람
  | 'settings.manage';               // 시스템 설정 (Apps Script URL 등)

export const ALL_PERMISSION_CODES: PermissionCode[] = [
  'cycles.manage',
  'templates.manage',
  'org.manage',
  'reviewer_assignments.manage',
  'permission_groups.manage',
  'auth.impersonate',
  'audit.view',
  'reports.view_all',
  'settings.manage',
];

// R6: 권한 그룹.
// 한 사용자가 여러 그룹에 속할 수 있고, 가진 권한은 합집합.
// isSystem=true 그룹은 삭제 불가, 권한 항목 변경 불가 (멤버 변경만 가능).
export interface PermissionGroup {
  id: string;                        // 'pg_<random>' 또는 시스템 그룹은 'pg_owner' 등 고정 id
  name: string;                      // '소유자', '리뷰 관리자' 등
  description?: string;
  permissions: PermissionCode[];
  memberIds: string[];               // userId 배열
  isSystem: boolean;                 // 시스템 기본 그룹 여부
  createdAt: string;
  createdBy: string;
}

// R1: 마스터 로그인 감사 로그 (R5-b 에서 UI 활성화).
export interface ImpersonationLog {
  id: string;                   // 'imp_<random>'
  actorId: string;              // 마스터 로그인 한 admin
  targetUserId: string;
  startedAt: string;
  endedAt?: string;
  ip?: string;
  userAgent?: string;
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
  // R1: 인사정보 적용 방식
  hrSnapshotMode?: 'live' | 'snapshot';   // 기본 R4 에서 'snapshot' 으로 변경, R1 은 미설정 = 'live' 호환
  hrSnapshotId?: string;                  // 'snapshot' 모드 시 OrgSnapshot.id
  // R3: downward 평가를 어느 차수의 평가권자가 작성할지 (기본 [1] = 1차만)
  // 예: [1, 2] = 1차+2차 모두 평가, [2] = 2차만
  downwardReviewerRanks?: number[];
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
  // R3: downward submission 의 차수 (1차/2차 매니저 등). 다른 type 은 미사용.
  reviewerRank?: number;
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
  | 'submission.reopened'
  // R1: 평가권/스냅샷/마스터 로그인
  | 'reviewer_assignment.created'
  | 'reviewer_assignment.ended'
  | 'reviewer_assignment.bulk_inherit'
  | 'org_snapshot.created'
  | 'auth.impersonate_start'
  | 'auth.impersonate_end'
  | 'org.user_status_changed'
  | 'org.migrated_to_r1'
  // R6
  | 'permission_group.created'
  | 'permission_group.updated'
  | 'permission_group.deleted'
  | 'permission_group.member_added'
  | 'permission_group.member_removed';

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
