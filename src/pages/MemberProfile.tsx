import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useProfileFieldStore, PROFILE_FIELD_LABEL } from '../stores/profileFieldStore';
import { usePermission } from '../hooks/usePermission';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { UserAvatar } from '../components/ui/UserAvatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { MsButton } from '../components/ui/MsButton';
import { MsEditIcon, MsLockIcon } from '../components/ui/MsIcons';
import { Pill } from '../components/ui/Pill';
import { canViewField, getFieldValue, getViewerTypes } from '../utils/profileFieldVisibility';
import { formatDate } from '../utils/dateUtils';
import type { ProfileFieldKey } from '../types';

/**
 * 구성원 프로필 표시 페이지.
 * - 헤더: 아바타 + 이름 + 권한 뱃지 + 소속
 * - 기본 정보 카드: ProfileFieldStore 의 순서·열람 권한에 따라 필드 표시
 * - 어드민/본인은 모든 필드, 조직 리더·평가권자·다른 구성원은 설정에 따라 필터
 */
export function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);
  const reviewerAssignments = useTeamStore(s => s.reviewerAssignments);
  const fields = useProfileFieldStore(s => s.fields);
  const { isAdmin, can } = usePermission();

  const target = users.find(u => u.id === id);

  const headerActions = useMemo(() => {
    if (!target || !can.manageOrg) return undefined;
    return (
      <MsButton
        variant="outline-default"
        leftIcon={<MsEditIcon size={14} />}
        onClick={() => navigate(`/team?edit=${target.id}`)}
      >
        정보 수정
      </MsButton>
    );
  }, [target, can.manageOrg, navigate]);

  useSetPageHeader('구성원 프로필', headerActions, {
    subtitle: target ? `${target.department}${target.position ? ` · ${target.position}` : ''}` : undefined,
    onBack: () => navigate('/team'),
  });

  if (!target) {
    return (
      <EmptyState
        illustration="empty-list"
        title="구성원을 찾을 수 없습니다."
        description="잘못된 경로이거나 삭제된 구성원입니다."
        action={{ label: '구성원 목록으로', onClick: () => navigate('/team') }}
      />
    );
  }

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
      <div className="bg-white rounded-xl border border-gray-020 shadow-card p-5 flex items-center gap-4">
        <UserAvatar user={target} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-099">{target.name}</h2>
            {target.nameEn && <span className="text-sm text-gray-040">({target.nameEn})</span>}
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
          <p className="text-sm text-gray-050 mt-1">
            {target.department}
            {target.position && <> · {target.position}</>}
          </p>
        </div>
      </div>

      {/* 기본 정보 카드 */}
      <div className="bg-white rounded-xl border border-gray-020 shadow-card p-5">
        <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-4">기본 정보</p>

        {visibleFields.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-gray-040 py-2">
            <MsLockIcon size={14} />
            <span>표시할 수 있는 항목이 없습니다.</span>
          </div>
        ) : (
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {visibleFields.map(f => (
              <FieldDisplay key={f.key} fieldKey={f.key} value={getFieldValue(target, f.key)} />
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function FieldDisplay({ fieldKey, value }: { fieldKey: ProfileFieldKey; value: string }) {
  const display = !value
    ? <span className="text-gray-030">—</span>
    : fieldKey === 'joinDate'
      ? formatDate(value)
      : value;

  return (
    <div>
      <dt className="text-[11px] font-medium text-gray-040 uppercase tracking-wide mb-1">{PROFILE_FIELD_LABEL[fieldKey]}</dt>
      <dd className="text-sm text-gray-080 break-all">{display}</dd>
    </div>
  );
}
