import { useMemo, useState } from 'react';
import { useTeamStore } from '../stores/teamStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { MsButton } from '../components/ui/MsButton';
import { MsPlusIcon, MsLockIcon, MsProfileIcon } from '../components/ui/MsIcons';
import { EmptyState } from '../components/ui/EmptyState';
import { Pill } from '../components/ui/Pill';
import { PermissionGroupDrawer } from '../components/permission/PermissionGroupDrawer';
import { getPermissionLabel } from '../utils/permissionLabels';
import type { PermissionGroup } from '../types';

/**
 * R6 Phase C: 권한 관리 페이지.
 * - 시스템 그룹 + 사용자 정의 그룹 카드 목록
 * - "새 그룹" 버튼 (permission_groups.manage 권한자만 가시)
 * - 카드 클릭 → drawer 편집
 */
export function Permissions() {
  const permissionGroups = useTeamStore(s => s.permissionGroups);
  const { can } = usePermission();

  const [drawerGroup, setDrawerGroup] = useState<PermissionGroup | null>(null);
  const [drawerNewOpen, setDrawerNewOpen] = useState(false);

  const headerActions = useMemo(() => can.managePermissionGroups ? (
    <MsButton onClick={() => setDrawerNewOpen(true)} leftIcon={<MsPlusIcon size={16} />}>
      새 그룹
    </MsButton>
  ) : undefined, [can.managePermissionGroups]);

  // Phase D-3.E: subtitle 제거 (다른 페이지 패턴 일관)
  useSetPageHeader('권한 관리', headerActions);

  if (!can.managePermissionGroups) {
    return (
      <EmptyState
        illustration="empty-list"
        title="권한이 없어요"
        description="권한 그룹 관리는 소유자 또는 '권한 그룹 관리' 권한 보유자만 접근할 수 있습니다."
      />
    );
  }

  // 시스템 그룹 → 사용자 정의 순으로 정렬
  const sorted = [...permissionGroups].sort((a, b) => {
    if (a.isSystem && !b.isSystem) return -1;
    if (!a.isSystem && b.isSystem) return 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  /* Phase D-3.E-fix: 1 col 시트 list (사용자 명시) — TemplateList 와 동일 패턴 */
  return (
    <div>
      {sorted.length === 0 ? (
        <EmptyState
          icon={MsProfileIcon}
          title="등록된 권한 그룹이 없습니다."
          description="시스템 그룹은 자동으로 시드되며, '새 그룹' 으로 사용자 정의 그룹을 만들 수 있습니다."
        />
      ) : (
        <div className="border-y border-bd-default divide-y divide-bd-default">
          {sorted.map(group => (
            <button
              key={group.id}
              type="button"
              onClick={() => setDrawerGroup(group)}
              className="flex flex-col gap-2 w-full px-2 py-4 text-left hover:bg-interaction-hovered transition-colors"
            >
              <header className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-fg-default truncate">{group.name}</h3>
                    {group.isSystem && (
                      <Pill tone="neutral" size="xs" leftIcon={<MsLockIcon size={10} />}>
                        시스템
                      </Pill>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-xs text-fg-subtle mt-0.5 line-clamp-2">{group.description}</p>
                  )}
                </div>
              </header>

              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="text-fg-subtlest">
                  권한 <strong className="text-fg-default tabular-nums">{group.permissions.length}</strong>개
                </span>
                <span className="text-fg-subtlest">·</span>
                <span className="text-fg-subtlest">
                  멤버 <strong className="text-fg-default tabular-nums">{group.memberIds.length}</strong>명
                </span>
              </div>

              {group.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {group.permissions.slice(0, 4).map(code => (
                    <span
                      key={code}
                      className="text-[10px] font-medium text-fg-subtle bg-bg-token-subtle border border-bd-default px-1.5 py-0.5 rounded"
                    >
                      {getPermissionLabel(code)}
                    </span>
                  ))}
                  {group.permissions.length > 4 && (
                    <span className="text-[10px] text-fg-subtlest bg-bg-token-subtle px-1.5 py-0.5 rounded">
                      +{group.permissions.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 신규 그룹 drawer */}
      <PermissionGroupDrawer
        group={null}
        isNew
        open={drawerNewOpen}
        onClose={() => setDrawerNewOpen(false)}
      />

      {/* 편집 drawer */}
      <PermissionGroupDrawer
        group={drawerGroup}
        open={drawerGroup !== null}
        onClose={() => setDrawerGroup(null)}
      />
    </div>
  );
}
