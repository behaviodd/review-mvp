import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useTeamStore } from '../../stores/teamStore';
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

interface Props {
  /** 열람할 구성원 id. null 이면 드로어 닫힘. */
  userId: string | null;
  onClose: () => void;
  /** '정보 수정' 클릭 시 호출 — 보통 onClose 후 edit 페이지로 이동. */
  onEdit?: (userId: string) => void;
}

/**
 * 구성원 프로필 사이드 드로어.
 * 표시 로직은 MemberProfile 페이지와 동일 — ProfileFieldStore 의 권한 필터 적용.
 */
export function MemberProfileDrawer({ userId, onClose, onEdit }: Props) {
  const { currentUser } = useAuthStore();
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);
  const reviewerAssignments = useTeamStore(s => s.reviewerAssignments);
  const fields = useProfileFieldStore(s => s.fields);
  const { isAdmin, can } = usePermission();
  const canManageReviewerAssignments = can.manageReviewerAssignments;

  const target = userId ? users.find(u => u.id === userId) ?? null : null;

  const headerExtras = target && can.manageOrg && onEdit
    ? (
      <MsButton
        variant="outline-default"
        size="sm"
        leftIcon={<MsEditIcon size={14} />}
        onClick={() => onEdit(target.id)}
      >
        정보 수정
      </MsButton>
    )
    : undefined;

  const subtitle = target ? `${target.department}${target.position ? ` · ${target.position}` : ''}` : undefined;

  return (
    <SideDrawer
      open={!!userId}
      onClose={onClose}
      title={target?.name ?? '구성원 프로필'}
      description={subtitle}
      width="md"
      headerExtras={headerExtras}
    >
      <div className="px-5 py-4">
        {!target ? (
          <EmptyState
            illustration="empty-list"
            title="구성원을 찾을 수 없습니다."
            description="잘못된 경로이거나 삭제된 구성원입니다."
          />
        ) : (
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
      </div>
    </SideDrawer>
  );
}

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
  const tier = target.role === 'admin'
    ? 'admin'
    : headIds.has(target.id) ? 'leader' : 'member';

  return (
    <div className="space-y-5">
      {/* 프로필 헤더 카드 */}
      <div className="bg-white rounded-xl border border-gray-020 p-4 flex items-center gap-4">
        <UserAvatar user={target} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-fg-default">{target.name}</h2>
            {target.nameEn && <span className="text-base text-fg-subtlest">({target.nameEn})</span>}
            <StatusBadge type="role" value={tier} />
            {target.activityStatus === 'terminated' && (
              <Pill tone="danger" size="sm">퇴사</Pill>
            )}
            {target.activityStatus === 'leave_short' && (
              <Pill tone="warning" size="sm">단기 휴직</Pill>
            )}
            {target.activityStatus === 'leave_long' && (
              <Pill tone="warning" size="sm">장기 휴직</Pill>
            )}
          </div>
          <p className="text-base text-fg-subtle mt-1">
            {target.department}
            {target.position && <> · {target.position}</>}
          </p>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <div className="bg-white rounded-xl border border-gray-020 p-4">
        <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide mb-4">기본 정보</p>

        {visibleFields.length === 0 ? (
          <div className="flex items-center gap-2 text-base text-fg-subtlest py-2">
            <MsLockIcon size={14} />
            <span>표시할 수 있는 항목이 없습니다.</span>
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4">
            {visibleFields.map(f => (
              <FieldDisplay key={f.key} fieldKey={f.key} value={getFieldValue(target, f.key)} />
            ))}
          </dl>
        )}
      </div>

      {/* 평가권자 카드 */}
      <ReviewerSection
        target={target}
        reviewerAssignments={reviewerAssignments}
        users={users}
        canManageReviewerAssignments={canManageReviewerAssignments}
      />
    </div>
  );
}

function ReviewerSection({
  target,
  reviewerAssignments,
  users,
  canManageReviewerAssignments,
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
    <div className="bg-white rounded-xl border border-gray-020 p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-semibold text-fg-subtlest uppercase tracking-wide">평가권자</p>
        {canManageReviewerAssignments && (
          <MsButton
            variant="outline-default"
            size="sm"
            leftIcon={<MsEditIcon size={12} />}
            onClick={() => setModalOpen(true)}
          >
            편집
          </MsButton>
        )}
      </div>
      {activeAssignments.length === 0 ? (
        <p className="text-base text-fg-subtlest py-2">배정된 평가권자가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {activeAssignments.map(a => {
            const reviewer = users.find(u => u.id === a.reviewerId);
            const sourceLabel = SOURCE_LABEL[a.source];
            return (
              <li key={a.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-interaction-hovered transition-colors">
                <span className="inline-flex items-center justify-center min-w-[40px] h-6 px-2 rounded-full bg-bg-token-brand1-subtlest text-fg-brand1 text-xs font-semibold">
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
                  <p className="flex-1 text-base text-fg-subtlest italic">알 수 없는 평가권자 ({a.reviewerId})</p>
                )}
                <Pill tone={SOURCE_TONE[a.source]} size="xs">{sourceLabel}</Pill>
              </li>
            );
          })}
        </ul>
      )}
      {canManageReviewerAssignments && (
        <ReviewerAssignmentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          revieweeId={target.id}
        />
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
    : fieldKey === 'joinDate'
      ? formatDate(value)
      : value;

  return (
    <div>
      <dt className="text-[11px] font-medium text-fg-subtlest uppercase tracking-wide mb-1">{PROFILE_FIELD_LABEL[fieldKey]}</dt>
      <dd className="text-base text-gray-080 break-all">{display}</dd>
    </div>
  );
}
