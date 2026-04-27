import { useEffect, useMemo, useState } from 'react';
import { useTeamStore } from '../../stores/teamStore';
import { useShowToast } from '../ui/Toast';
import { ModalShell } from '../review/modals/ModalShell';
import { MsButton } from '../ui/MsButton';
import { MsInput, MsCheckbox } from '../ui/MsControl';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { UserAvatar } from '../ui/UserAvatar';
import { MsCancelIcon, MsDeleteIcon, MsLockIcon } from '../ui/MsIcons';
import { permissionGroupWriter } from '../../utils/sheetWriter';
import { PERMISSION_META, PERMISSION_CATEGORIES } from '../../utils/permissionLabels';
import { isUserActive } from '../../utils/userCompat';
import type { PermissionCode, PermissionGroup } from '../../types';

interface Props {
  group: PermissionGroup | null;
  open: boolean;
  onClose: () => void;
  /** 신규 그룹 생성 모드 (group 은 null) */
  isNew?: boolean;
}

/**
 * R6 Phase C3: 권한 그룹 편집/생성 모달.
 * - 시스템 그룹: 멤버만 변경 가능 (이름/설명/권한 잠금, 삭제 비활성)
 * - 일반 그룹: 모두 변경 가능
 *
 * 레이아웃: ModalShell (구성원 추가 모달과 동일 패턴)
 *  - 섹션별 uppercase 헤더
 *  - 그리드 폼
 *  - 푸터: 취소 + 추가/저장 (편집 시 삭제)
 */
export function PermissionGroupDrawer({ group, open, onClose, isNew }: Props) {
  const users = useTeamStore(s => s.users);
  const createPermissionGroup = useTeamStore(s => s.createPermissionGroup);
  const updatePermissionGroup = useTeamStore(s => s.updatePermissionGroup);
  const deletePermissionGroup = useTeamStore(s => s.deletePermissionGroup);
  const showToast = useShowToast();

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [permissions, setPermissions] = useState<PermissionCode[]>(group?.permissions ?? []);
  const [memberIds, setMemberIds] = useState<string[]>(group?.memberIds ?? []);
  const [memberQuery, setMemberQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // group 변경 시 폼 초기화
  useEffect(() => {
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setPermissions(group?.permissions ?? []);
    setMemberIds(group?.memberIds ?? []);
    setMemberQuery('');
  }, [group?.id, open]);

  const isSystem = group?.isSystem ?? false;
  const lockMeta = isSystem;

  const togglePermission = (code: PermissionCode) => {
    if (lockMeta) return;
    setPermissions(prev =>
      prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]
    );
  };

  const toggleMember = (userId: string) => {
    setMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const candidateUsers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return users
      .filter(u => isUserActive(u))
      .filter(u => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [users, memberQuery]);

  const handleSave = () => {
    if (!name.trim()) {
      showToast('error', '그룹 이름을 입력하세요.');
      return;
    }
    if (isNew) {
      const created = createPermissionGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
        memberIds,
        createdBy: 'admin',
      });
      permissionGroupWriter.upsert(created);
      showToast('success', `'${created.name}' 그룹이 생성되었습니다.`);
    } else if (group) {
      updatePermissionGroup(group.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
        memberIds,
      });
      const updated = useTeamStore.getState().permissionGroups.find(g => g.id === group.id);
      if (updated) permissionGroupWriter.upsert(updated);
      showToast('success', `'${name}' 그룹이 수정되었습니다.`);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!group) return;
    const ok = deletePermissionGroup(group.id);
    if (ok) {
      permissionGroupWriter.delete(group.id);
      showToast('success', `'${group.name}' 그룹이 삭제되었습니다.`);
      setConfirmDelete(false);
      onClose();
    } else {
      showToast('error', '시스템 그룹은 삭제할 수 없습니다.');
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title={isNew ? '새 권한 그룹' : (group?.name ?? '권한 그룹')}
        description={isSystem ? '시스템 기본 그룹 — 이름/설명/권한은 잠겨 있습니다. 멤버만 변경 가능.' : undefined}
        widthClass="max-w-2xl"
        footer={
          <>
            {!isNew && !isSystem && (
              <MsButton size="sm" variant="outline-red" leftIcon={<MsDeleteIcon />} onClick={() => setConfirmDelete(true)}>
                삭제
              </MsButton>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-060 hover:text-gray-099"
            >
              취소
            </button>
            <MsButton onClick={handleSave} disabled={!name.trim()}>
              {isNew ? '추가' : '저장'}
            </MsButton>
          </>
        }
      >
        <div className="space-y-5">
          {/* 기본 정보 */}
          <div>
            <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">기본 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <MsInput
                  autoFocus
                  label="그룹 이름 *"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="예) 리뷰 관리자"
                  disabled={lockMeta}
                />
              </div>
              <div className="col-span-2">
                <MsInput
                  label="설명"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="이 그룹의 책임/범위"
                  disabled={lockMeta}
                />
              </div>
            </div>
          </div>

          {/* 권한 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide">권한</p>
              {lockMeta && <MsLockIcon size={12} className="text-gray-040" />}
              <span className="text-[11px] text-gray-040">{permissions.length}개 선택</span>
            </div>
            <div className="space-y-3">
              {PERMISSION_CATEGORIES.map(cat => {
                const items = Object.values(PERMISSION_META).filter(m => m.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="rounded-lg border border-gray-010 p-3">
                    <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wider mb-2">{cat}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {items.map(meta => {
                        const checked = permissions.includes(meta.code);
                        return (
                          <label
                            key={meta.code}
                            className={`flex items-start gap-2 cursor-pointer rounded p-1.5 -mx-1.5 transition-colors ${
                              lockMeta ? 'cursor-not-allowed opacity-70' : 'hover:bg-gray-005'
                            }`}
                          >
                            <MsCheckbox
                              checked={checked}
                              disabled={lockMeta}
                              onChange={() => togglePermission(meta.code)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-080">{meta.label}</p>
                              <p className="text-[11px] text-gray-050">{meta.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 멤버 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide">멤버</p>
              <span className="text-[11px] text-gray-040">{memberIds.length}명</span>
            </div>

            {/* 현재 멤버 칩 */}
            {memberIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-010 bg-gray-001 p-2 mb-3">
                {memberIds.map(id => {
                  const u = users.find(x => x.id === id);
                  if (!u) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-010 px-2 py-0.5 text-xs"
                    >
                      <UserAvatar user={u} size="sm" />
                      <span className="font-medium text-gray-080">{u.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleMember(id)}
                        className="text-gray-040 hover:text-red-060"
                        aria-label="제거"
                      >
                        <MsCancelIcon size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <MsInput
              value={memberQuery}
              onChange={e => setMemberQuery(e.target.value)}
              placeholder="이름·이메일·부서로 검색"
            />
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-gray-010 divide-y divide-gray-005">
              {candidateUsers.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-gray-040">검색 결과가 없습니다.</p>
              ) : (
                candidateUsers.map(u => {
                  const checked = memberIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                        checked ? 'bg-pink-005/40' : 'hover:bg-gray-005'
                      }`}
                    >
                      <MsCheckbox checked={checked} onChange={() => toggleMember(u.id)} />
                      <UserAvatar user={u} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-080 truncate">{u.name}</p>
                        <p className="text-[11px] text-gray-040 truncate">
                          {u.position}{u.department ? ` · ${u.department}` : ''}
                        </p>
                      </div>
                      {u.role === 'admin' && (
                        <span className="text-[10px] font-semibold text-pink-060 bg-pink-005 px-1.5 py-0.5 rounded">admin</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
            <p className="mt-2 text-[11px] text-gray-040">
              admin 역할 사용자는 자동으로 모든 권한을 보유하므로 별도 가입이 불필요합니다 (소유자 그룹).
            </p>
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => handleDelete()}
        title="권한 그룹 삭제"
        description={group ? <>"<strong>{group.name}</strong>" 그룹을 삭제합니다. 이 그룹의 멤버는 더 이상 그룹 권한을 갖지 않습니다.</> : null}
        confirmLabel="삭제"
        tone="danger"
      />
    </>
  );
}
