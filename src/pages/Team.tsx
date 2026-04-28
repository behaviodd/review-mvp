import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { useTeamStore } from '../stores/teamStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { useShowToast } from '../components/ui/Toast';
import { usePendingApprovalsStore } from '../stores/pendingApprovalsStore';
import { isUserActive, getMembersInOrgTree } from '../utils/userCompat';
import {
  ORG_TYPE_NEXT,
  MAX_ORG_DEPTH, getOrgDepth, getOrgLevelLabel,
} from '../utils/teamUtils';
import { UserAvatar } from '../components/ui/UserAvatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Layers, Users } from 'lucide-react';
import {
  MsPlusIcon, MsCancelIcon, MsEditIcon, MsSearchIcon,
  MsChevronRightMonoIcon, MsChevronDownMonoIcon, MsDeleteIcon, MsRefreshIcon,
  MsFriendAddIcon, MsGrabIcon, MsProfileIcon, MsChevronRightLineIcon, MsGroupIcon, MsWarningIcon,
  MsLogoutIcon,
} from '../components/ui/MsIcons';
import type { User, OrgUnit, OrgUnitType, SecondaryOrgAssignment } from '../types';
import { MsButton } from '../components/ui/MsButton';
import { MsCheckbox, MsInput } from '../components/ui/MsControl';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { QuickAddMemberDialog } from '../components/team/QuickAddMemberDialog';
import { OrgUnitDialog, type OrgUnitDialogState } from '../components/team/OrgUnitDialog';
import { impersonationLogWriter } from '../utils/sheetWriter';

/* ── Helpers ────────────────────────────────────────────────────────── */
function matchesSearch(u: User, q: string) {
  const lq = q.toLowerCase();
  return (
    u.name.toLowerCase().includes(lq) ||
    u.position.toLowerCase().includes(lq) ||
    (u.department ?? '').toLowerCase().includes(lq) ||
    u.email.toLowerCase().includes(lq)
  );
}


/* ── Org Tree ─────────────────────────────────────────────────────── */
const ORG_TYPE_COLOR: Record<OrgUnitType, string> = {
  mainOrg: 'bg-blue-050',
  subOrg:  'bg-green-040',
  team:    'bg-blue-050',
  squad:   'bg-gray-030',
};

// 드래그 타겟으로 허용되는 부모 타입
// R5-a: squad → squad 자기재귀로 깊이 무제한
const ALLOWED_CHILD: Partial<Record<OrgUnitType, OrgUnitType>> = {
  mainOrg: 'subOrg', subOrg: 'team', team: 'squad', squad: 'squad',
};

interface DnDState {
  draggingId: string | null;
  dropTarget: { id: string; pos: 'above' | 'below' | 'into' } | null;
}

interface DnDCallbacks {
  state: DnDState;
  onDragStart: (id: string) => void;
  onDragEnd:   () => void;
  onDragOver:  (id: string, pos: 'above' | 'below' | 'into') => void;
  onDrop:      (targetId: string) => void;
}

function OrgTreeNode({
  unit, allUnits, selectedId, onSelect,
  onEditUnit, onDeleteUnit, onAddChild, onAddMember,
  depth, dnd, canEdit = false,
}: {
  unit: OrgUnit;
  allUnits: OrgUnit[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEditUnit: (unit: OrgUnit) => void;
  onDeleteUnit: (unit: OrgUnit) => void;
  onAddChild: (type: OrgUnitType, parentId: string) => void;
  onAddMember: (unitId: string) => void;
  depth: number;
  dnd: DnDCallbacks;
  canEdit?: boolean;
}) {
  const { users, secondaryOrgs } = useTeamStore();
  const [expanded, setExpanded] = useState(depth === 0);
  const [hovered, setHovered] = useState(false);

  const children = allUnits
    .filter(u => u.parentId === unit.id)
    .sort((a, b) => a.order - b.order);
  const hasChildren = children.length > 0;

  const memberCount = useMemo(() => {
    // R1+R5-a: orgUnitId 트리 기반 룩업 우선, legacy 4단계 텍스트 매칭 fallback
    const treeMembers = new Set(
      getMembersInOrgTree(unit.id, users, allUnits)
        .filter(isUserActive)
        .map(u => u.id)
    );
    // legacy: 텍스트 필드 매칭 (마이그 전 데이터 호환)
    const key: Record<OrgUnitType, keyof User> = {
      mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
    };
    const legacyIds = users
      .filter(u => u[key[unit.type]] === unit.name && isUserActive(u))
      .map(u => u.id);
    legacyIds.forEach(id => treeMembers.add(id));
    const secondaryExtra = secondaryOrgs.filter(a => a.orgId === unit.id && !treeMembers.has(a.userId)).length;
    return treeMembers.size + secondaryExtra;
  }, [users, unit, allUnits, secondaryOrgs]);

  const nextType = ORG_TYPE_NEXT[unit.type];
  // R7: depth+1 이 5단계(=MAX_ORG_DEPTH=4)를 초과하면 자식 추가 버튼 비활성화
  const canAddChild = depth < MAX_ORG_DEPTH;
  const childAddLabel = canAddChild ? `${getOrgLevelLabel(depth + 1)} 추가` : '';
  const isSelected = selectedId === unit.id;
  const isDragging = dnd.state.draggingId === unit.id;
  const dropPos = dnd.state.dropTarget?.id === unit.id ? dnd.state.dropTarget.pos : null;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dnd.state.draggingId || dnd.state.draggingId === unit.id) return;

    const dragged = allUnits.find(u => u.id === dnd.state.draggingId);
    if (!dragged) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;

    let pos: 'above' | 'below' | 'into';
    if (dragged.type === unit.type) {
      // 같은 레벨: 위 25% → above, 아래 25% → below, 중간 → into(하위 이동)
      const canHaveChild = ALLOWED_CHILD[unit.type] !== undefined;
      if (canHaveChild && ratio >= 0.25 && ratio <= 0.75) pos = 'into';
      else pos = ratio < 0.5 ? 'above' : 'below';
    } else if (ALLOWED_CHILD[unit.type] === dragged.type) {
      pos = 'into';
    } else {
      return;
    }
    dnd.onDragOver(unit.id, pos);
  };

  return (
    <div className={isDragging ? 'opacity-40' : ''}>
      {dropPos === 'above' && (
        <div className="h-0.5 bg-pink-040 rounded-full mx-2 my-px pointer-events-none" />
      )}

      <div
        draggable={canEdit}
        onDragStart={canEdit ? e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; dnd.onDragStart(unit.id); } : undefined}
        onDragOver={canEdit ? handleDragOver : undefined}
        onDragLeave={canEdit ? e => {
          const rel = e.relatedTarget as Node | null;
          if (!e.currentTarget.contains(rel)) { /* no-op — parent handles clear */ }
        } : undefined}
        onDrop={canEdit ? e => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(unit.id); } : undefined}
        onDragEnd={canEdit ? () => dnd.onDragEnd() : undefined}
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors ${
          dropPos === 'into'
            ? 'ring-2 ring-pink-040 bg-pink-005'
            : isSelected
              ? 'bg-pink-005 text-pink-060'
              : 'hover:bg-gray-005 text-gray-070'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(unit.id)}
      >
        {/* Drag handle */}
        {canEdit && (
          <span
            className={`flex-shrink-0 text-gray-040 cursor-grab active:cursor-grabbing transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}
            title="드래그로 순서·위치 변경"
          >
            <MsGrabIcon size={12} />
          </span>
        )}

        {/* expand toggle */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className={`size-4 flex items-center justify-center flex-shrink-0 rounded transition-colors ${hasChildren ? 'text-gray-040 hover:text-gray-070' : 'opacity-0 pointer-events-none'}`}
        >
          {expanded ? <MsChevronDownMonoIcon size={12} /> : <MsChevronRightMonoIcon size={12} />}
        </button>

        {/* type dot */}
        <span className={`size-2 rounded-full flex-shrink-0 ${ORG_TYPE_COLOR[unit.type]}`} />

        {/* name */}
        <span className={`flex-1 text-sm truncate font-medium ${isSelected ? 'text-pink-060' : ''}`}>
          {unit.name}
        </span>

        {/* R5-a: depth hint (4단계 이상에서 표시) */}
        {depth >= 4 && (
          <span className="text-[10px] font-semibold text-gray-040 bg-gray-005 px-1.5 py-0.5 rounded-full flex-shrink-0" title={`트리 ${depth + 1}단계`}>
            Lv.{depth + 1}
          </span>
        )}

        {/* member count */}
        {memberCount > 0 && (
          <span className={`text-xs flex-shrink-0 ${isSelected ? 'text-pink-040' : 'text-gray-040'}`}>
            {memberCount}
          </span>
        )}

        {/* action buttons */}
        {canEdit && hovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button title="구성원 추가" onClick={() => onAddMember(unit.id)}
              className="p-1 rounded text-gray-040 hover:text-pink-050 hover:bg-pink-005 transition-colors">
              <MsFriendAddIcon size={12} />
            </button>
            {nextType && canAddChild && (
              <button title={childAddLabel}
                onClick={() => onAddChild(nextType, unit.id)}
                className="p-1 rounded text-gray-040 hover:text-green-060 hover:bg-green-005 transition-colors">
                <MsPlusIcon size={12} />
              </button>
            )}
            <button title="편집" onClick={() => onEditUnit(unit)}
              className="p-1 rounded text-gray-040 hover:text-gray-070 hover:bg-gray-010 transition-colors">
              <MsEditIcon size={12} />
            </button>
            <button title="삭제" onClick={() => onDeleteUnit(unit)}
              className="p-1 rounded text-gray-040 hover:text-red-040 hover:bg-red-005 transition-colors">
              <MsDeleteIcon size={12} />
            </button>
          </div>
        )}
      </div>

      {dropPos === 'below' && (
        <div className="h-0.5 bg-pink-040 rounded-full mx-2 my-px pointer-events-none" />
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {children.map(child => (
            <OrgTreeNode
              key={child.id}
              unit={child}
              allUnits={allUnits}
              selectedId={selectedId}
              onSelect={onSelect}
              onEditUnit={onEditUnit}
              onDeleteUnit={onDeleteUnit}
              onAddChild={onAddChild}
              onAddMember={onAddMember}
              depth={depth + 1}
              dnd={dnd}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Member Row ─────────────────────────────────────────────────────── */
function MemberRow({
  user, onEdit, onTerminate, onImpersonate, secondaryOrgs,
  selected = false, onToggle, selectionActive = false,
  secondaryAssignmentHere, isOrgHeadHere = false, isAnyOrgHead = false,
}: {
  user: User;
  onEdit: ((u: User) => void) | null;
  onTerminate?: (u: User) => void;
  onImpersonate?: (u: User) => void;
  secondaryOrgs: SecondaryOrgAssignment[];
  selected?: boolean;
  onToggle?: (id: string) => void;
  selectionActive?: boolean;
  secondaryAssignmentHere?: SecondaryOrgAssignment;
  isOrgHeadHere?: boolean;  // 현재 선택된 조직의 조직장
  isAnyOrgHead?: boolean;   // 어느 조직이든 조직장 여부
}) {
  const navigate = useNavigate();
  const mySecondary = secondaryOrgs.filter(a => a.userId === user.id);
  const canSelect = onToggle && user.role !== 'admin';
  const goToProfile = (e: React.MouseEvent) => { e.stopPropagation(); navigate(`/team/${user.id}`); };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors group border-b border-gray-005 last:border-0 ${
        selected ? 'bg-pink-005/60' : 'hover:bg-gray-005'
      } ${canSelect ? 'cursor-pointer' : ''}`}
      onClick={canSelect ? () => onToggle!(user.id) : undefined}
    >
      {/* 체크박스 */}
      {canSelect && (
        <div
          className={`flex items-center flex-shrink-0 transition-opacity ${selectionActive || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={e => e.stopPropagation()}
        >
          <MsCheckbox checked={selected} onChange={() => onToggle!(user.id)} />
        </div>
      )}

      <UserAvatar user={user} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={goToProfile}
            className="text-sm font-medium text-gray-099 hover:text-pink-050 hover:underline transition-colors"
          >
            {user.name}
          </button>
          {user.role === 'admin'
            ? <StatusBadge type="role" value="admin" />
            : (isOrgHeadHere || isAnyOrgHead)
              ? <StatusBadge type="role" value="leader" />
              : null}
          {secondaryAssignmentHere ? (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-010 text-purple-060 rounded border border-purple-010">
              겸임{secondaryAssignmentHere.role ? ` · ${secondaryAssignmentHere.role}` : ''}
            </span>
          ) : mySecondary.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-005 text-purple-050 rounded border border-purple-010">
              겸임 {mySecondary.length}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-040 mt-0.5 truncate">
          {secondaryAssignmentHere ? secondaryAssignmentHere.role ?? '' : user.position}
          {user.email && <span className="ml-2 text-gray-030">·</span>}
          {user.email && <span className="ml-1">{user.email}</span>}
        </p>
      </div>
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={goToProfile} title="프로필 보기"
          className="p-1.5 rounded-md text-gray-040 hover:text-blue-060 hover:bg-blue-005 transition-colors">
          <MsProfileIcon size={12} className="size-3.5" />
        </button>
        {onEdit && (
          <button onClick={() => onEdit(user)} title="정보 수정"
            className="p-1.5 rounded-md text-gray-040 hover:text-pink-050 hover:bg-pink-005 transition-colors">
            <MsEditIcon size={12} className="size-3.5" />
          </button>
        )}
        {onImpersonate && user.role !== 'admin' && isUserActive(user) && (
          <button onClick={() => onImpersonate(user)} title="마스터 로그인 (조회 전용)"
            className="p-1.5 rounded-md text-gray-040 hover:text-orange-070 hover:bg-orange-005 transition-colors">
            <MsLogoutIcon size={12} className="size-3.5" />
          </button>
        )}
        {onTerminate && user.role !== 'admin' && (
          <button onClick={() => onTerminate(user)} title="퇴사 처리"
            className="p-1.5 rounded-md text-gray-040 hover:text-red-040 hover:bg-red-005 transition-colors">
            <MsCancelIcon size={12} className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Admin View ─────────────────────────────────────────────────────── */
function AdminView({ canEdit = false }: { canEdit?: boolean }) {
  const { users, orgUnits, teams, deleteOrgUnit, updateOrgUnit, updateMember, isLoading, terminateMember } = useTeamStore();
  const { orgSyncEnabled, orgLastSyncedAt, orgSyncError } = useSheetsSyncStore();
  const { can } = usePermission();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore(s => s.startImpersonation);
  const showToast = useShowToast();

  const [selectedOrgId, setSelectedOrgId]       = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned]      = useState(false);
  const [search, setSearch]                      = useState('');
  const [showTerminated, setShowTerminated]       = useState(false);
  // R5-b: 마스터 로그인 시작 확인
  const [impersonateTarget, setImpersonateTarget] = useState<User | null>(null);

  // 조직 트리 빠른 추가 다이얼로그
  const [quickAddOrg, setQuickAddOrg] = useState<OrgUnit | null>(null);
  // 조직 추가·편집 다이얼로그
  const [orgDialog, setOrgDialog] = useState<OrgUnitDialogState>(null);

  /* ── 복수 선택 ──────────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ── Navigation helpers (모달 → 페이지 전환) ──────────────────── */
  const goAddMember = (unitId?: string, managerId?: string) => {
    const qs = new URLSearchParams();
    if (unitId) qs.set('orgId', unitId);
    if (managerId) qs.set('managerId', managerId);
    navigate(`/team/new${qs.toString() ? `?${qs}` : ''}`);
  };
  const goEditMember = (m: User) => navigate(`/team/${m.id}/edit`);
  const openAddOrg = (type: OrgUnitType, parentId?: string) => setOrgDialog({ mode: 'add', type, parentId });
  const openEditOrg = (unit: OrgUnit) => setOrgDialog({ mode: 'edit', unit });
  const goBulkMove = () => {
    const ids = [...selectedIds].join(',');
    navigate(`/team/bulk-move?ids=${ids}`);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAll = () => { setSelectedOrgId(null); setShowUnassigned(false); setShowTerminated(false); clearSelection(); };
  const selectUnassigned = () => { setSelectedOrgId(null); setShowUnassigned(true); setShowTerminated(false); clearSelection(); };
  const selectOrg = (id: string) => { setSelectedOrgId(id); setShowUnassigned(false); setShowTerminated(false); clearSelection(); };

  const headerActions = useMemo(() => canEdit ? (
    <MsButton
      onClick={() => {
        const unit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
        goAddMember(selectedOrgId ?? undefined, unit?.headId);
      }}
      leftIcon={<MsFriendAddIcon size={16} />}
    >
      구성원 추가
    </MsButton>
  ) : undefined, [canEdit, selectedOrgId, orgUnits]);
  const activeUserCount = users.filter(u => isUserActive(u)).length;
  useSetPageHeader('구성원', headerActions, {
    subtitle: `구성원 ${activeUserCount}명 · 조직 ${orgUnits.length}개`,
  });

  const toggleMember = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = (list: User[]) => {
    const selectable = list.filter(u => u.role !== 'admin').map(u => u.id);
    const allSelected = selectable.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      selectable.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  /* ── Drag-and-Drop ──────────────────────────────────────────────── */
  const [dndState, setDndState] = useState<DnDState>({ draggingId: null, dropTarget: null });

  const getDescendantIds = (id: string): string[] => {
    const children = orgUnits.filter(u => u.parentId === id).map(u => u.id);
    return [id, ...children.flatMap(getDescendantIds)];
  };

  // 조직 이동 시 소속 구성원 org 필드도 함께 업데이트
  type OrgChange = { id: string; parentId: string | undefined; type: OrgUnitType; order: number };

  const TYPE_FIELD_MAP: Record<OrgUnitType, keyof User> = {
    mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
  };
  const TYPE_DEPTH_MAP: Record<OrgUnitType, number> = {
    mainOrg: 0, subOrg: 1, team: 2, squad: 3,
  };

  const getOrgPath = (unitId: string, snap: OrgUnit[]) => {
    const path: OrgUnit[] = [];
    let cur: OrgUnit | undefined = snap.find(u => u.id === unitId);
    while (cur) {
      path.unshift(cur);
      const parentId = cur.parentId;
      cur = parentId ? snap.find(u => u.id === parentId) : undefined;
    }
    return {
      department: path.find(u => u.type === 'mainOrg')?.name,
      subOrg:     path.find(u => u.type === 'subOrg')?.name,
      team:       path.find(u => u.type === 'team')?.name,
      squad:      path.find(u => u.type === 'squad')?.name,
    };
  };

  // 조직 변경 목록을 받아 ① 소속 구성원 org 필드 업데이트 ② 조직 단위 업데이트
  const applyWithMemberSync = (orgChanges: OrgChange[]) => {
    // 변경 후 org 단위 스냅샷 (가상)
    const newSnap = orgUnits.map(u => {
      const c = orgChanges.find(ch => ch.id === u.id);
      return c ? { ...u, ...c } : u;
    });

    // 각 구성원이 변경된 조직 중 가장 하위 조직에 속하는지 확인 후 경로 재계산
    for (const user of users.filter(u => isUserActive(u) && u.role !== 'admin')) {
      let bestId: string | null = null;
      let bestDepth = -1;
      for (const c of orgChanges) {
        const oldUnit = orgUnits.find(u => u.id === c.id);
        if (!oldUnit) continue;
        const field = TYPE_FIELD_MAP[oldUnit.type];
        const depth = TYPE_DEPTH_MAP[oldUnit.type];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((user as any)[field] === oldUnit.name && depth > bestDepth) {
          bestDepth = depth;
          bestId = c.id;
        }
      }
      if (!bestId) continue;

      const p = getOrgPath(bestId, newSnap);
      updateMember(user.id, {
        department: p.department ?? user.department,
        subOrg:     p.subOrg,
        team:       p.team,
        squad:      p.squad,
      });
    }

    // 조직 단위 업데이트
    orgChanges.forEach(({ id, parentId, type, order }) =>
      updateOrgUnit(id, { parentId, type, order })
    );
  };

  // 드래그된 유닛의 모든 하위 유닛을 OrgChange 형태로 수집 (parent/type 변경 없음 — 경로 재계산용)
  const descendantChanges = (unitId: string): OrgChange[] =>
    getDescendantIds(unitId)
      .filter(id => id !== unitId)
      .map(id => {
        const u = orgUnits.find(u => u.id === id)!;
        return { id: u.id, parentId: u.parentId, type: u.type, order: u.order };
      });

  const handleDrop = (targetId: string) => {
    const { draggingId, dropTarget } = dndState;
    setDndState({ draggingId: null, dropTarget: null });
    if (!draggingId || draggingId === targetId || !dropTarget) return;

    const dragged = orgUnits.find(u => u.id === draggingId);
    const target  = orgUnits.find(u => u.id === targetId);
    if (!dragged || !target) return;

    const pos = dropTarget.pos;

    if (pos === 'into') {
      if (getDescendantIds(draggingId).includes(targetId)) return;
      // R7: 5단계 제한 — 자식 추가 불가하면 거부 + 토스트
      if (getOrgDepth(target, orgUnits) >= MAX_ORG_DEPTH) {
        showToast('warning', `최대 ${MAX_ORG_DEPTH + 1}단계까지만 만들 수 있습니다.`);
        return;
      }

      if (dragged.type === target.type) {
        // 같은 레벨 → 하위 이동 + 타입 재귀 조정 + 구성원 이동
        const newType = ALLOWED_CHILD[target.type];
        if (!newType) return;

        const computeOrgChanges = (
          unitId: string, newParentId: string | undefined, type: OrgUnitType, snap: OrgUnit[]
        ): OrgChange[] => {
          const siblings = snap.filter(u => u.parentId === newParentId && u.id !== unitId);
          const maxOrder = siblings.reduce((m, u) => Math.max(m, u.order), 0);
          const result: OrgChange[] = [{ id: unitId, parentId: newParentId, type, order: maxOrder + 1 }];
          const ct = ALLOWED_CHILD[type];
          if (!ct) return result;
          snap.filter(u => u.parentId === unitId).forEach(child =>
            result.push(...computeOrgChanges(child.id, unitId, ct, snap))
          );
          return result;
        };
        applyWithMemberSync(computeOrgChanges(draggingId, targetId, newType, orgUnits));

      } else {
        // 호환 부모 타입 → reparent (type 유지, parent 변경) + 구성원 이동
        const maxOrder = orgUnits.filter(u => u.parentId === targetId)
          .reduce((m, u) => Math.max(m, u.order), 0);
        applyWithMemberSync([
          { id: draggingId, parentId: targetId, type: dragged.type, order: maxOrder + 1 },
          ...descendantChanges(draggingId),
        ]);
      }

    } else {
      // 형제 재정렬 (above / below)
      if (dragged.type !== target.type) return;
      const newParentId = target.parentId;
      const siblings = orgUnits
        .filter(u => u.type === target.type && u.parentId === newParentId && u.id !== draggingId)
        .sort((a, b) => a.order - b.order);
      const ordered = [...siblings];
      ordered.splice(pos === 'above'
        ? siblings.findIndex(u => u.id === targetId)
        : siblings.findIndex(u => u.id === targetId) + 1,
        0, dragged);

      if (dragged.parentId !== newParentId) {
        // 크로스-parent 이동: 구성원 org 필드도 갱신
        const reorderChanges: OrgChange[] = ordered.map((u, i) => ({
          id: u.id, parentId: newParentId, type: u.type, order: i + 1,
        }));
        const desc = descendantChanges(draggingId).filter(d => !reorderChanges.some(r => r.id === d.id));
        applyWithMemberSync([...reorderChanges, ...desc]);
      } else {
        // 순수 순서 변경: 구성원 업데이트 불필요
        ordered.forEach((u, i) => updateOrgUnit(u.id, { order: i + 1, parentId: newParentId }));
      }
    }
  };

  const dnd: DnDCallbacks = {
    state: dndState,
    onDragStart: (id) => setDndState({ draggingId: id, dropTarget: null }),
    onDragEnd:   ()   => setDndState({ draggingId: null, dropTarget: null }),
    onDragOver:  (id, pos) => setDndState(s => ({ ...s, dropTarget: { id, pos } })),
    onDrop: handleDrop,
  };

  const activeUsers     = useMemo(() => users.filter(u => isUserActive(u)), [users]);
  const terminatedUsers = useMemo(() => users.filter(u => !isUserActive(u)), [users]);

  // R7: 관리자도 구성원에 포함. 사이클 참여 분류(isSystemOperator)는 별도 의미로 유지.
  const totalActive   = activeUsers.length;
  const headIdsAll    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const totalLeaders  = activeUsers.filter(u => headIdsAll.has(u.id)).length;

  /* 소속 없는 구성원: orgUnitId 도 없고, legacy 4단계 이름 어디에도 안 잡히는 활성 사용자.
     R7: orgUnitId 우선 + legacy 폴백 — 마이그레이션 전후 모두 정확히 분류. */
  const allOrgIds   = useMemo(() => new Set(orgUnits.map(u => u.id)), [orgUnits]);
  const allOrgNames = useMemo(() => new Set(orgUnits.map(u => u.name)), [orgUnits]);
  const isUserAssigned = (u: User) => {
    if (u.orgUnitId && allOrgIds.has(u.orgUnitId)) return true;
    // legacy 폴백: 4단계 이름 중 하나라도 등록된 OrgUnit 이름과 일치
    return [u.department, u.subOrg, u.team, u.squad].some(n => n && allOrgNames.has(n));
  };
  const unassignedUsers = useMemo(() =>
    activeUsers.filter(u => !isUserAssigned(u))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeUsers, allOrgIds, allOrgNames]
  );

  /* 선택된 조직의 구성원 */
  const { secondaryOrgs } = useTeamStore();
  const selectedUnit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
  const panelUsers = useMemo(() => {
    if (showTerminated) return terminatedUsers;
    if (showUnassigned) return unassignedUsers;
    if (!selectedUnit) return [...activeUsers].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    // R7: orgUnitId 트리 기반 우선 + legacy 4단계 이름 매칭 폴백.
    const treeIds = getMembersInOrgTree(selectedUnit.id, activeUsers, orgUnits).map(u => u.id);
    const legacyKey: Record<OrgUnitType, keyof User> = {
      mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
    };
    const legacyIds = activeUsers
      .filter(u => u[legacyKey[selectedUnit.type]] === selectedUnit.name)
      .map(u => u.id);
    const primaryIds = new Set([...treeIds, ...legacyIds]);
    // 겸임으로 이 조직에 소속된 구성원 추가
    const secondaryIds = new Set(
      secondaryOrgs.filter(a => a.orgId === selectedUnit.id).map(a => a.userId)
    );
    const members = activeUsers.filter(u => primaryIds.has(u.id) || secondaryIds.has(u.id));
    // 조직장 맨 위, 이후 가나다/abc 순
    return members.sort((a, b) => {
      if (a.id === selectedUnit.headId) return -1;
      if (b.id === selectedUnit.headId) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [selectedUnit, activeUsers, orgUnits, terminatedUsers, showTerminated, showUnassigned, unassignedUsers, secondaryOrgs]);

  const searchResults = useMemo(() =>
    search.trim()
      ? activeUsers.filter(u => matchesSearch(u, search))
      : [],
    [activeUsers, search]
  );

  // 현재 선택된 조직의 겸임 구성원 맵 (userId → assignment)
  const secondaryMapHere = useMemo(() => {
    if (!selectedUnit) return new Map<string, SecondaryOrgAssignment>();
    return new Map(
      secondaryOrgs.filter(a => a.orgId === selectedUnit.id).map(a => [a.userId, a])
    );
  }, [secondaryOrgs, selectedUnit]);

  const mainOrgs = useMemo(() =>
    orgUnits.filter(u => u.type === 'mainOrg').sort((a, b) => a.order - b.order),
    [orgUnits]
  );

  const handleDeleteUnit = (unit: OrgUnit) => {
    if (confirm(`'${unit.name}' 및 모든 하위 조직을 삭제할까요?`)) deleteOrgUnit(unit.id);
  };

  const handleTerminate = (user: User) => {
    if (confirm(`${user.name}님을 퇴사 처리하시겠습니까?`)) {
      terminateMember(user.id, new Date().toISOString().slice(0, 10));
    }
  };

  // R5-b: 마스터 로그인 시작
  const handleImpersonate = (user: User) => {
    setImpersonateTarget(user);
  };

  const confirmImpersonate = (reason?: string) => {
    if (!impersonateTarget) return;
    const log = startImpersonation(impersonateTarget, reason);
    if (!log) {
      showToast('error', '마스터 로그인을 시작할 수 없습니다.');
      setImpersonateTarget(null);
      return;
    }
    // 시트로 비동기 push (실패해도 세션 진행)
    impersonationLogWriter.start(log);
    showToast('success', `${impersonateTarget.name}(으)로 접속했습니다. 작성/수정은 차단됩니다.`);
    setImpersonateTarget(null);
    navigate('/'); // 대상자 대시보드로 이동
  };

  return (
    <div className="space-y-5">
      {/* R7: 신규 회원 승인 대기 배너 — org.manage 보유자에게만 노출, count > 0 일 때만 */}
      <PendingApprovalsBanner />

      {/* 동기화 상태 + 퇴사자 토글 */}
      <div className="flex items-center gap-2 flex-wrap">
        {orgSyncEnabled && (
          isLoading ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-010 text-xs text-gray-050">
              <MsRefreshIcon size={12} className="animate-spin" /> 동기화 중
            </span>
          ) : orgSyncError ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-005 text-xs text-red-040">
              시트 연결 오류
            </span>
          ) : orgLastSyncedAt ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-005 text-xs text-green-060">
              <MsRefreshIcon size={12} className="size-3" />
              {new Date(orgLastSyncedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 동기화됨
            </span>
          ) : null
        )}
        {terminatedUsers.length > 0 && (
          <button onClick={() => { setShowTerminated(v => !v); setSelectedOrgId(null); setShowUnassigned(false); clearSelection(); }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showTerminated
                ? 'bg-red-005 text-red-050 border-red-020'
                : 'bg-white text-gray-050 border-gray-020 hover:border-gray-030'
            }`}>
            <MsCancelIcon size={12} className="size-3.5" /> 퇴사자 {terminatedUsers.length}명
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: MsGroupIcon, label: '전체 구성원', value: `${totalActive}명`,  sub: '재직 중' },
          { icon: MsGroupIcon, label: '조직',        value: `${teams.length}개`,   sub: '등록된 조직' },
          { icon: MsProfileIcon, label: '조직장',         value: `${totalLeaders}명`,   sub: '조직장' },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-020 shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-7 rounded-lg bg-gray-010 flex items-center justify-center">
                <Icon className="size-3.5 text-gray-050" />
              </div>
              <span className="text-xs text-gray-050">{label}</span>
            </div>
            <p className="text-2xl font-semibold text-gray-099">{value}</p>
            <p className="text-xs text-gray-040 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <MsInput
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); clearSelection(); }}
        placeholder="이름, 직책, 팀으로 검색..."
        leftSlot={<MsSearchIcon size={16} />}
        rightSlot={search ? (
          <button onClick={() => setSearch('')} className="text-gray-040 hover:text-gray-060">
            <MsCancelIcon size={16} />
          </button>
        ) : undefined}
        className="rounded-xl"
      />

      {search ? (
        /* ── 검색 결과 ── */
        <div className="bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-010">
            <p className="text-xs text-gray-050">
              <span className="font-medium text-gray-080">'{search}'</span> 검색 결과 {searchResults.length}명
            </p>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-sm text-gray-040 text-center py-12">검색 결과가 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-005">
              {searchResults.map(u => (
                <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                  onEdit={canEdit ? goEditMember : null}
                  onTerminate={canEdit ? handleTerminate : undefined}
                  onImpersonate={can.impersonate ? handleImpersonate : undefined}
                  isAnyOrgHead={headIdsAll.has(u.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── 조직 트리 + 구성원 패널 ── */
        <div className="flex gap-0 bg-white rounded-xl border border-gray-020 shadow-card overflow-hidden"
          style={{ minHeight: '480px' }}>

          {/* Left: Org tree */}
          <div className="w-64 flex-shrink-0 border-r border-gray-010 flex flex-col">
            <div className="flex items-center justify-between px-3 py-3 border-b border-gray-010">
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 text-gray-040" />
                <span className="text-xs font-semibold text-gray-060">조직 구조</span>
              </div>
              {canEdit && (
                <button onClick={() => openAddOrg('mainOrg')}
                  title="주조직 추가"
                  className="p-1 rounded text-gray-040 hover:text-green-060 hover:bg-green-005 transition-colors">
                  <MsPlusIcon size={12} className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {/* 전체 보기 */}
              <button
                onClick={selectAll}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  !selectedOrgId && !showTerminated && !showUnassigned ? 'bg-pink-005 text-pink-060 font-medium' : 'text-gray-060 hover:bg-gray-005'
                }`}
              >
                <MsGroupIcon size={14} className="flex-shrink-0" />
                <span className="flex-1 text-left">전체 구성원</span>
                <span className="text-xs text-gray-040">{totalActive}</span>
              </button>

              {/* 소속 없음 */}
              {unassignedUsers.length > 0 && (
                <button
                  onClick={selectUnassigned}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    showUnassigned ? 'bg-pink-005 text-pink-060 font-medium' : 'text-gray-060 hover:bg-gray-005'
                  }`}
                >
                  <MsWarningIcon size={14} className="flex-shrink-0 text-yellow-050" />
                  <span className="flex-1 text-left">소속 없음</span>
                  <span className="text-xs text-yellow-050 font-semibold">{unassignedUsers.length}</span>
                </button>
              )}

              {orgUnits.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-gray-040 mb-2">조직 구조가 없습니다.</p>
                  {canEdit && (
                    <button onClick={() => openAddOrg('mainOrg')}
                      className="text-xs text-pink-050 hover:text-pink-060 font-medium">
                      + 주조직 추가
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1">
                  {mainOrgs.map(unit => (
                    <OrgTreeNode
                      key={unit.id}
                      unit={unit}
                      allUnits={orgUnits}
                      selectedId={selectedOrgId}
                      onSelect={selectOrg}
                      onEditUnit={openEditOrg}
                      onDeleteUnit={handleDeleteUnit}
                      onAddChild={openAddOrg}
                      onAddMember={unitId => {
                        const unit = orgUnits.find(u => u.id === unitId);
                        if (unit) setQuickAddOrg(unit);
                      }}
                      depth={0}
                      dnd={dnd}
                      canEdit={canEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Member panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-010">
              <div>
                {showTerminated ? (
                  <p className="text-sm font-semibold text-gray-080">퇴사자 목록</p>
                ) : showUnassigned ? (
                  <p className="text-sm font-semibold text-gray-080">소속 없음</p>
                ) : selectedUnit ? (
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${ORG_TYPE_COLOR[selectedUnit.type]}`} />
                    <p className="text-sm font-semibold text-gray-080">{selectedUnit.name}</p>
                    <span className="text-xs text-gray-040">{getOrgLevelLabel(getOrgDepth(selectedUnit, orgUnits))}</span>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-080">전체 구성원</p>
                )}
                <p className="text-xs text-gray-040 mt-0.5">{panelUsers.length}명</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !showTerminated && panelUsers.filter(u => u.role !== 'admin').length > 0 && (
                  <MsCheckbox
                    title="전체 선택"
                    checked={panelUsers.filter(u => u.role !== 'admin').every(u => selectedIds.has(u.id))}
                    indeterminate={panelUsers.filter(u => u.role !== 'admin').some(u => selectedIds.has(u.id)) && !panelUsers.filter(u => u.role !== 'admin').every(u => selectedIds.has(u.id))}
                    onChange={() => toggleSelectAll(panelUsers)}
                  />
                )}
                {canEdit && !showTerminated && (
                  <MsButton
                    onClick={() => {
                      const unit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
                      goAddMember(selectedOrgId ?? undefined, unit?.headId);
                    }}
                    size="sm"
                    leftIcon={<MsFriendAddIcon size={12} />}
                  >
                    구성원 추가
                  </MsButton>
                )}
              </div>
            </div>

            {/* Member list */}
            {isLoading && panelUsers.length === 0 ? (
              <div className="flex-1 space-y-0 animate-pulse p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="size-8 rounded-full bg-gray-020 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-020 rounded w-24" />
                      <div className="h-2.5 bg-gray-010 rounded w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : panelUsers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-12">
                <Users className="size-8 text-gray-020" />
                <p className="text-sm text-gray-040">
                  {selectedUnit ? `${selectedUnit.name}에 구성원이 없습니다.` : '구성원이 없습니다.'}
                </p>
                {canEdit && !showTerminated && (
                  <button
                    onClick={() => goAddMember(selectedOrgId ?? undefined)}
                    className="text-xs font-medium text-pink-050 hover:text-pink-060">
                    + 구성원 추가
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {panelUsers.map(u => (
                  <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                    onEdit={canEdit ? goEditMember : null}
                    onTerminate={canEdit && !showTerminated ? handleTerminate : undefined}
                    onImpersonate={can.impersonate && !showTerminated ? handleImpersonate : undefined}
                    selected={selectedIds.has(u.id)}
                    onToggle={canEdit && !showTerminated ? toggleMember : undefined}
                    selectionActive={selectedIds.size > 0}
                    secondaryAssignmentHere={secondaryMapHere.get(u.id)}
                    isOrgHeadHere={!secondaryMapHere.has(u.id) && selectedUnit?.headId === u.id}
                    isAnyOrgHead={headIdsAll.has(u.id)} />
                ))}
              </div>
            )}
            {canEdit && selectedIds.size > 0 && !showTerminated && (
              <div className="border-t border-gray-010 px-4 py-3 bg-blue-005 flex items-center justify-between flex-shrink-0">
                <span className="text-sm font-medium text-blue-070">{selectedIds.size}명 선택됨</span>
                <div className="flex items-center gap-2">
                  <MsButton variant="ghost" size="sm" onClick={clearSelection}>선택 해제</MsButton>
                  <MsButton
                    size="sm"
                    leftIcon={<MsChevronRightLineIcon size={12} />}
                    onClick={goBulkMove}
                    className="bg-blue-060 text-white hover:bg-blue-070"
                  >
                    조직 이동
                  </MsButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 조직 트리 빠른 구성원 추가 */}
      <QuickAddMemberDialog
        open={quickAddOrg !== null}
        onClose={() => setQuickAddOrg(null)}
        orgUnit={quickAddOrg}
      />

      {/* 조직 추가·편집 */}
      <OrgUnitDialog
        state={orgDialog}
        onClose={() => setOrgDialog(null)}
      />

      {/* R5-b: 마스터 로그인 시작 확인 */}
      <ConfirmDialog
        open={impersonateTarget !== null}
        onClose={() => setImpersonateTarget(null)}
        onConfirm={(reason) => confirmImpersonate(reason)}
        title="마스터 로그인 시작"
        description={impersonateTarget ? (
          <>
            <strong>{impersonateTarget.name}</strong>({impersonateTarget.email})으로 접속합니다.
            <br />
            화면 조회만 가능하며 작성·수정·제출은 차단됩니다.
            <br />
            모든 동작은 감사 로그에 기록됩니다.
          </>
        ) : null}
        confirmLabel="접속"
        tone="danger"
      />
    </div>
  );
}

/* ── Entry Point ────────────────────────────────────────────────────── */
export function Team() {
  const { isAdmin } = usePermission();
  return <AdminView canEdit={isAdmin} />;
}

/* ── R7: 신규 회원 승인 대기 배너 ───────────────────────────────────── */
function PendingApprovalsBanner() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const count = usePendingApprovalsStore(s => s.count);
  if (!can.manageOrg || count <= 0) return null;
  return (
    <button
      onClick={() => navigate('/team/pending-approvals')}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-005 border border-yellow-060/20 hover:bg-yellow-060/10 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-yellow-060/15 flex items-center justify-center flex-shrink-0">
          <MsFriendAddIcon size={16} className="text-yellow-060" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-099">신규 회원 {count}명 승인 대기</p>
          <p className="text-xs text-gray-050 mt-0.5">관리자가 승인해야 시스템을 사용할 수 있습니다.</p>
        </div>
      </div>
      <MsChevronRightLineIcon size={14} className="text-gray-040" />
    </button>
  );
}
