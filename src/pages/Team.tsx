import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { useTeamStore } from '../stores/teamStore';
import { useShowToast } from '../components/ui/Toast';
import { usePendingApprovalsStore } from '../stores/pendingApprovalsStore';
import { isUserActive, getMembersInOrgTree } from '../utils/userCompat';
import {
  ORG_TYPE_NEXT,
  MAX_ORG_DEPTH, getOrgDepth, getOrgLevelLabel,
} from '../utils/teamUtils';
import { UserAvatar } from '../components/ui/UserAvatar';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Users, ArrowUpDown } from 'lucide-react';
import {
  MsPlusIcon, MsCancelIcon, MsEditIcon, MsSearchIcon,
  MsChevronRightMonoIcon, MsChevronDownMonoIcon, MsDeleteIcon,
  MsFriendAddIcon, MsGrabIcon, MsProfileIcon, MsChevronRightLineIcon, MsWarningIcon,
  MsLogoutIcon,
} from '../components/ui/MsIcons';
import type { User, OrgUnit, OrgUnitType, SecondaryOrgAssignment } from '../types';
import { MsButton } from '../components/ui/MsButton';
import { MsCheckbox, MsInput } from '../components/ui/MsControl';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { QuickAddMemberDialog } from '../components/team/QuickAddMemberDialog';
import { OrgUnitDialog, type OrgUnitDialogState } from '../components/team/OrgUnitDialog';
import { MemberAddDialog } from '../components/team/MemberAddDialog';
import { MemberEditDialog } from '../components/team/MemberEditDialog';
import { MemberProfileDrawer } from '../components/team/MemberProfileDrawer';
import { impersonationLogWriter } from '../utils/sheetWriter';
import { HeaderTab } from '../components/layout/HeaderTab';

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
  // Phase D-3.E-fix: 외부로 나갈 때 dropTarget clear (sticky indicator 방지)
  onDragLeave: (id: string) => void;
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
        <div className="h-0.5 bg-fg-brand1 rounded-full mx-2 my-px pointer-events-none" />
      )}

      {/* Phase D-2.4c: Figma `Parts/Tree` 정합
          - h-7 (28px) 컴팩트
          - 들여쓰기: depth * 20px (Figma pl-20 / pl-40 / pl-60 / pl-80 / pl-100)
          - 활성 = bg-interaction-hovered (분홍 카드 X)
          - 색 dot 제거 (Figma 정합)
          - 라벨: depth 0 = Bold, depth >= 1 = SemiBold (Figma)
          - 라벨 색: 모두 fg-default
          - 카운트: text-xs fg-subtlest */}
      <div
        draggable={canEdit}
        onDragStart={canEdit ? e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; dnd.onDragStart(unit.id); } : undefined}
        onDragOver={canEdit ? handleDragOver : undefined}
        onDragLeave={canEdit ? e => {
          const rel = e.relatedTarget as Node | null;
          // Phase D-3.E-fix: 마우스가 element 외부로 나가면 dropTarget clear
          if (!e.currentTarget.contains(rel)) {
            dnd.onDragLeave(unit.id);
          }
        } : undefined}
        onDrop={canEdit ? e => { e.preventDefault(); e.stopPropagation(); dnd.onDrop(unit.id); } : undefined}
        onDragEnd={canEdit ? () => dnd.onDragEnd() : undefined}
        className={`group flex items-center gap-1 h-7 pr-2 rounded-md cursor-pointer select-none transition-colors ${
          dropPos === 'into'
            ? 'ring-2 ring-fg-brand1 bg-bg-token-brand1-subtlest'
            : isSelected
              ? 'bg-interaction-hovered'
              : 'hover:bg-interaction-hovered'
        }`}
        style={{ paddingLeft: `${depth * 20}px` }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(unit.id)}
      >
        {/* Drag handle (canEdit + hover 시) */}
        {canEdit && (
          <span
            className={`flex-shrink-0 text-fg-subtlest cursor-grab active:cursor-grabbing transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}
            title="드래그로 순서·위치 변경"
          >
            <MsGrabIcon size={12} />
          </span>
        )}

        {/* expand toggle (chevron 16px, Figma 정합) */}
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className={`size-4 flex items-center justify-center flex-shrink-0 rounded transition-colors ${hasChildren ? 'text-fg-subtle hover:text-fg-default' : 'opacity-0 pointer-events-none'}`}
        >
          {expanded ? <MsChevronDownMonoIcon size={16} /> : <MsChevronRightMonoIcon size={16} />}
        </button>

        {/* name — depth 0 Bold, depth >= 1 SemiBold (Figma 정합) */}
        <span className={`flex-1 text-sm tracking-[-0.3px] leading-5 truncate text-fg-default ${depth === 0 ? 'font-bold' : 'font-semibold'}`}>
          {unit.name}
        </span>

        {/* R5-a: depth hint (4단계 이상에서 표시) */}
        {depth >= 4 && (
          <span className="text-[10px] font-semibold text-fg-subtlest bg-bg-token-subtle px-1.5 py-0.5 rounded-full flex-shrink-0" title={`트리 ${depth + 1}단계`}>
            Lv.{depth + 1}
          </span>
        )}

        {/* member count */}
        {memberCount > 0 && (
          <span className="text-xs text-fg-subtlest flex-shrink-0 tracking-[-0.3px] leading-4">
            {memberCount}
          </span>
        )}

        {/* action buttons (hover 시 보임, 14px icon) */}
        {canEdit && hovered && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button title="구성원 추가" onClick={() => onAddMember(unit.id)}
              className="p-1 rounded text-fg-subtlest hover:text-fg-brand1 hover:bg-bg-token-brand1-subtlest transition-colors">
              <MsFriendAddIcon size={14} />
            </button>
            {nextType && canAddChild && (
              <button title={childAddLabel}
                onClick={() => onAddChild(nextType, unit.id)}
                className="p-1 rounded text-fg-subtlest hover:text-fg-default hover:bg-interaction-hovered transition-colors">
                <MsPlusIcon size={14} />
              </button>
            )}
            <button title="편집" onClick={() => onEditUnit(unit)}
              className="p-1 rounded text-fg-subtlest hover:text-fg-default hover:bg-interaction-hovered transition-colors">
              <MsEditIcon size={14} />
            </button>
            <button title="삭제" onClick={() => onDeleteUnit(unit)}
              className="p-1 rounded text-fg-subtlest hover:text-red-050 hover:bg-red-005 transition-colors">
              <MsDeleteIcon size={14} />
            </button>
          </div>
        )}
      </div>

      {dropPos === 'below' && (
        <div className="h-0.5 bg-fg-brand1 rounded-full mx-2 my-px pointer-events-none" />
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div className="flex flex-col gap-1 mt-1">
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
/**
 * Phase D-2.4b: 시트형 MemberRow (Figma `Parts/List` 정합).
 *  - 카드 컨테이너 / 행간 border 제거 — 평면 시트 위에 hover 효과만
 *  - Avatar 40px (size-10), name 16 SemiBold, sub 14 Regular subtle
 *  - sub 텍스트: `{직무 또는 겸임role} · {마지막 하위조직}` (Figma 정합)
 *  - 색상 raw → semantic 토큰 (fg-default/subtle, brand1, interaction)
 */
function MemberRow({
  user, onView, onEdit, onTerminate, onImpersonate, secondaryOrgs,
  selected = false, onToggle, selectionActive = false,
  secondaryAssignmentHere, isOrgHeadHere = false, isAnyOrgHead = false,
}: {
  user: User;
  onView: (u: User) => void;
  onEdit: ((u: User) => void) | null;
  onTerminate?: (u: User) => void;
  onImpersonate?: (u: User) => void;
  secondaryOrgs: SecondaryOrgAssignment[];
  selected?: boolean;
  onToggle?: (id: string) => void;
  selectionActive?: boolean;
  secondaryAssignmentHere?: SecondaryOrgAssignment;
  isOrgHeadHere?: boolean;
  isAnyOrgHead?: boolean;
}) {
  const mySecondary = secondaryOrgs.filter(a => a.userId === user.id);
  // 사용자 결정: admin 도 일반 구성원으로서 일괄 선택·일괄 작업 대상.
  // 권한 자체는 권한그룹/role 으로 별도 관리되며, 체크박스/조직 변경/프로필 수정에는 영향 없음.
  const canSelect = !!onToggle;
  const goToProfile = (e: React.MouseEvent) => { e.stopPropagation(); onView(user); };

  // sub 텍스트: 직무/겸임role + 마지막 하위 조직 (Figma `{직무}•{마지막 하위조직}`)
  const roleText = secondaryAssignmentHere?.role || user.position || '';
  const lastOrg = user.squad || user.team || user.subOrg || user.department || '';
  const subText = [roleText, lastOrg].filter(Boolean).join(' · ');

  return (
    <div
      className={`flex items-center gap-3 min-h-[52px] px-2 py-1.5 rounded-lg group transition-colors ${
        selected ? 'bg-bg-token-brand1-subtlest' : 'hover:bg-interaction-hovered'
      } ${canSelect ? 'cursor-pointer' : ''}`}
      onClick={canSelect ? () => onToggle!(user.id) : undefined}
    >
      {/* 체크박스 (선택 모드 시 보임) */}
      {canSelect && (
        <div
          className={`flex items-center flex-shrink-0 transition-opacity ${selectionActive || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          onClick={e => e.stopPropagation()}
        >
          <MsCheckbox checked={selected} onChange={() => onToggle!(user.id)} />
        </div>
      )}

      {/* Avatar 40px (LeftItem) */}
      <UserAvatar user={user} className="size-10 rounded-full" />

      {/* Contents — name 16 SemiBold + sub 14 Regular subtle */}
      <div className="flex flex-col flex-1 min-w-0 justify-center gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={goToProfile}
            className="text-base font-semibold text-fg-default hover:text-fg-brand1 transition-colors tracking-[-0.3px] leading-6"
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
        {subText && (
          <p className="text-sm font-normal text-fg-subtle leading-5 tracking-[-0.3px] truncate">
            {subText}
          </p>
        )}
      </div>

      {/* Action buttons (hover 시 보임) */}
      <div
        className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={goToProfile} title="프로필 보기"
          className="p-1.5 rounded-md text-fg-subtlest hover:text-fg-default hover:bg-interaction-hovered transition-colors">
          <MsProfileIcon size={14} />
        </button>
        {onEdit && (
          <button onClick={() => onEdit(user)} title="정보 수정"
            className="p-1.5 rounded-md text-fg-subtlest hover:text-fg-brand1 hover:bg-bg-token-brand1-subtlest transition-colors">
            <MsEditIcon size={14} />
          </button>
        )}
        {onImpersonate && user.role !== 'admin' && isUserActive(user) && (
          <button onClick={() => onImpersonate(user)} title="마스터 로그인 (조회 전용)"
            className="p-1.5 rounded-md text-fg-subtlest hover:text-orange-070 hover:bg-orange-005 transition-colors">
            <MsLogoutIcon size={14} />
          </button>
        )}
        {onTerminate && user.role !== 'admin' && (
          <button onClick={() => onTerminate(user)} title="퇴사 처리"
            className="p-1.5 rounded-md text-fg-subtlest hover:text-red-050 hover:bg-red-005 transition-colors">
            <MsCancelIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Admin View ─────────────────────────────────────────────────────── */
function AdminView({ canEdit = false }: { canEdit?: boolean }) {
  const { users, orgUnits, deleteOrgUnit, isLoading, terminateMember, bulkUpdateOrgUnits, bulkUpdateMembers } = useTeamStore();
  // Phase D-2.4a: useSheetsSyncStore destructure 제거 — 동기화 배지를 헤더에서
  // 빼고 글로벌 SyncStatusBanner 가 처리 (사용자 결정 3.a)
  // Phase D-2.4a: terminatedUsers 정의를 위로 — headerTabActions useMemo 의
  // dependency 라 use-before-declaration 회피
  const activeUsers     = useMemo(() => users.filter(u => isUserActive(u)), [users]);
  const terminatedUsers = useMemo(() => users.filter(u => !isUserActive(u)), [users]);
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
  // 구성원 추가 팝업 (initial 조직/매니저 컨텍스트 포함)
  const [addDrawer, setAddDrawer] = useState<{ orgId?: string; managerId?: string } | null>(null);
  // 구성원 프로필 사이드바
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  // 구성원 정보 수정 팝업
  const [editUserId, setEditUserId] = useState<string | null>(null);

  /* ── deep-link 자동 진입 ──────────────────────────────────────────
   * /team?action=add → 추가 다이얼로그 자동 open
   * /team?member=:id → 프로필 드로어 자동 open
   * /team?member=:id&action=edit → 수정 다이얼로그 자동 open
   * 한 번 열고 query 정리 — 닫기 후 새로고침 시 다시 열리지 않도록.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const action = searchParams.get('action');
    const memberId = searchParams.get('member');
    if (!action && !memberId) return;
    if (action === 'add' && !memberId) {
      setAddDrawer({});
    } else if (memberId && action === 'edit') {
      setEditUserId(memberId);
    } else if (memberId) {
      setProfileUserId(memberId);
    }
    // query 제거 — 다이얼로그 상태가 진실의 출처가 됨
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    next.delete('member');
    setSearchParams(next, { replace: true });
    // searchParams 변경에 의한 무한 루프 방지 — 마운트 시 1회만 처리
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 복수 선택 ──────────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ── Navigation helpers ────────────────────────────────────────── */
  const goAddMember = (unitId?: string, managerId?: string) =>
    setAddDrawer({ orgId: unitId, managerId });
  const goViewMember = (m: User) => setProfileUserId(m.id);
  const goEditMember = (m: User) => setEditUserId(m.id);
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

  // Phase D-2.4a: PageHeader 슬롯 활용
  // - actions: 검색 input + "구성원 추가" 버튼 (사용자 결정 2.b)
  // - tabs: "전체" 헤더 탭 (Figma 정합)
  // - tabActions: 퇴사자 토글 (사용자 결정 4.a). 조직도/정렬/필터는 D-2.4c 에서
  // - subtitle 제거 (Stats 카드 삭제 결정 1 의 일관 처리, Figma 정합)
  const headerActions = useMemo(() => (
    <>
      {/* Phase D-2.4a-fix2: 검색 input + "구성원 추가" 버튼 모두 h-10 (40px) 정합
          MsButton size="lg" = h-10 (ui-tokens.md § 5), Figma "구성원 추가" h-40 와 동일 */}
      <MsInput
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); clearSelection(); }}
        placeholder="이름, 직책으로 검색"
        leftSlot={<MsSearchIcon size={14} />}
        rightSlot={search ? (
          <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-default" aria-label="검색 지우기">
            <MsCancelIcon size={14} />
          </button>
        ) : undefined}
        className="w-56 h-10"
      />
      {canEdit && (
        <MsButton
          size="lg"
          onClick={() => {
            const unit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
            goAddMember(selectedOrgId ?? undefined, unit?.headId);
          }}
          leftIcon={<MsFriendAddIcon size={16} />}
        >
          구성원 추가
        </MsButton>
      )}
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [canEdit, selectedOrgId, orgUnits, search]);

  const headerTabs = useMemo(() => (
    <HeaderTab active>전체</HeaderTab>
  ), []);

  const headerTabActions = useMemo(() => (
    <>
      {/* Phase D-2.4c: 정렬 버튼 (Figma 1143:13795 정합) — UI placeholder, 옵션 메뉴는 별도 phase */}
      <button
        onClick={() => showToast('info', '정렬 옵션은 준비 중입니다')}
        className="inline-flex items-center gap-0.5 h-6 min-w-6 px-2 text-xs font-bold rounded-md border border-bd-primary text-fg-default hover:bg-interaction-hovered transition-colors"
        title="정렬"
      >
        <ArrowUpDown size={14} /> 정렬
      </button>
      {terminatedUsers.length > 0 && (
        <button onClick={() => { setShowTerminated(v => !v); setSelectedOrgId(null); setShowUnassigned(false); clearSelection(); }}
          className={`inline-flex items-center gap-1 h-6 min-w-6 px-2 text-xs font-bold rounded-md border transition-colors ${
            showTerminated
              ? 'bg-interaction-pressed border-bd-primary text-fg-default'
              : 'border-bd-primary text-fg-default hover:bg-interaction-hovered'
          }`}>
          <MsCancelIcon size={14} /> 퇴사자 {terminatedUsers.length}명
        </button>
      )}
    </>
  ), [terminatedUsers.length, showTerminated, showToast]);

  useSetPageHeader('구성원', headerActions, {
    tabs: headerTabs,
    tabActions: headerTabActions,
  });

  const toggleMember = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = (list: User[]) => {
    const selectable = list.map(u => u.id);
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
  // R7: 모든 변경을 1회 setState + 1 batch HTTP 로 묶어 N개 PostMessage / 렌더 race 제거.
  const applyWithMemberSync = (orgChanges: OrgChange[]) => {
    // 변경 후 org 단위 스냅샷 (가상)
    const newSnap = orgUnits.map(u => {
      const c = orgChanges.find(ch => ch.id === u.id);
      return c ? { ...u, ...c } : u;
    });

    // 각 구성원이 변경된 조직 중 가장 하위 조직에 속하는지 확인 후 경로 재계산
    const memberPatches: { id: string; patch: Partial<Omit<User, 'id'>> }[] = [];
    for (const user of users.filter(u => isUserActive(u))) {
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
      memberPatches.push({
        id: user.id,
        patch: {
          department: p.department ?? user.department,
          subOrg:     p.subOrg,
          team:       p.team,
          squad:      p.squad,
        },
      });
    }
    bulkUpdateMembers(memberPatches);

    // 조직 단위 업데이트 — 1 batch
    bulkUpdateOrgUnits(orgChanges.map(c => ({
      id: c.id,
      patch: { parentId: c.parentId, type: c.type, order: c.order },
    })));
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
        // 순수 순서 변경: 구성원 업데이트 불필요 — 1 batch HTTP 로 적용.
        bulkUpdateOrgUnits(
          ordered.map((u, i) => ({ id: u.id, patch: { order: i + 1, parentId: newParentId } })),
        );
      }
    }
  };

  const dnd: DnDCallbacks = {
    state: dndState,
    onDragStart: (id) => setDndState({ draggingId: id, dropTarget: null }),
    onDragEnd:   ()   => setDndState({ draggingId: null, dropTarget: null }),
    // Phase D-3.E-fix: 같은 (id, pos) 면 state 변경 안 함 (불필요한 rerender 방지 → 깜빡임 제거)
    onDragOver:  (id, pos) => setDndState(s =>
      s.dropTarget?.id === id && s.dropTarget.pos === pos
        ? s
        : { ...s, dropTarget: { id, pos } }
    ),
    // Phase D-3.E-fix: 떠난 unit 의 dropTarget 만 clear (다른 unit 으로 이동 시 영향 X)
    onDragLeave: (id) => setDndState(s =>
      s.dropTarget?.id === id ? { ...s, dropTarget: null } : s
    ),
    onDrop: handleDrop,
  };

  // Phase D-2.4a: activeUsers / terminatedUsers 정의는 위로 이동됨 (use-before-declaration 회피).
  // R7: 관리자도 구성원에 포함. 사이클 참여 분류(isSystemOperator)는 별도 의미로 유지.
  // totalLeaders 는 Stats 카드 삭제로 unused — 제거.
  const totalActive   = activeUsers.length;
  const headIdsAll    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);

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
    showToast('success', `${impersonateTarget.name}(으)로 접속했습니다. 리뷰 작성은 빙의 대상 명의로 기록됩니다.`);
    setImpersonateTarget(null);
    navigate('/'); // 대상자 대시보드로 이동
  };

  return (
    /* Phase D-2.4c: full-bleed 페이지 — AppLayout main 의 overflow-hidden 위에서
       자체 height 관리. 좌·우 패널 각자 overflow-y-auto 로 개별 스크롤 (사용자 명시).
       AppLayout.tsx FULL_BLEED_EXACT 에 '/team' 추가됨. */
    <div className="flex flex-col h-full">
      {/* R7: 신규 회원 승인 대기 배너 — org.manage 보유자에게만 노출, count > 0 일 때만.
          내부에 padding wrapper 가 있어 자동으로 24px 위 padding 가짐. */}
      <PendingApprovalsBanner />

      {/* Phase D-2.4a: 동기화 상태 / 퇴사자 토글 / Stats grid / MsInput 검색바 모두 제거.
          - 동기화 배지: 글로벌 SyncStatusBanner 가 처리 (사용자 결정 3.a)
          - 퇴사자 토글: 헤더 tabActions 로 이동 (사용자 결정 4.a)
          - Stats: 사용자 결정 1 — Figma 정합으로 삭제
          - 검색 바: 헤더 actions 의 작은 검색으로 이동 (사용자 결정 2.b) */}

      {search ? (
        /* ── 검색 결과 — 시트형 (Phase D-2.4b) ── */
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          <p className="text-sm text-fg-subtle mb-3 px-2">
            <span className="font-semibold text-fg-default">'{search}'</span> 검색 결과 {searchResults.length}명
          </p>
          {searchResults.length === 0 ? (
            <p className="text-sm text-fg-subtle text-center py-12">검색 결과가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {searchResults.map(u => (
                <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                  onView={goViewMember}
                  onEdit={canEdit ? goEditMember : null}
                  onTerminate={canEdit ? handleTerminate : undefined}
                  onImpersonate={can.impersonate ? handleImpersonate : undefined}
                  isAnyOrgHead={headIdsAll.has(u.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── 좌: 멤버 (시트형) / 우: 조직도 (Figma 정합 + 개별 스크롤, Phase D-2.4c) ──
           카드 컨테이너 없음 — 페이지 배경 위 평면 시트
           좌우 패널 각자 overflow-y-auto — 사용자 명시 "개별 스크롤"
           우측 헤더: "조직도" + "전체(N)명" Figma 정합 + selectAll 트리거 */
        <div className="flex-1 min-h-0 flex">

          {/* Left: Member panel (시트형) — 자체 스크롤 */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-4">
            {/* 소속 없음 inline 토글 (Phase D-2.4b — 사용자 결정 5.a) */}
            {unassignedUsers.length > 0 && (
              <button
                onClick={selectUnassigned}
                className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  showUnassigned
                    ? 'bg-bg-token-brand1-subtlest border-bd-primary text-fg-brand1'
                    : 'bg-bg-token-default border-bd-primary text-fg-subtle hover:bg-interaction-hovered hover:text-fg-default'
                }`}
              >
                <MsWarningIcon size={16} className="text-yellow-050 flex-shrink-0" />
                <span className="flex-1 text-left tracking-[-0.3px]">소속 없음</span>
                <span className="text-xs font-bold text-yellow-050">{unassignedUsers.length}</span>
              </button>
            )}

            {/* Panel header (간소화 — 추가 버튼은 헤더로 옮겨짐) */}
            <div className="flex items-center justify-between mb-2 px-2">
              <div>
                {showTerminated ? (
                  <h2 className="text-base font-bold text-fg-default tracking-[-0.3px] leading-6">퇴사자 목록</h2>
                ) : showUnassigned ? (
                  <h2 className="text-base font-bold text-fg-default tracking-[-0.3px] leading-6">소속 없음</h2>
                ) : selectedUnit ? (
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${ORG_TYPE_COLOR[selectedUnit.type]}`} />
                    <h2 className="text-base font-bold text-fg-default tracking-[-0.3px] leading-6">{selectedUnit.name}</h2>
                    <span className="text-xs text-fg-subtlest">{getOrgLevelLabel(getOrgDepth(selectedUnit, orgUnits))}</span>
                  </div>
                ) : (
                  <h2 className="text-base font-bold text-fg-default tracking-[-0.3px] leading-6">전체 구성원</h2>
                )}
                <p className="text-sm text-fg-subtle mt-0.5">{panelUsers.length}명</p>
              </div>
              {canEdit && !showTerminated && panelUsers.length > 0 && (
                <MsCheckbox
                  title="전체 선택"
                  checked={panelUsers.every(u => selectedIds.has(u.id))}
                  indeterminate={panelUsers.some(u => selectedIds.has(u.id)) && !panelUsers.every(u => selectedIds.has(u.id))}
                  onChange={() => toggleSelectAll(panelUsers)}
                />
              )}
            </div>

            {/* Member list */}
            {isLoading && panelUsers.length === 0 ? (
              <div className="space-y-2 animate-pulse p-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="size-10 rounded-full bg-bg-token-subtle flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 bg-bg-token-subtle rounded w-24" />
                      <div className="h-3 bg-bg-token-subtle rounded w-40" />
                    </div>
                  </div>
                ))}
              </div>
            ) : panelUsers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center py-12">
                <Users className="size-8 text-fg-subtlest" />
                <p className="text-sm text-fg-subtle">
                  {selectedUnit ? `${selectedUnit.name}에 구성원이 없습니다.` : '구성원이 없습니다.'}
                </p>
                {canEdit && !showTerminated && (
                  <button
                    onClick={() => goAddMember(selectedOrgId ?? undefined)}
                    className="text-sm font-semibold text-fg-brand1 hover:text-fg-brand1-bolder transition-colors">
                    + 구성원 추가
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {panelUsers.map(u => (
                  <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                    onView={goViewMember}
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

            {/* 선택된 N명 액션 바 */}
            {canEdit && selectedIds.size > 0 && !showTerminated && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-bg-token-brand1-subtlest flex items-center justify-between">
                <span className="text-sm font-semibold text-fg-brand1">{selectedIds.size}명 선택됨</span>
                <div className="flex items-center gap-2">
                  <MsButton variant="ghost" size="sm" onClick={clearSelection}>선택 해제</MsButton>
                  <MsButton
                    size="sm"
                    leftIcon={<MsChevronRightLineIcon size={12} />}
                    onClick={goBulkMove}
                  >
                    조직 이동
                  </MsButton>
                </div>
              </div>
            )}
          </div>

          {/* Right: 조직도 패널 (Figma 1143:13876 정합, Phase D-2.4c) — 자체 스크롤 */}
          <div className="w-[366px] flex-shrink-0 border-l border-bd-default overflow-y-auto px-6 py-4 flex flex-col">
            {/* 헤더 — "조직도" 16 Bold + "전체(N)명" 14 subtle (Figma 정합 — selectAll 트리거) */}
            <div className="flex items-start justify-between mb-3 flex-shrink-0">
              <button
                onClick={selectAll}
                className="flex flex-col items-start gap-0.5 -mx-2 px-2 py-1 rounded-md hover:bg-interaction-hovered transition-colors text-left"
              >
                {/* 활성 표시는 분홍 bg 제거 (사용자 명시) — 텍스트 색만 brand1 으로 */}
                <p className={`text-base font-bold tracking-[-0.3px] leading-6 ${
                  !selectedOrgId && !showTerminated && !showUnassigned ? 'text-fg-brand1' : 'text-fg-default'
                }`}>조직도</p>
                <p className="text-sm text-fg-subtle tracking-[-0.3px] leading-5">
                  전체({totalActive})명
                </p>
              </button>
              {canEdit && (
                <button onClick={() => openAddOrg('mainOrg')}
                  title="주조직 추가"
                  className="p-1 rounded-md text-fg-subtle hover:text-fg-default hover:bg-interaction-hovered transition-colors flex-shrink-0 mt-1"
                >
                  <MsPlusIcon size={16} />
                </button>
              )}
            </div>

            {/* 트리 본문 */}
            <div className="flex-1">
              {orgUnits.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-fg-subtle mb-2">조직 구조가 없습니다.</p>
                  {canEdit && (
                    <button onClick={() => openAddOrg('mainOrg')}
                      className="text-xs text-fg-brand1 hover:text-fg-brand1-bolder font-semibold transition-colors">
                      + 주조직 추가
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
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
        </div>
      )}

      {/* 조직 트리 빠른 구성원 추가 */}
      <QuickAddMemberDialog
        open={quickAddOrg !== null}
        onClose={() => setQuickAddOrg(null)}
        orgUnit={quickAddOrg}
      />

      {/* 구성원 추가 (풀 폼 팝업) */}
      <MemberAddDialog
        context={addDrawer}
        onClose={() => setAddDrawer(null)}
      />

      {/* 구성원 프로필 (사이드바) */}
      <MemberProfileDrawer
        userId={profileUserId}
        onClose={() => setProfileUserId(null)}
        onEdit={(id) => { setProfileUserId(null); setEditUserId(id); }}
      />

      {/* 구성원 정보 수정 (팝업) */}
      <MemberEditDialog
        userId={editUserId}
        onClose={() => setEditUserId(null)}
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
            그 사용자로서 리뷰 작성·제출이 가능하며, 관리자 전용 라우트는 차단됩니다.
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

/* ── R7: 신규 회원 승인 대기 배너 ─────────────────────────────────────
   Phase D-2.4c: full-bleed 페이지 (/team) 안의 padding wrapper 자체 처리 */
function PendingApprovalsBanner() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const count = usePendingApprovalsStore(s => s.count);
  if (!can.manageOrg || count <= 0) return null;
  return (
    <div className="flex-shrink-0 px-6 pt-6">
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
    </div>
  );
}
