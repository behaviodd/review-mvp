import { Fragment, useEffect, useMemo, useState } from 'react';
import { useTeamStore } from '../stores/teamStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { MsButton } from '../components/ui/MsButton';
import {
  MsPlusIcon, MsLockIcon, MsProfileIcon, MsSearchIcon, MsCancelIcon,
  MsEditIcon, MsDeleteIcon, MsChevronRightLineIcon,
} from '../components/ui/MsIcons';
import { MsInput } from '../components/ui/MsControl';
import { MsActionMenu } from '../components/ui/MsActionMenu';
import { EmptyState } from '../components/ui/EmptyState';
import { Pill } from '../components/ui/Pill';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useShowToast } from '../components/ui/Toast';
import { PermissionGroupDrawer } from '../components/permission/PermissionGroupDrawer';
import type { PermissionGroup } from '../types';

/**
 * R6 Phase C → Phase D-3.L: 권한 관리 페이지.
 * - 시스템 그룹 + 사용자 정의 그룹 시트형 리스트 (TemplateList / CycleList 패턴 통일)
 * - "새 그룹" 버튼 (permission_groups.manage 권한자만 가시)
 * - row 클릭 → drawer 편집, hover MsActionMenu (편집 / 삭제)
 */
export function Permissions() {
  const permissionGroups = useTeamStore(s => s.permissionGroups);
  const deletePermissionGroup = useTeamStore(s => s.deletePermissionGroup);
  const { can } = usePermission();
  const showToast = useShowToast();

  const [drawerGroup, setDrawerGroup] = useState<PermissionGroup | null>(null);
  const [drawerNewOpen, setDrawerNewOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  /* 정렬: 시스템 → 사용자 정의 → 이름순 */
  const sorted = useMemo(
    () => [...permissionGroups].sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      return a.name.localeCompare(b.name, 'ko');
    }),
    [permissionGroups],
  );

  /* 검색 필터 — name + description */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.description ?? '').toLowerCase().includes(q),
    );
  }, [sorted, search]);

  /* 페이지네이션 — 15개 (TemplateList 패턴) */
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  const visiblePage = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const headerActions = useMemo(() => (
    <>
      <MsInput
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="이름·설명 검색"
        leftSlot={<MsSearchIcon size={14} />}
        rightSlot={search ? (
          <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-default" aria-label="검색 지우기">
            <MsCancelIcon size={14} />
          </button>
        ) : undefined}
        className="w-56 h-10"
      />
      {can.managePermissionGroups && (
        <MsButton size="lg" onClick={() => setDrawerNewOpen(true)} leftIcon={<MsPlusIcon size={16} />}>
          새 그룹
        </MsButton>
      )}
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [search, can.managePermissionGroups]);

  useSetPageHeader('권한 관리', headerActions);

  const handleDelete = (id: string, name: string) => setDeleteTarget({ id, name });
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const ok = deletePermissionGroup(deleteTarget.id);
    if (ok) {
      showToast('success', '권한 그룹이 삭제되었습니다.');
    } else {
      showToast('error', '시스템 그룹은 삭제할 수 없습니다.');
    }
    setDeleteTarget(null);
  };

  if (!can.managePermissionGroups) {
    return (
      <EmptyState
        illustration="empty-list"
        title="권한이 없어요"
        description="권한 그룹 관리는 소유자 또는 '권한 그룹 관리' 권한 보유자만 접근할 수 있습니다."
      />
    );
  }

  if (permissionGroups.length === 0) {
    return (
      <EmptyState
        icon={MsProfileIcon}
        title="등록된 권한 그룹이 없습니다."
        description="시스템 그룹은 자동으로 시드되며, '새 그룹' 으로 사용자 정의 그룹을 만들 수 있습니다."
      />
    );
  }

  return (
    <div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={MsProfileIcon}
          title={`'${search}' 검색 결과가 없습니다.`}
          description="이름 또는 설명에 키워드가 일치하는 권한 그룹을 찾지 못했습니다."
          variant="inline"
        />
      ) : (
        <div className="flex flex-col">
          {visiblePage.map((group, idx) => {
            const isMenuOpen = openMenuId === group.id;
            return (
              <Fragment key={group.id}>
                {idx > 0 && <div className="border-t border-bd-default" />}
                <div
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-action]')) return;
                    setDrawerGroup(group);
                  }}
                  className={`relative group flex items-center gap-4 px-2 py-3 my-1.5 rounded-lg cursor-pointer transition-colors hover:bg-interaction-hovered ${isMenuOpen ? 'z-20' : ''}`}
                >
                  <div className="size-8 bg-bg-token-brand1-subtlest rounded-md flex items-center justify-center flex-shrink-0">
                    <MsLockIcon size={16} className="text-fg-brand1" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-fg-default group-hover:text-pink-060 truncate leading-snug">{group.name}</h3>
                      {group.isSystem && (
                        <Pill tone="neutral" size="xs" leftIcon={<MsLockIcon size={10} />}>시스템</Pill>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-xs text-fg-subtle mt-0.5 truncate">{group.description}</p>
                    )}
                    <p className="text-[11px] text-fg-subtlest mt-0.5">
                      권한 {group.permissions.length}개 · 멤버 {group.memberIds.length}명
                    </p>
                  </div>
                  <MsActionMenu
                    className="flex-shrink-0"
                    triggerVisibility="hover"
                    onOpenChange={open => setOpenMenuId(open ? group.id : null)}
                    items={[
                      { label: '편집', icon: <MsEditIcon size={12} />, onClick: () => setDrawerGroup(group) },
                      { label: '삭제', icon: <MsDeleteIcon size={12} />, onClick: () => handleDelete(group.id, group.name), variant: 'danger', hidden: group.isSystem },
                    ]}
                  />
                  <MsChevronRightLineIcon size={16} className="text-gray-030 group-hover:text-pink-040 flex-shrink-0" />
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 (filtered.length > PAGE_SIZE 시만, TemplateList 패턴 재사용) */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-fg-subtle tracking-[-0.3px]">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / 총 {filtered.length}개
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 px-3 text-xs font-semibold rounded-md border border-bd-default text-fg-default hover:bg-interaction-hovered disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              이전
            </button>
            <span className="px-3 text-xs text-fg-default tabular-nums">
              <strong className="font-bold">{page}</strong> <span className="text-fg-subtlest">/ {totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-3 text-xs font-semibold rounded-md border border-bd-default text-fg-default hover:bg-interaction-hovered disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="권한 그룹 삭제"
        description={deleteTarget ? <>"<strong>{deleteTarget.name}</strong>" 권한 그룹을 삭제합니다.</> : null}
        confirmLabel="삭제"
        tone="danger"
      />
    </div>
  );
}
