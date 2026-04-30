import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MsHomeIcon, MsSettingIcon,
  MsRefreshIcon, MsLogoutIcon, MsProfileIcon, MsMoreIcon, MsGroupIcon,
  MsArticleIcon, MsDeleteIcon, MsLockIcon, MsIdcardIcon, MsHelpIcon,
} from '../ui/MsIcons';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { usePendingApprovalsStore } from '../../stores/pendingApprovalsStore';
import { getMembersInOrgTree } from '../../utils/userCompat';
import { Pill } from '../ui/Pill';
import { cn } from '../ui/cn';
import { useMemo } from 'react';

interface Props {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function BrandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#ms-clip)">
        <path d="M0 6.4C0 4.15979 0 3.03968 0.435974 2.18404C0.819467 1.43139 1.43139 0.819467 2.18404 0.435974C3.03968 0 4.15979 0 6.4 0H17.6C19.8402 0 20.9603 0 21.816 0.435974C22.5686 0.819467 23.1805 1.43139 23.564 2.18404C24 3.03968 24 4.15979 24 6.4V17.6C24 19.8402 24 20.9603 23.564 21.816C23.1805 22.5686 22.5686 23.1805 21.816 23.564C20.9603 24 19.8402 24 17.6 24H6.4C4.15979 24 3.03968 24 2.18404 23.564C1.43139 23.1805 0.819467 22.5686 0.435974 21.816C0 20.9603 0 19.8402 0 17.6V6.4Z" fill="url(#ms-grad)"/>
        <path fillRule="evenodd" clipRule="evenodd" d="M20.3158 10.8307L18.0583 9.51837C17.4989 9.19275 17.1593 8.60071 17.1593 7.95933V5.35436C17.1593 4.30843 16.0205 3.65718 15.1115 4.19002L12.904 5.47277C12.3446 5.79839 11.6454 5.79839 11.076 5.47277L8.87847 4.19002C7.96948 3.66705 6.83074 4.31829 6.83074 5.35436V7.95933C6.83074 8.60071 6.49112 9.19275 5.93174 9.51837L3.67425 10.8307C2.77525 11.3537 2.77525 12.6463 3.67425 13.1693L5.93174 14.4816C6.49112 14.8073 6.83074 15.3993 6.83074 16.0407V18.6456C6.83074 19.6916 7.96948 20.3428 8.87847 19.81L11.086 18.5272C11.6454 18.2016 12.3446 18.2016 12.914 18.5272L15.1215 19.81C16.0305 20.3329 17.1693 19.6817 17.1693 18.6456V16.0407C17.1693 15.3993 17.5089 14.8073 18.0683 14.4816L20.3257 13.1693C21.2247 12.6463 21.2247 11.3537 20.3257 10.8307H20.3158ZM17.1493 12.5772L15.5511 13.5048C15.2614 13.6725 15.0816 13.9883 15.0816 14.3238V16.1788C15.0816 16.6919 14.5122 17.0175 14.0627 16.7511L12.4845 15.8335C12.1848 15.6657 11.8252 15.6657 11.5255 15.8335L9.94728 16.7412C9.48779 17.0077 8.91842 16.682 8.91842 16.1591V14.304C8.91842 13.9685 8.73862 13.6626 8.44895 13.4949L6.85072 12.5674C6.40122 12.3108 6.40122 11.6596 6.85072 11.403L8.44895 10.4755C8.73862 10.3078 8.91842 9.992 8.91842 9.65651V7.81132C8.91842 7.28836 9.48779 6.9726 9.94728 7.22915L11.5255 8.13695C11.8252 8.30469 12.1848 8.30469 12.4845 8.13695L14.0627 7.22915C14.5222 6.96274 15.0916 7.28836 15.0916 7.81132V9.66638C15.0916 10.0019 15.2714 10.3078 15.561 10.4755L17.1593 11.403C17.6088 11.6596 17.6088 12.3108 17.1593 12.5674L17.1493 12.5772Z" fill="white"/>
      </g>
      <defs>
        <radialGradient id="ms-grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24.5 24) rotate(-135) scale(33.9411)">
          <stop stopColor="#FDAA87"/>
          <stop offset="0.802885" stopColor="#FF558F"/>
        </radialGradient>
        <clipPath id="ms-clip">
          <rect width="24" height="24" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: Props) {
  // R7 prep: collapsed/onToggle 제거 — 데스크탑은 220px 고정.
  // Phase D-2.1: collapsed 변수 자체도 제거 (Figma 정합 후 축소 모드 분기 사라짐)
  const { isAdmin, can } = usePermission();
  const { currentUser, logout } = useAuthStore();
  // R6 Phase D: 마스터 로그인 활성 중에는 어드민 메뉴 자동 숨김
  const isImpersonating = useAuthStore(s => s.impersonatingFromId !== null);
  // R6 Bugfix: 메뉴 가시성을 권한 코드 기반으로. admin role 은 자동 모든 권한.
  // impersonate 중에는 일괄 차단.
  const showCycles      = !isImpersonating && can.manageCycles;
  const showTemplates   = !isImpersonating && can.manageTemplates;
  const showOrgAdmin    = !isImpersonating && can.manageOrg;
  const showPermissions = !isImpersonating && can.managePermissionGroups;
  const showAudit       = !isImpersonating && can.viewAuditLog;
  // 섹션 헤더 가시성 — 섹션 안 항목이 1개 이상일 때만 노출
  const showOrgSection      = showOrgAdmin || showPermissions;
  const showCycleSection    = showCycles || showTemplates;
  const showSecuritySection = showAudit;
  // 일반 사용자가 admin 권한이 하나도 없을 때만 '구성원' 메뉴를 일반 위치에 노출
  const showMemberItemForUser = !isImpersonating && !showOrgAdmin;
  const submissions = useReviewStore(s => s.submissions);
  const cycles = useReviewStore(s => s.cycles);
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // leader 자격으로 평가/승인 권한을 갖는 leadee 집합
  // - 직속 매니저(users.managerId)로 지정 + 조직장(orgUnits.headId) 으로 지정된 조직 소속(자손 포함)
  // R7: orgUnitId 트리 매칭 우선, legacy 4단계 이름 매칭 폴백 — Team.tsx panelUsers 와 동일 정책.
  const leadeeIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const byMgr = new Set(users.filter(u => u.managerId === currentUser.id).map(u => u.id));
    const headedOrgs = orgUnits.filter(o => o.headId === currentUser.id);
    const orgMembers = new Set<string>();
    for (const org of headedOrgs) {
      for (const m of getMembersInOrgTree(org.id, users, orgUnits)) {
        orgMembers.add(m.id);
      }
    }
    // legacy 폴백 — R1 마이그 전 데이터 호환
    const headOrgNames = new Set(headedOrgs.map(o => o.name));
    for (const u of users) {
      if (
        headOrgNames.has(u.department) ||
        headOrgNames.has(u.subOrg ?? '__') ||
        headOrgNames.has(u.team ?? '__') ||
        headOrgNames.has(u.squad ?? '__')
      ) {
        orgMembers.add(u.id);
      }
    }
    return new Set([...byMgr, ...orgMembers]);
  }, [currentUser, users, orgUnits]);

  // 승인 대기 개수 (뱃지 표기용)
  const pendingApprovals = useMemo(() => {
    if (!can.viewTeamReviews && !isAdmin) return 0;
    return submissions.filter(s =>
      s.type === 'peer' && s.peerProposal?.status === 'pending' && leadeeIds.has(s.revieweeId)
    ).length;
  }, [submissions, leadeeIds, can.viewTeamReviews, isAdmin]);

  // 승인 대기 메뉴 자체의 가시성 — peerProposal 데이터(pending + 처리완료) 1건이라도 있어야 노출
  const peerApprovalsHasData = useMemo(() => {
    if (!can.viewTeamReviews && !isAdmin) return false;
    return submissions.some(s =>
      s.type === 'peer' && s.peerProposal && leadeeIds.has(s.revieweeId)
    );
  }, [submissions, leadeeIds, can.viewTeamReviews, isAdmin]);

  // 보관함 가시성 — 보관된 사이클이 1건이라도 있어야 노출
  const hasArchivedCycles = useMemo(() => cycles.some(c => !!c.archivedAt), [cycles]);

  // R7: 신규 회원 승인 대기 카운트 — 구성원 메뉴 옆 빨간 배지
  const pendingApprovalCount = usePendingApprovalsStore(s => s.count);
  const refreshPendingApprovals = usePendingApprovalsStore(s => s.refresh);
  useEffect(() => {
    if (!showOrgAdmin) return;
    void refreshPendingApprovals();
    // 5분마다 새로고침
    const t = window.setInterval(() => { void refreshPendingApprovals(); }, 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [showOrgAdmin, refreshPendingApprovals]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  type NavNode =
    | { kind: 'item'; to: string; icon: typeof MsHomeIcon; label: string; show: boolean; indent?: boolean; badge?: number }
    | { kind: 'section'; label: string; show: boolean };

  // 메뉴 트리: 일반 사용자 메뉴 + 권한별 admin 섹션 (레몬베이스 어드민 메뉴 구조)
  // 각 admin 섹션/항목은 해당 권한 코드 보유자만 노출.
  const navItems: NavNode[] = ([
    /* 일반 사용자 메뉴 */
    { kind: 'item', to: '/',                            icon: MsHomeIcon,    label: '홈',           show: true },
    { kind: 'item', to: '/reviews/me',                  icon: MsRefreshIcon, label: '내 작성',      show: !isAdmin || isImpersonating },
    { kind: 'item', to: '/reviews/received',            icon: MsProfileIcon, label: '받은 리뷰',    show: true },
    { kind: 'item', to: '/reviews/team',                icon: MsProfileIcon, label: '하향 평가',    show: can.viewTeamReviews && !isAdmin && leadeeIds.size > 0 },
    { kind: 'item', to: '/reviews/team/peer-approvals', icon: MsArticleIcon, label: '승인 대기',    show: !isImpersonating && (can.viewTeamReviews || isAdmin) && peerApprovalsHasData, badge: pendingApprovals },
    { kind: 'item', to: '/team',                        icon: MsGroupIcon,   label: '구성원',       show: showMemberItemForUser },

    /* 어드민 — 구성원 관리 */
    { kind: 'section', label: '구성원 관리', show: showOrgSection },
    { kind: 'item', to: '/team',                icon: MsGroupIcon,    label: '구성원',         show: showOrgAdmin,    indent: true, badge: pendingApprovalCount },
    { kind: 'item', to: '/team/profile-fields', icon: MsIdcardIcon,   label: '프로필 설정',    show: showOrgAdmin,    indent: true },
    { kind: 'item', to: '/permissions',         icon: MsLockIcon,     label: '권한 관리',      show: showPermissions, indent: true },

    /* 어드민 — 리뷰 운영 */
    { kind: 'section', label: '리뷰 운영', show: showCycleSection },
    { kind: 'item', to: '/cycles',         icon: MsRefreshIcon, label: '리뷰 운영', show: showCycles, indent: true },
    { kind: 'item', to: '/templates',      icon: MsArticleIcon, label: '템플릿',  show: showTemplates, indent: true },
    { kind: 'item', to: '/cycles/archive', icon: MsDeleteIcon,  label: '보관함',  show: showCycles && hasArchivedCycles, indent: true },

    /* 어드민 — 보안 관리 */
    { kind: 'section', label: '보안 관리', show: showSecuritySection },
    { kind: 'item', to: '/security/audit', icon: MsArticleIcon, label: '감사 로그',  show: showAudit, indent: true },

    /* 가이드 — 모든 사용자 */
    { kind: 'section', label: '도움말', show: true },
    { kind: 'item', to: '/guide', icon: MsHelpIcon, label: '가이드', show: true, indent: true },
  ] satisfies NavNode[]).filter(i => i.show);

  const handleLogout = () => {
    onMobileClose();
    logout();
    navigate('/login');
  };

  return (
    <aside className={cn(
      // Phase D-2.1: bg-white → bg-bg-token-default (토큰 정합), border-gray-020 → bd.default
      // Phase D-2.4d: Figma 정합 — LNB 는 elevated/surface/raised (#fcfdfd) 사용.
      // 페이지 본문 (bg-bg-token-default = #ffffff) 위 살짝 띄운 surface 의도.
      'fixed left-0 top-0 h-screen bg-surface-raised border-r border-bd-default flex flex-col z-30 transition-transform duration-200',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      'md:translate-x-0',
      'md:w-[220px] w-[220px]',
    )}>

      {/* Phase D-2.1: ADM / LNB / Unit / Header — 로고 + User ID 통합 박스
          Figma: px-[14px] py-[16px] gap-[8px] flex-col items-start justify-center */}
      <div className="flex flex-col gap-2 items-start justify-center px-3.5 py-4 flex-shrink-0">
        {/* Container/Subject — 로고 + 앱 이름 */}
        <div className="flex gap-1 items-center w-[192px]">
          <BrandIcon className="size-[34px] rounded-md flex-shrink-0" />
          <div className="flex-1 min-w-0 p-1">
            <p className="text-sm font-bold text-fg-default tracking-[-0.3px] leading-5 truncate">
              메이크스타 리뷰시스템
            </p>
          </div>
        </div>

        {/* Container/Id — 이메일 + more 버튼 (박스 형태) */}
        {currentUser && (
          <div className="relative w-full" ref={menuRef}>
            <div className="bg-bg-token-subtle border border-bd-primary rounded flex gap-1 items-center px-2 py-1 overflow-clip">
              <p className="flex-1 min-w-0 text-xs text-fg-subtle tracking-[-0.3px] leading-4 truncate">
                {currentUser.email}
              </p>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center rounded-md size-[14px] text-fg-subtle hover:text-fg-default transition-colors flex-shrink-0"
                title="더보기"
              >
                <MsMoreIcon size={14} />
              </button>
            </div>

            {menuOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-bd-default rounded-lg shadow-overlay z-50 overflow-hidden py-1">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/settings'); onMobileClose(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-fg-subtle hover:bg-interaction-hovered hover:text-fg-default transition-colors"
                >
                  <MsSettingIcon size={14} className="flex-shrink-0" />
                  설정
                </button>
                <button
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-fg-subtlest hover:bg-red-005 hover:text-red-050 transition-colors"
                >
                  <MsLogoutIcon size={14} className="flex-shrink-0" />
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase D-2.1: Nav — Figma ADM / LNB / Unit / Menu 패턴
          - SubTitle: pt-2 px-5, text-xs font-semibold subtlest, sentence case (uppercase 제거)
          - 메뉴: outer (px-2 py-1) + inner (px-3 py-2 rounded-md), 활성/비활성 모두 font-bold
          - 아이콘 20px, chevron 제거, indent 제거 */}
      <nav className="flex-1 overflow-y-auto pb-2">
        {navItems.map((node, i) => {
          if (node.kind === 'section') {
            return (
              <div key={`section-${i}`} className="flex items-center pt-2 px-5 w-full">
                <p className="text-xs font-semibold text-fg-subtlest tracking-[-0.3px] leading-4 whitespace-nowrap">
                  {node.label}
                </p>
              </div>
            );
          }
          const Icon = node.icon;
          return (
            <div key={node.to} className="flex items-center px-2 py-1 w-full">
              <NavLink
                to={node.to}
                end={node.to === '/' || node.to === '/cycles' || node.to === '/team'}
                onClick={onMobileClose}
                className={({ isActive }) => cn(
                  'flex flex-1 gap-2 items-center min-w-0 px-3 py-2 rounded-md transition-colors',
                  isActive
                    ? 'bg-bg-token-brand1-subtlest text-fg-brand1'
                    : 'text-fg-subtle hover:bg-interaction-hovered',
                )}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-bold tracking-[-0.3px] leading-5 truncate">
                  {node.label}
                </span>
                {node.badge != null && node.badge > 0 && (
                  <Pill tone="danger" size="xs" className="shrink-0">
                    {node.badge}
                  </Pill>
                )}
              </NavLink>
            </div>
          );
        })}
      </nav>

    </aside>
  );
}
