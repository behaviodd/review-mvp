import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { useTeamStore } from '../stores/teamStore';
import { useShowToast } from '../components/ui/Toast';
import { usePendingApprovalsStore } from '../stores/pendingApprovalsStore';
import { isUserActive, getMembersInOrgTree, userIsWorking, userIsOnLeave, userIsTerminated } from '../utils/userCompat';
import { orgNameEquals, orgNameKey } from '../utils/normalizeOrgName';
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
import { MsActionMenu } from '../components/ui/MsActionMenu';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { QuickAddMemberDialog } from '../components/team/QuickAddMemberDialog';
import { OrgUnitDialog, type OrgUnitDialogState } from '../components/team/OrgUnitDialog';
import { MemberAddDialog } from '../components/team/MemberAddDialog';
import { MemberEditDialog } from '../components/team/MemberEditDialog';
import { MemberProfileDrawer } from '../components/team/MemberProfileDrawer';
import { AutoAssignModal } from '../components/team/AutoAssignModal';
import { impersonationLogWriter } from '../utils/sheetWriter';
import { HeaderTab } from '../components/layout/HeaderTab';
import { refetchOrg } from '../utils/syncControl';
import { BulkManagerDialog } from '../components/team/BulkManagerDialog';
import { TeamViewToggle } from '../components/team/TeamViewToggle';

/* ── Helpers ────────────────────────────────────────────────────────── */
function matchesSearch(u: User, q: string) {
  // NFC 정규화 — 시트/IME 출처에 따라 한글이 NFD(자모 분해)로 들어와도 매칭되도록.
  const lq = q.normalize('NFC').toLowerCase();
  const has = (s?: string | null) => (s ?? '').normalize('NFC').toLowerCase().includes(lq);
  return (
    has(u.name) || has(u.position) || has(u.department) ||
    has(u.email) || has(u.jobFunction) || has(u.nameEn) ||
    has(u.subOrg) || has(u.team)
  );
}

/**
 * 구성원 검색 입력 — 한글 IME 조합(composition) 보호.
 *
 * 이 입력은 `useSetPageHeader`(context + useEffect)를 거쳐 렌더되므로, value 갱신이
 * 한 박자 늦게 돌아온다. 이 지연이 한글 IME 조합 버퍼를 끊어 자모가 분리되는 원인.
 * → 표시값은 자체 local state 로 동기 갱신하고, 조합 중에는 부모 필터(onChange)를
 *   건드리지 않다가 조합 종료 시 1회만 커밋한다. (영문/숫자는 composition 이벤트가
 *   없어 매 입력마다 즉시 커밋 — 기존 동작 유지)
 */
function MemberSearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const composing = useRef(false);

  // 외부에서 value 가 바뀐 경우(프로그램적 초기화 등)만 동기화. 조합 중에는 무시.
  useEffect(() => {
    if (!composing.current && value !== local) setLocal(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <MsInput
      type="text"
      value={local}
      onChange={e => {
        const v = e.target.value;
        setLocal(v);
        if (!composing.current) onChange(v);
      }}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => {
        composing.current = false;
        onChange(e.currentTarget.value);
      }}
      placeholder="이름·직책·이메일·조직 검색"
      leftSlot={<MsSearchIcon size={16} />}
      rightSlot={local ? (
        <button onClick={() => { setLocal(''); onChange(''); }} className="text-fg-subtle hover:text-fg-default" aria-label="검색 지우기">
          <MsCancelIcon size={14} />
        </button>
      ) : undefined}
      className="w-64 md:w-80 h-10"
    />
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

interface ForceExpandCmd { key: number; expand: boolean }

function OrgTreeNode({
  unit, allUnits, selectedId, onSelect,
  onEditUnit, onDeleteUnit, onAddChild, onAddMember,
  depth, dnd, canEdit = false, forceExpandCmd,
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
  /** 외부에서 일괄 펼치기/접기 시 새 key 로 교체 → useEffect 가 정확히 한 번 실행 */
  forceExpandCmd?: ForceExpandCmd;
}) {
  const { users, secondaryOrgs } = useTeamStore();
  const [expanded, setExpanded] = useState(depth === 0);

  // 외부 "모두 펼치기/접기" 신호 동기화 — key 변경 시에만 실행
  const prevKeyRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (forceExpandCmd && forceExpandCmd.key !== prevKeyRef.current) {
      prevKeyRef.current = forceExpandCmd.key;
      setExpanded(forceExpandCmd.expand);
    }
  }, [forceExpandCmd]);
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
      .filter(u => orgNameEquals(u[key[unit.type]] as string | undefined, unit.name) && isUserActive(u))
      .map(u => u.id);
    legacyIds.forEach(id => treeMembers.add(id));
    const secondaryExtra = secondaryOrgs.filter(a => a.orgId === unit.id && !treeMembers.has(a.userId)).length;
    return treeMembers.size + secondaryExtra;
  }, [users, unit, allUnits, secondaryOrgs]);

  // 보고대상 미지정 구성원 수 (보고대상 = 평가자)
  const noReviewerCount = useMemo(() => {
    const treeMembers = getMembersInOrgTree(unit.id, users, allUnits).filter(isUserActive);
    secondaryOrgs.filter(a => a.orgId === unit.id).forEach(a => {
      const u = users.find(u2 => u2.id === a.userId);
      if (u && isUserActive(u) && !treeMembers.some(m => m.id === u.id)) treeMembers.push(u);
    });
    return treeMembers.filter(u => !u.managerId && !u.noManagerByDesign).length;
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
        draggable={canEdit && !unit.isDerived}
        onDragStart={canEdit && !unit.isDerived ? e => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; dnd.onDragStart(unit.id); } : undefined}
        onDragOver={canEdit && !unit.isDerived ? handleDragOver : undefined}
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
        <span className={`flex-1 text-base tracking-[-0.3px] leading-5 truncate ${unit.isDerived ? 'text-fg-subtle' : 'text-fg-default'} ${depth === 0 ? 'font-bold' : 'font-semibold'}`}>
          {unit.name}
        </span>
        {/* 자동 파생 조직 배지 */}
        {unit.isDerived && (
          <span className="flex-shrink-0 text-[10px] font-semibold text-fg-subtlest bg-gray-010 px-1 py-0.5 rounded" title="_조직구조에 등록하면 정식 조직이 됩니다">
            자동
          </span>
        )}

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
        {/* 평가자 미배정 경고 배지 */}
        {noReviewerCount > 0 && !isSelected && (
          <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-010 text-orange-060 text-[10px] font-bold flex items-center justify-center leading-none"
            title={`보고대상 없음 ${noReviewerCount}명`}>
            {noReviewerCount}
          </span>
        )}

        {/* action buttons (hover 시 보임, 14px icon) */}
        {/* 자동 파생 조직은 편집/삭제 불가 — _조직구조에 등록해야 정식 조직이 됨 */}
        {canEdit && hovered && !unit.isDerived && (
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
              forceExpandCmd={forceExpandCmd}
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
  isOrgHeadHere = false,
  hasReviewer,
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
  isOrgHeadHere?: boolean;
  /** undefined = 표시 안 함, true = 배정됨, false = 미배정 */
  hasReviewer?: boolean;
}) {
  const mySecondary = secondaryOrgs.filter(a => a.userId === user.id);
  const canSelect = !!onToggle;
  const goToProfile = (e: React.MouseEvent) => { e.stopPropagation(); onView(user); };

  // Flex 패턴: 이름 아래 좌측에 "직책 · 직무" 1회만. 우측엔 소속 경로(조직)만 표시.
  // (직책/역할을 우측 orgTag 에도 넣으면 좌측 텍스트·조직장 배지와 중복되므로 제거)
  const positionLabel = user.position || '';
  const jobLabel = user.jobFunction || '';
  const subText = [positionLabel, jobLabel].filter(Boolean).join(' · ');
  const orgName = user.squad || user.team || user.subOrg || user.department || '';
  const orgTag = orgName;
  // 주조직 + 겸임 조직 전체를 dot(·) 으로 구분 (배지 미사용)
  const orgLabels = [orgTag, ...mySecondary.map(a => a.orgName ?? a.orgId)].filter(Boolean);
  const orgTitle = mySecondary.length > 0
    ? [orgTag, ...mySecondary.map(a => `${a.orgName ?? a.orgId}${a.role ? ` · ${a.role}` : ''} (겸임)`)].filter(Boolean).join(' / ')
    : undefined;

  return (
    <div
      className={`flex items-center gap-3 min-h-[60px] px-2 py-3 rounded-lg group transition-colors ${
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

      {/* 이름 + 배지 (좌측) */}
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
            : isOrgHeadHere
              ? <StatusBadge type="role" value="leader" />
              : null}
        </div>
        {subText && (
          <p className="text-sm font-normal text-fg-subtle leading-5 tracking-[-0.3px] truncate">
            {subText}
          </p>
        )}
      </div>

      {/* 소속 — 우측 정렬: 주조직 + 겸임 조직 전체를 dot(·) 으로 구분 */}
      {orgLabels.length > 0 && (
        <span
          title={orgTitle}
          className="text-sm text-fg-subtle truncate flex-shrink-0 hidden md:block max-w-[45%]"
        >
          {orgLabels.join(' · ')}
        </span>
      )}

      {/* 보고대상 없음 인디케이터 */}
      {hasReviewer === false && (
        <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-005 text-orange-060 border border-orange-020 whitespace-nowrap">
          보고대상 없음
        </span>
      )}

      {/* 행 액션 — hover 시 노출되는 더보기(more) 메뉴 */}
      <MsActionMenu
        className="flex-shrink-0"
        triggerVisibility="hover"
        items={[
          { label: '프로필 보기', icon: <MsProfileIcon size={12} />, onClick: () => onView(user) },
          { label: '정보 수정', icon: <MsEditIcon size={12} />, onClick: () => onEdit?.(user), hidden: !onEdit },
          { label: '마스터 로그인', icon: <MsLogoutIcon size={12} />, onClick: () => onImpersonate?.(user), hidden: !onImpersonate || user.role === 'admin' || !isUserActive(user) },
          { label: '퇴사 처리', icon: <MsCancelIcon size={12} />, onClick: () => onTerminate?.(user), variant: 'danger', hidden: !onTerminate || user.role === 'admin' },
        ]}
      />
    </div>
  );
}

/* ── Admin View ─────────────────────────────────────────────────────── */
function AdminView({ canEdit = false }: { canEdit?: boolean }) {
  const { users, orgUnits, deleteOrgUnit, isLoading, terminateMember, bulkUpdateOrgUnits, bulkUpdateMembers } = useTeamStore();
  // Phase D-2.4a: useSheetsSyncStore destructure 제거 — 동기화 배지를 헤더에서
  // 빼고 글로벌 SyncStatusBanner 가 처리 (사용자 결정 3.a)
  // activeUsers = isUserActive 통과(재직·단기휴직·기타). 소속없음/보고대상없음 산출 기준.
  // ⚠️ 상태 필터(재직/휴직/퇴사)는 activeUsers 가 아니라 userIsWorking/OnLeave/Terminated 사용.
  const activeUsers     = useMemo(() => users.filter(u => isUserActive(u)), [users]);
  const { can } = usePermission();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore(s => s.startImpersonation);
  const showToast = useShowToast();

  // Team 페이지 진입 시 org sync. force: false — 최근 쓰기 grace 를 존중해 optimistic 상태 보호.
  useEffect(() => { void refetchOrg({ force: false }); }, []);

  const [selectedOrgId, setSelectedOrgId]       = useState<string | null>(null);
  const [showUnassigned, setShowUnassigned]      = useState(false);
  const [search, setSearch]                      = useState('');
  const [statusFilter, setStatusFilter]          = useState<'all' | 'active' | 'leave' | 'terminated' | 'no_reviewer'>('all');
  // 퇴사/보고대상 없음 필터 기본 숨김 — '더보기' 토글로 펼침.
  const [showMoreFilters, setShowMoreFilters]    = useState(false);
  // 퇴사자 보기 = 퇴사 필터 선택 상태에서 파생 (별도 state 와의 desync 제거).
  // 편집/선택/추가 액션 숨김 등 UI affordance 분기에만 사용.
  const showTerminated = statusFilter === 'terminated';
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
  // 평가자 자동 지정 모달
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  // 보고대상 일괄 변경 모달
  const [bulkManagerOpen, setBulkManagerOpen] = useState(false);
  // 조직도 트리 펼치기/접기 — key 교체로 OrgTreeNode useEffect 를 정확히 한 번 트리거
  const [treeExpandCmd, setTreeExpandCmd] = useState<ForceExpandCmd | undefined>(undefined);
  const treeIsExpanded = treeExpandCmd?.expand ?? false;
  const handleTreeExpandToggle = () =>
    setTreeExpandCmd(prev => ({ key: (prev?.key ?? 0) + 1, expand: !treeIsExpanded }));
  // 하위 조직 포함 여부
  const [includeSubOrgs, setIncludeSubOrgs] = useState(true);

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

  const selectAll = () => { setSelectedOrgId(null); setShowUnassigned(false); setStatusFilter('all'); clearSelection(); };
  const selectUnassigned = () => { setSelectedOrgId(null); setShowUnassigned(true); clearSelection(); };
  const selectOrg = (id: string) => { setSelectedOrgId(id); setShowUnassigned(false); clearSelection(); };

  // Phase D-2.4a: PageHeader 슬롯 활용
  // - actions: 검색 input + "구성원 추가" 버튼 (사용자 결정 2.b)
  // - tabs: "전체" 헤더 탭 (Figma 정합)
  // - tabActions: 퇴사자 토글 (사용자 결정 4.a). 조직도/정렬/필터는 D-2.4c 에서
  // - subtitle 제거 (Stats 카드 삭제 결정 1 의 일관 처리, Figma 정합)
  const headerActions = useMemo(() => (
    <>
      {/* Phase D-2.4a-fix2: 검색 input + "구성원 추가" 버튼 모두 h-10 (40px) 정합
          MsButton size="lg" = h-10 (ui-tokens.md § 5), Figma "구성원 추가" h-40 와 동일 */}
      {/* P1-B3 라운드 14 — 검색 input 폭/placeholder 강화 (QA #6 검색 진입점 강화) */}
      {/* 한글 IME 조합 보호를 위해 자체 local state 컴포넌트로 분리 (자모 분리 버그 수정) */}
      <MemberSearchInput value={search} onChange={v => { setSearch(v); clearSelection(); }} />
      {canEdit && (
        <MsButton
          size="lg"
          variant="outline-default"
          onClick={() => setAutoAssignOpen(true)}
        >
          보고대상 자동 지정
        </MsButton>
      )}
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
  ), [canEdit, selectedOrgId, orgUnits, search]);

  const headerTabs = useMemo(() => (
    <HeaderTab active>전체</HeaderTab>
  ), []);

  // advanced=true 인 필터(휴직/퇴사/보고대상 없음)는 기본 숨김 — '더보기' 토글 또는
  // 해당 필터가 활성일 때만 노출. 자주 쓰는 전체/재직만 기본 노출.
  const STATUS_FILTER_LABELS = [
    { key: 'all'         as const, label: '전체' },
    { key: 'active'      as const, label: '재직' },
    { key: 'leave'       as const, label: '휴직',          advanced: true },
    { key: 'terminated'  as const, label: '퇴사',          advanced: true },
    { key: 'no_reviewer' as const, label: '보고대상 없음', advanced: true },
  ];

  // 숨겨진 필터가 현재 활성이면 자동으로 펼쳐 보이게 (advanced 목록에서 파생).
  const advancedActive = STATUS_FILTER_LABELS.some(f => f.advanced && f.key === statusFilter);
  const showAdvancedFilters = showMoreFilters || advancedActive;

  const headerTabActions = useMemo(() => (
    <>
      {/* 리스트 ↔ 조직도 뷰 전환 */}
      <TeamViewToggle current="list" />
      <span className="w-px h-4 bg-bd-default mx-0.5" aria-hidden />
      {/* 재직상태 필터 */}
      <div className="flex items-center gap-1">
        {STATUS_FILTER_LABELS.filter(f => !f.advanced || showAdvancedFilters).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setStatusFilter(key); clearSelection(); }}
            className={`inline-flex items-center h-6 px-2 text-xs font-bold rounded-md border transition-colors ${
              statusFilter === key
                ? 'bg-interaction-pressed border-bd-primary text-fg-default'
                : 'border-bd-primary text-fg-default hover:bg-interaction-hovered'
            }`}
          >
            {label}
          </button>
        ))}
        {/* 더보기 토글 — 추가 상태 필터 펼침/접기 (활성 중이면 이미 노출되므로 숨김) */}
        {!advancedActive && (
          <button
            onClick={() => setShowMoreFilters(v => !v)}
            className="inline-flex items-center gap-0.5 h-6 px-2 text-xs font-bold rounded-md border border-bd-primary text-fg-subtle hover:bg-interaction-hovered hover:text-fg-default transition-colors"
            title={showMoreFilters ? '추가 필터 접기' : '추가 필터 더보기'}
            aria-expanded={showMoreFilters}
          >
            {showMoreFilters ? '접기' : '더보기'}
          </button>
        )}
      </div>
      {/* 정렬 버튼 */}
      <button
        onClick={() => showToast('info', '정렬 옵션은 준비 중입니다')}
        className="inline-flex items-center gap-0.5 h-6 min-w-6 px-2 text-xs font-bold rounded-md border border-bd-primary text-fg-default hover:bg-interaction-hovered transition-colors"
        title="정렬"
      >
        <ArrowUpDown size={14} /> 정렬
      </button>
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [statusFilter, showToast, showAdvancedFilters, advancedActive, showMoreFilters]);

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

  // R7: 관리자도 구성원에 포함. 사이클 참여 분류(isSystemOperator)는 별도 의미로 유지.
  // 트리 '전체 구성원' 카운트 = 재직만 (기본 'all' 필터가 재직만 보이므로 일치).
  const totalActive   = useMemo(() => users.filter(userIsWorking).length, [users]);

  /* 소속 없는 구성원: orgUnitId 도 없고, legacy 4단계 이름 어디에도 안 잡히는 활성 사용자.
     R7: orgUnitId 우선 + legacy 폴백 — 마이그레이션 전후 모두 정확히 분류. */
  const allOrgIds   = useMemo(() => new Set(orgUnits.map(u => u.id)), [orgUnits]);
  const allOrgNameKeys = useMemo(() => new Set(orgUnits.map(u => orgNameKey(u.name))), [orgUnits]);
  const isUserAssigned = (u: User) => {
    if (u.orgUnitId && allOrgIds.has(u.orgUnitId)) return true;
    // legacy 폴백: 4단계 이름 중 하나라도 등록된 OrgUnit 이름과 일치 (정규화 비교)
    return [u.department, u.subOrg, u.team, u.squad].some(n => n && allOrgNameKeys.has(orgNameKey(n)));
  };
  const unassignedUsers = useMemo(() =>
    activeUsers.filter(u => !isUserAssigned(u))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeUsers, allOrgIds, allOrgNameKeys]
  );

  /* 선택된 조직의 구성원 */
  const { secondaryOrgs } = useTeamStore();
  const selectedUnit = selectedOrgId ? orgUnits.find(u => u.id === selectedOrgId) : null;
  // panelUsers = 현재 scope(소속없음/전체/조직)의 모집단. 재직상태 필터는 적용하지 않는다
  // (퇴사·휴직 포함 전원). 상태 narrowing 은 아래 displayedUsers(applyStatusFilter)가 담당 —
  // 이렇게 분리해야 '퇴사'/'장기휴직' 필터가 선택 조직 안에서도 정확히 동작한다.
  const panelUsers = useMemo(() => {
    if (showUnassigned) return unassignedUsers;
    if (!selectedUnit) return [...users].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    // orgUnitId 트리 기반 우선 + legacy 4단계 이름 매칭 폴백.
    // includeSubOrgs=false 이면 해당 조직 직접 소속만 표시.
    const treeIds = includeSubOrgs
      ? getMembersInOrgTree(selectedUnit.id, users, orgUnits).map(u => u.id)
      : users.filter(u => u.orgUnitId === selectedUnit.id).map(u => u.id);
    const legacyKey: Record<OrgUnitType, keyof User> = {
      mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
    };
    const legacyIds = includeSubOrgs
      ? users
          .filter(u => {
            const primary = u[legacyKey[selectedUnit.type]] as string | undefined;
            if (orgNameEquals(primary, selectedUnit.name)) return true;
            if (selectedUnit.type !== 'mainOrg' && orgNameEquals(u.department, selectedUnit.name)) return true;
            return false;
          })
          .map(u => u.id)
      : users
          .filter(u => orgNameEquals(u[legacyKey[selectedUnit.type]] as string | undefined, selectedUnit.name))
          .map(u => u.id);
    const primaryIds = new Set([...treeIds, ...legacyIds]);
    // 겸임으로 이 조직에 소속된 구성원 추가
    const secondaryIds = new Set(
      secondaryOrgs.filter(a => a.orgId === selectedUnit.id).map(a => a.userId)
    );
    const members = users.filter(u => primaryIds.has(u.id) || secondaryIds.has(u.id));
    // 조직장 맨 위, 이후 가나다/abc 순
    return members.sort((a, b) => {
      if (a.id === selectedUnit.headId) return -1;
      if (b.id === selectedUnit.headId) return 1;
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [selectedUnit, users, orgUnits, showUnassigned, unassignedUsers, secondaryOrgs, includeSubOrgs]);

  // 보고대상 미지정 구성원 ID Set — 필터·표시용 (보고대상 = 평가자).
  // noManagerByDesign(의도적 무보고대상, 최상위 등)은 경고/배지 대상에서 제외.
  const noReviewerIds = useMemo(
    () => new Set(activeUsers.filter(u => !u.managerId && !u.noManagerByDesign).map(u => u.id)),
    [activeUsers],
  );

  // 재직상태 + 배정 필터 적용 헬퍼. 모집단(panelUsers)에서 상태별로 narrowing.
  // - all: 재직만 (휴직·퇴사는 각 카테고리에서만 노출 — 사용자 결정)
  // - active: 재직            - leave: 단기+장기 휴직       - terminated: 퇴사
  // - no_reviewer: 보고대상 없는 재직중 인원
  const applyStatusFilter = (list: User[]) => {
    switch (statusFilter) {
      case 'active':      return list.filter(userIsWorking);
      case 'leave':       return list.filter(userIsOnLeave);
      case 'terminated':  return list.filter(userIsTerminated);
      case 'no_reviewer': return list.filter(u => userIsWorking(u) && noReviewerIds.has(u.id));
      case 'all':
      default:            return list.filter(userIsWorking);
    }
  };

  const searchResults = useMemo(() =>
    search.trim()
      ? applyStatusFilter(users.filter(u => matchesSearch(u, search)))
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, search, statusFilter]
  );

  // 상태 필터 적용된 표시 목록 (panelUsers + statusFilter)
  const displayedUsers = useMemo(() => applyStatusFilter(panelUsers), [panelUsers, statusFilter, noReviewerIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 조직 요약 (Option B)
  const orgSummary = useMemo(() => {
    if (!selectedUnit) return null;
    const orgHead = selectedUnit.headId ? users.find(u => u.id === selectedUnit.headId) : null;
    // panelUsers 는 휴직·퇴사 포함 모집단 → 조직 '총원'은 재직만 집계(휴직은 별도 표기).
    const total = panelUsers.filter(userIsWorking).length;
    const noReviewerInOrg = panelUsers.filter(u => noReviewerIds.has(u.id)).length;
    const leaveInOrg = panelUsers.filter(userIsOnLeave).length;
    return { orgHead, total, noReviewerInOrg, leaveInOrg };
  }, [selectedUnit, panelUsers, users, noReviewerIds]);

  const mainOrgs = useMemo(() =>
    orgUnits.filter(u => u.type === 'mainOrg').sort((a, b) => a.order - b.order),
    [orgUnits]
  );

  const handleDeleteUnit = (unit: OrgUnit) => {
    if (unit.isDerived) return; // 자동 파생 조직은 삭제 불가
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
          <p className="text-base text-fg-subtle mb-3 px-2">
            <span className="font-semibold text-fg-default">'{search}'</span> 검색 결과 {searchResults.length}명
          </p>
          {searchResults.length === 0 ? (
            <p className="text-base text-fg-subtle text-center py-12">검색 결과가 없습니다.</p>
          ) : (
            <div className="space-y-0.5">
              {searchResults.map(u => (
                <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                  onView={goViewMember}
                  onEdit={canEdit ? goEditMember : null}
                  onTerminate={canEdit ? handleTerminate : undefined}
                  onImpersonate={can.impersonate ? handleImpersonate : undefined}
                  hasReviewer={isUserActive(u) ? !noReviewerIds.has(u.id) : undefined} />
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
              <div className="mb-3 space-y-1">
                <button
                  onClick={selectUnassigned}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-base font-semibold transition-colors ${
                    showUnassigned
                      ? 'bg-bg-token-brand1-subtlest border-bd-primary text-fg-brand1'
                      : 'bg-bg-token-default border-bd-primary text-fg-subtle hover:bg-interaction-hovered hover:text-fg-default'
                  }`}
                >
                  <MsWarningIcon size={16} className="text-yellow-050 flex-shrink-0" />
                  <span className="flex-1 text-left tracking-[-0.3px]">소속 없음</span>
                  <span className="text-xs font-bold text-yellow-050">{unassignedUsers.length}</span>
                </button>
                <p className="px-1 text-xs text-fg-subtlest leading-relaxed">
                  _조직구조 탭에 조직을 추가하면 구성원이 해당 조직으로 자동 배치됩니다.
                </p>
              </div>
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
                <p className="text-base text-fg-subtle mt-0.5">{displayedUsers.length}명</p>
              </div>
              {canEdit && !showTerminated && displayedUsers.length > 0 && (
                <MsCheckbox
                  title="전체 선택"
                  checked={displayedUsers.every(u => selectedIds.has(u.id))}
                  indeterminate={displayedUsers.some(u => selectedIds.has(u.id)) && !displayedUsers.every(u => selectedIds.has(u.id))}
                  onChange={() => toggleSelectAll(displayedUsers)}
                />
              )}
            </div>

            {/* Option B — 조직 선택 시 요약 카드 */}
            {orgSummary && selectedUnit && (
              <div className="mb-3 px-3 py-3 rounded-lg border border-bd-default bg-gray-005 text-xs">
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
                  <span className="text-fg-subtle">
                    총 <strong className="text-fg-default">{orgSummary.total}명</strong>
                  </span>
                  {orgSummary.orgHead ? (
                    <span className="text-fg-subtle">
                      조직장: <strong className="text-fg-default">{orgSummary.orgHead.name}</strong>
                    </span>
                  ) : (
                    <button
                      onClick={() => openEditOrg(selectedUnit)}
                      className="font-semibold text-orange-060 hover:underline"
                    >
                      조직장 미지정 → 지정하기
                    </button>
                  )}
                  {orgSummary.noReviewerInOrg > 0 && (
                    <button
                      onClick={() => setStatusFilter('no_reviewer')}
                      className="font-semibold text-orange-060 hover:underline"
                    >
                      보고대상 없음 {orgSummary.noReviewerInOrg}명
                    </button>
                  )}
                  {orgSummary.leaveInOrg > 0 && (
                    <span className="text-fg-subtle">휴직 {orgSummary.leaveInOrg}명</span>
                  )}
                </div>
              </div>
            )}

            {/* Member list */}
            {isLoading && displayedUsers.length === 0 ? (
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
            ) : displayedUsers.length === 0 && panelUsers.length > 0 ? (
              /* 모집단엔 구성원이 있으나 현재 상태 필터에 걸리는 사람이 없음 */
              <div className="flex flex-col items-center gap-3 text-center py-12">
                <Users className="size-8 text-fg-subtlest" />
                <p className="text-base text-fg-subtle">
                  {`'${STATUS_FILTER_LABELS.find(f => f.key === statusFilter)?.label ?? ''}' 상태의 구성원이 없습니다.`}
                </p>
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-base font-semibold text-fg-brand1 hover:text-fg-brand1-bolder transition-colors">
                  필터 초기화
                </button>
              </div>
            ) : displayedUsers.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center py-12">
                <Users className="size-8 text-fg-subtlest" />
                <p className="text-base text-fg-subtle">
                  {selectedUnit
                    ? `${selectedUnit.name}에 구성원이 없습니다.`
                    : users.length > 0
                      ? `표시할 구성원이 없습니다. (전체 ${users.length}명)`
                      : '구성원이 없습니다. 시트 동기화를 확인하세요.'}
                </p>
                {!selectedUnit && users.length > 0 && (
                  <p className="text-xs text-fg-subtlest">_구성원 시트의 상태분류 컬럼 값을 확인하세요.</p>
                )}
                {canEdit && !showTerminated && (
                  <button
                    onClick={() => goAddMember(selectedOrgId ?? undefined)}
                    className="text-base font-semibold text-fg-brand1 hover:text-fg-brand1-bolder transition-colors">
                    + 구성원 추가
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {displayedUsers.map(u => (
                  <MemberRow key={u.id} user={u} secondaryOrgs={secondaryOrgs}
                    onView={goViewMember}
                    onEdit={canEdit ? goEditMember : null}
                    onTerminate={canEdit && !showTerminated ? handleTerminate : undefined}
                    onImpersonate={can.impersonate && !showTerminated ? handleImpersonate : undefined}
                    selected={selectedIds.has(u.id)}
                    onToggle={canEdit && !showTerminated ? toggleMember : undefined}
                    selectionActive={selectedIds.size > 0}
                    isOrgHeadHere={selectedUnit?.headId === u.id}
                    hasReviewer={showTerminated ? undefined : !noReviewerIds.has(u.id)} />
                ))}
              </div>
            )}

            {/* 선택된 N명 액션 바 */}
            {canEdit && selectedIds.size > 0 && !showTerminated && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-bg-token-brand1-subtlest flex items-center justify-between">
                <span className="text-base font-semibold text-fg-brand1">{selectedIds.size}명 선택됨</span>
                <div className="flex items-center gap-2">
                  <MsButton variant="ghost" size="sm" onClick={clearSelection}>선택 해제</MsButton>
                  <MsButton
                    variant="outline-default"
                    size="sm"
                    onClick={() => setBulkManagerOpen(true)}
                  >
                    보고대상 변경
                  </MsButton>
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

          {/* Right: 조직도 패널 — flex-col, 트리만 스크롤, 헤더·푸터 고정 */}
          <div className="w-[366px] flex-shrink-0 border-l border-bd-default flex flex-col">
            {/* 헤더 (고정) */}
            <div className="flex-shrink-0 px-6 pt-4 pb-3">
              <div className="flex items-start justify-between">
                <button
                  onClick={selectAll}
                  className="flex flex-col items-start gap-0.5 -mx-2 px-2 py-1 rounded-md hover:bg-interaction-hovered transition-colors text-left"
                >
                  <p className={`text-base font-bold tracking-[-0.3px] leading-6 ${
                    !selectedOrgId && !showTerminated && !showUnassigned ? 'text-fg-brand1' : 'text-fg-default'
                  }`}>조직도</p>
                  <p className="text-base text-fg-subtle tracking-[-0.3px] leading-5">
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
            </div>

            {/* 트리 본문 (개별 스크롤) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2">
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
                      forceExpandCmd={treeExpandCmd}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 (고정) — 트리 밖, 항상 패널 하단에 표시 */}
            {orgUnits.length > 0 && (
              <div className="flex-shrink-0 border-t border-bd-default px-6 py-3 flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-xs text-fg-subtle cursor-pointer select-none">
                  <MsCheckbox
                    checked={includeSubOrgs}
                    onChange={() => setIncludeSubOrgs(v => !v)}
                  />
                  하위 조직 포함 선택하기
                </label>
                <button
                  onClick={handleTreeExpandToggle}
                  className="text-xs text-fg-subtle hover:text-fg-default transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  {treeIsExpanded ? '모두 접기' : '모두 펼치기'}
                </button>
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

      {/* 평가자 자동 지정 */}
      <AutoAssignModal
        open={autoAssignOpen}
        onClose={() => setAutoAssignOpen(false)}
      />

      {/* 보고대상 일괄 변경 */}
      <BulkManagerDialog
        open={bulkManagerOpen}
        selectedCount={selectedIds.size}
        onClose={() => setBulkManagerOpen(false)}
        onConfirm={(managerId) => {
          bulkUpdateMembers([...selectedIds].map(id => ({ id, patch: { managerId } })));
          clearSelection();
          showToast('success', `${selectedIds.size}명의 보고대상을 변경했습니다.`);
        }}
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
          <p className="text-base font-semibold text-fg-default">신규 회원 {count}명 승인 대기</p>
          <p className="text-xs text-fg-subtle mt-0.5">관리자가 승인해야 시스템을 사용할 수 있습니다.</p>
        </div>
      </div>
      <MsChevronRightLineIcon size={14} className="text-fg-subtlest" />
    </button>
    </div>
  );
}
