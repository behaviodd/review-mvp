import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTeamStore } from '../../stores/teamStore';
import { useReviewStore } from '../../stores/reviewStore';
import { useProfileFieldStore, PROFILE_FIELD_LABEL } from '../../stores/profileFieldStore';
import { usePermission } from '../../hooks/usePermission';
import { SideDrawer } from '../ui/SideDrawer';
import { UserAvatar } from '../ui/UserAvatar';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { MsButton } from '../ui/MsButton';
import { MsEditIcon, MsLockIcon } from '../ui/MsIcons';
import { Pill } from '../ui/Pill';
import { canViewField, getFieldValue, getViewerTypes } from '../../utils/profileFieldVisibility';
import { formatDate } from '../../utils/dateUtils';
import type { ProfileFieldKey } from '../../types';
import { ReviewerAssignmentModal } from './ReviewerAssignmentModal';
import { Tab } from '../ui/Tab';

interface Props {
  userId: string | null;
  onClose: () => void;
  onEdit?: (userId: string) => void;
}

const GRADE_FROM_RATING = (r: number) => r >= 4.5 ? 'S' : r >= 3.5 ? 'A' : r >= 2.5 ? 'B' : r >= 1.5 ? 'C' : 'D';

type DrawerTab = 'info' | 'review';

export function MemberProfileDrawer({ userId, onClose, onEdit }: Props) {
  const { currentUser } = useAuthStore();
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);
  const reviewerAssignments = useTeamStore(s => s.reviewerAssignments);
  const fields = useProfileFieldStore(s => s.fields);
  const { cycles, submissions } = useReviewStore();
  const { isAdmin, can } = usePermission();
  const canManageReviewerAssignments = can.manageReviewerAssignments;

  const [activeTab, setActiveTab] = useState<DrawerTab>('info');

  const target = userId ? users.find(u => u.id === userId) ?? null : null;

  const headerExtras = target && can.manageOrg && onEdit
    ? (
      <MsButton variant="outline-default" size="sm" leftIcon={<MsEditIcon size={14} />} onClick={() => onEdit(target.id)}>
        정보 수정
      </MsButton>
    )
    : undefined;

  const subtitle = target ? `${target.department}${target.position ? ` · ${target.position}` : ''}` : undefined;

  // 평가 이력: 해당 구성원이 제출한 자기평가 + 받은 조직장 평가
  const memberSubmissions = userId
    ? submissions.filter(s => s.revieweeId === userId && s.status === 'submitted')
        .sort((a, b) => new Date(b.submittedAt ?? b.lastSavedAt).getTime() - new Date(a.submittedAt ?? a.lastSavedAt).getTime())
    : [];
  const selfSubs = memberSubmissions.filter(s => s.type === 'self');
  const reviewHistoryCount = selfSubs.length;

  return (
    <SideDrawer
      open={!!userId}
      onClose={onClose}
      title={target?.name ?? '구성원 프로필'}
      description={subtitle}
      width="md"
      headerExtras={headerExtras}
    >
      {!target ? (
        <div className="px-5 py-4">
          <EmptyState illustration="empty-list" title="구성원을 찾을 수 없습니다." description="잘못된 경로이거나 삭제된 구성원입니다." />
        </div>
      ) : (
        <>
          {/* 탭 스트립 */}
          <div className="px-5 border-b border-bd-default flex gap-1">
            <Tab active={activeTab === 'info'} onClick={() => setActiveTab('info')}>
              기본 정보
            </Tab>
            <Tab active={activeTab === 'review'} onClick={() => setActiveTab('review')} count={reviewHistoryCount || undefined}>
              평가 이력
            </Tab>
          </div>

          <div className="px-5 py-4">
            {activeTab === 'info' && (
              <ProfileBody
                target={target}
                currentUser={currentUser}
                users={users}
                orgUnits={orgUnits}
                reviewerAssignments={reviewerAssignments}
                fields={fields}
                isAdmin={isAdmin}
                canManageReviewerAssignments={canManageReviewerAssignments}
              />
            )}
            {activeTab === 'review' && (
              <ReviewHistory
                selfSubs={selfSubs}
                memberSubmissions={memberSubmissions}
                cycles={cycles}
                users={users}
              />
            )}
          </div>
        </>
      )}
    </SideDrawer>
  );
}

// ─── 기본 정보 탭 ─────────────────────────────────────────────────────────────
function ProfileBody({
  target, currentUser, users, orgUnits, reviewerAssignments, fields, isAdmin, canManageReviewerAssignments,
}: {
  target: NonNullable<ReturnType<typeof useTeamStore.getState>['users'][number]>;
  currentUser: ReturnType<typeof useAuthStore.getState>['currentUser'];
  users: ReturnType<typeof useTeamStore.getState>['users'];
  orgUnits: ReturnType<typeof useTeamStore.getState>['orgUnits'];
  reviewerAssignments: ReturnType<typeof useTeamStore.getState>['reviewerAssignments'];
  fields: ReturnType<typeof useProfileFieldStore.getState>['fields'];
  isAdmin: boolean;
  canManageReviewerAssignments: boolean;
}) {
  const viewerTypes = getViewerTypes(currentUser, target, orgUnits, reviewerAssignments);
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);
  const visibleFields = sortedFields.filter(f => canViewField(viewerTypes, f, isAdmin));

  const headIds = new Set(orgUnits.map(o => o.headId).filter(Boolean));
  const tier = target.role === 'admin' ? 'admin' : headIds.has(target.id) ? 'leader' : 'member';

  // 조직 경로 계산
  const orgPath: string[] = [];
  let cur = target.orgUnitId ? orgUnits.find(u => u.id === target.orgUnitId) : null;
  while (cur) {
    orgPath.unshift(cur.name);
    cur = cur.parentId ? orgUnits.find(u => u.id === cur!.parentId) ?? null : null;
  }

  return (
    <div className="space-y-5">
      {/* 프로필 헤더 */}
      <div className="flex items-center gap-4 py-2">
        <UserAvatar user={target} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-fg-default">{target.name}</h2>
            {target.nameEn && <span className="text-base text-fg-subtlest">({target.nameEn})</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <StatusBadge type="role" value={tier} />
            {target.activityStatus === 'terminated'   && <Pill tone="danger"  size="sm">퇴사</Pill>}
            {target.activityStatus === 'leave_short'  && <Pill tone="warning" size="sm">단기 휴직</Pill>}
            {target.activityStatus === 'leave_long'   && <Pill tone="warning" size="sm">장기 휴직</Pill>}
          </div>
          <p className="text-base text-fg-subtle mt-1">
            {target.position}
            {target.jobFunction && <span className="text-fg-subtlest"> · {target.jobFunction}</span>}
          </p>
        </div>
      </div>

      {/* 조직 경로 */}
      {orgPath.length > 0 && (
        <div className="border-t border-bd-default pt-4">
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-2">소속 조직</p>
          <div className="flex items-center gap-1 flex-wrap text-xs text-fg-subtle">
            {orgPath.map((name, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-020">›</span>}
                <span className={i === orgPath.length - 1 ? 'font-semibold text-fg-default' : ''}>{name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="border-t border-bd-default pt-4">
        <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-4">기본 정보</p>
        {visibleFields.length === 0 ? (
          <div className="flex items-center gap-2 text-base text-fg-subtlest py-2">
            <MsLockIcon size={14} />
            <span>표시할 수 있는 항목이 없습니다.</span>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
            {visibleFields.map(f => (
              <FieldDisplay key={f.key} fieldKey={f.key} value={getFieldValue(target, f.key)} />
            ))}
          </dl>
        )}
      </div>

      {/* 평가권자 */}
      <ReviewerSection
        target={target}
        reviewerAssignments={reviewerAssignments}
        users={users}
        canManageReviewerAssignments={canManageReviewerAssignments}
      />
    </div>
  );
}

// ─── 평가 이력 탭 ─────────────────────────────────────────────────────────────
function ReviewHistory({
  selfSubs, memberSubmissions, cycles, users,
}: {
  selfSubs: ReturnType<typeof useReviewStore.getState>['submissions'];
  memberSubmissions: ReturnType<typeof useReviewStore.getState>['submissions'];
  cycles: ReturnType<typeof useReviewStore.getState>['cycles'];
  users: ReturnType<typeof useTeamStore.getState>['users'];
}) {
  if (selfSubs.length === 0 && memberSubmissions.length === 0) {
    return (
      <EmptyState
        illustration="empty-list"
        title="평가 이력 없음"
        description="제출된 자기평가 또는 조직장 평가가 없습니다."
        compact
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 자기평가 이력 */}
      {selfSubs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">자기평가</p>
          <div className="divide-y divide-bd-default border-t border-bd-default">
            {selfSubs.map(sub => {
              const cycle = cycles.find(c => c.id === sub.cycleId);
              const grade = sub.overallRating ? GRADE_FROM_RATING(sub.overallRating) : null;
              const ratingVals = sub.answers.filter(a => a.ratingValue).map(a => a.ratingValue!);
              const avgRating = ratingVals.length
                ? (ratingVals.reduce((s, v) => s + v, 0) / ratingVals.length).toFixed(1)
                : null;
              return (
                <div key={sub.id} className="py-3 flex items-center gap-3">
                  {/* 등급 뱃지 */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0 ${
                    grade === 'S' ? 'bg-purple-005 text-purple-040' :
                    grade === 'A' ? 'bg-blue-005 text-blue-060' :
                    grade === 'B' ? 'bg-green-005 text-green-060' :
                    grade === 'C' ? 'bg-orange-005 text-orange-050' :
                    grade === 'D' ? 'bg-red-005 text-red-050' :
                    'bg-gray-010 text-fg-subtlest'
                  }`}>
                    {grade ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-fg-default truncate">
                      {cycle?.title ?? sub.cycleId}
                    </p>
                    <p className="text-xs text-fg-subtle">
                      {sub.submittedAt ? formatDate(sub.submittedAt) : '날짜 없음'}
                      {avgRating && <span className="ml-2 text-fg-subtlest">평균 {avgRating}점</span>}
                    </p>
                  </div>
                  <StatusBadge type="submission" value="submitted" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 받은 조직장 평가 이력 */}
      {(() => {
        const received = memberSubmissions.filter(s => s.type === 'downward');
        if (!received.length) return null;
        return (
          <div>
            <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-3">받은 조직장 평가</p>
            <div className="divide-y divide-bd-default border-t border-bd-default">
              {received.map(sub => {
                const cycle   = cycles.find(c => c.id === sub.cycleId);
                const reviewer = users.find(u => u.id === sub.reviewerId);
                const grade = sub.overallRating ? GRADE_FROM_RATING(sub.overallRating) : null;
                return (
                  <div key={sub.id} className="py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base flex-shrink-0 ${
                      grade === 'S' ? 'bg-purple-005 text-purple-040' :
                      grade === 'A' ? 'bg-blue-005 text-blue-060' :
                      grade === 'B' ? 'bg-green-005 text-green-060' :
                      grade === 'C' ? 'bg-orange-005 text-orange-050' :
                      grade === 'D' ? 'bg-red-005 text-red-050' :
                      'bg-gray-010 text-fg-subtlest'
                    }`}>
                      {grade ?? '—'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-fg-default truncate">
                        {cycle?.title ?? sub.cycleId}
                      </p>
                      <p className="text-xs text-fg-subtle">
                        {reviewer ? `${reviewer.name} · ${reviewer.position}` : '평가자 미상'}
                        {sub.submittedAt && <span className="ml-2 text-fg-subtlest">{formatDate(sub.submittedAt)}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── 평가권자 섹션 ────────────────────────────────────────────────────────────
function ReviewerSection({
  target, reviewerAssignments, users, canManageReviewerAssignments,
}: {
  target: NonNullable<ReturnType<typeof useTeamStore.getState>['users'][number]>;
  reviewerAssignments: ReturnType<typeof useTeamStore.getState>['reviewerAssignments'];
  users: ReturnType<typeof useTeamStore.getState>['users'];
  canManageReviewerAssignments: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const activeAssignments = reviewerAssignments
    .filter(a => a.revieweeId === target.id && !a.endDate)
    .sort((a, b) => a.rank - b.rank);

  return (
    <div className="border-t border-bd-default pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide">평가권자</p>
        {canManageReviewerAssignments && (
          <MsButton variant="outline-default" size="sm" leftIcon={<MsEditIcon size={12} />} onClick={() => setModalOpen(true)}>
            편집
          </MsButton>
        )}
      </div>
      {activeAssignments.length === 0 ? (
        <p className="text-base text-fg-subtlest py-2">배정된 평가권자가 없습니다.</p>
      ) : (
        <ul className="space-y-1">
          {activeAssignments.map(a => {
            const reviewer = users.find(u => u.id === a.reviewerId);
            return (
              <li key={a.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-interaction-hovered transition-colors">
                <span className="inline-flex items-center justify-center min-w-[32px] h-5 px-1.5 rounded-full bg-pink-005 text-pink-060 text-xs font-semibold">
                  {a.rank}차
                </span>
                {reviewer ? (
                  <>
                    <UserAvatar user={reviewer} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-fg-default truncate">{reviewer.name}</p>
                      <p className="text-xs text-fg-subtlest truncate">{reviewer.position} · {reviewer.department}</p>
                    </div>
                  </>
                ) : (
                  <p className="flex-1 text-base text-fg-subtlest italic">알 수 없음 ({a.reviewerId})</p>
                )}
                <Pill tone={SOURCE_TONE[a.source]} size="xs">{SOURCE_LABEL[a.source]}</Pill>
              </li>
            );
          })}
        </ul>
      )}
      {canManageReviewerAssignments && (
        <ReviewerAssignmentModal open={modalOpen} onClose={() => setModalOpen(false)} revieweeId={target.id} />
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  org_head_inherited: '조직장 자동',
  manual:             '수동 지정',
  excel_import:       '엑셀 일괄',
};
const SOURCE_TONE: Record<string, 'info' | 'neutral' | 'success'> = {
  org_head_inherited: 'info',
  manual:             'neutral',
  excel_import:       'success',
};

function FieldDisplay({ fieldKey, value }: { fieldKey: ProfileFieldKey; value: string }) {
  const display = !value
    ? <span className="text-gray-030">—</span>
    : fieldKey === 'joinDate' ? formatDate(value) : value;
  return (
    <div>
      <dt className="text-[11px] font-medium text-fg-subtlest uppercase tracking-wide mb-1">{PROFILE_FIELD_LABEL[fieldKey]}</dt>
      <dd className="text-base text-gray-080 break-all">{display}</dd>
    </div>
  );
}
