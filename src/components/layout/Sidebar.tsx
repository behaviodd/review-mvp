import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MsHomeIcon, MsSettingIcon, MsChevronLeftLineIcon, MsChevronRightLineIcon,
  MsRefreshIcon, MsLogoutIcon, MsProfileIcon, MsMoreIcon, MsGroupIcon,
  MsArticleIcon, MsDeleteIcon, MsLockIcon,
} from '../ui/MsIcons';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { Pill } from '../ui/Pill';
import { cn } from '../ui/cn';
import { useMemo } from 'react';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
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

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: Props) {
  const { isAdmin, can } = usePermission();
  const { currentUser, logout } = useAuthStore();
  // R6 Phase D: 마스터 로그인 활성 중에는 admin 메뉴 자동 숨김
  // (대상자 화면을 그대로 보여줘야 하므로 admin 메뉴가 노출되면 안 됨)
  const isImpersonating = useAuthStore(s => s.impersonatingFromId !== null);
  const adminMenusVisible = isAdmin && !isImpersonating;
  const submissions = useReviewStore(s => s.submissions);
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 승인 대기 개수 계산 — leader/admin에만 노출
  const pendingApprovals = useMemo(() => {
    if (!currentUser || !can.viewTeamReviews) return 0;
    const byMgr = new Set(users.filter(u => u.managerId === currentUser.id).map(u => u.id));
    const headOrgs = new Set(orgUnits.filter(o => o.headId === currentUser.id).map(o => o.name));
    const orgMembers = new Set(users.filter(u =>
      headOrgs.has(u.department) || headOrgs.has(u.subOrg ?? '__') ||
      headOrgs.has(u.team ?? '__') || headOrgs.has(u.squad ?? '__')
    ).map(u => u.id));
    const leadeeIds = new Set([...byMgr, ...orgMembers]);
    return submissions.filter(s =>
      s.type === 'peer' && s.peerProposal?.status === 'pending' && leadeeIds.has(s.revieweeId)
    ).length;
  }, [submissions, users, orgUnits, currentUser, can.viewTeamReviews]);

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

  // 메뉴 트리: 일반 사용자 메뉴 + admin 전용 3개 섹션 (레몬베이스 어드민 메뉴 구조 참고)
  // - 구성원 관리: 구성원 / 권한 관리
  // - 리뷰 운영:   사이클 / 템플릿 / 보관함
  // - 보안 관리:   감사 로그
  const navItems: NavNode[] = ([
    /* 일반 사용자 메뉴 */
    { kind: 'item', to: '/',                            icon: MsHomeIcon,    label: '홈',           show: true },
    { kind: 'item', to: '/reviews/me',                  icon: MsRefreshIcon, label: '내 작성',      show: !adminMenusVisible || isImpersonating },
    { kind: 'item', to: '/reviews/received',            icon: MsProfileIcon, label: '받은 리뷰',    show: true },
    { kind: 'item', to: '/reviews/team',                icon: MsProfileIcon, label: '하향 평가',    show: can.viewTeamReviews && !adminMenusVisible },
    { kind: 'item', to: '/reviews/team/peer-approvals', icon: MsArticleIcon, label: '승인 대기',    show: !isImpersonating && (can.viewTeamReviews || isAdmin), badge: pendingApprovals },

    /* 어드민 — 구성원 관리 */
    { kind: 'section', label: '구성원 관리', show: adminMenusVisible },
    { kind: 'item', to: '/team',           icon: MsGroupIcon,   label: '구성원',     show: adminMenusVisible, indent: true },
    { kind: 'item', to: '/permissions',    icon: MsLockIcon,    label: '권한 관리',  show: adminMenusVisible, indent: true },

    /* 어드민 — 리뷰 운영 */
    { kind: 'section', label: '리뷰 운영', show: adminMenusVisible },
    { kind: 'item', to: '/cycles',         icon: MsRefreshIcon, label: '사이클',     show: adminMenusVisible, indent: true },
    { kind: 'item', to: '/templates',      icon: MsArticleIcon, label: '템플릿',     show: adminMenusVisible, indent: true },
    { kind: 'item', to: '/cycles/archive', icon: MsDeleteIcon,  label: '보관함',     show: adminMenusVisible, indent: true },

    /* 어드민 — 보안 관리 */
    { kind: 'section', label: '보안 관리', show: adminMenusVisible },
    { kind: 'item', to: '/security/audit', icon: MsArticleIcon, label: '감사 로그',  show: adminMenusVisible, indent: true },

    /* 일반 사용자에게도 노출되어야 하는 '구성원' (admin 미만 사용자용) */
    { kind: 'item', to: '/team', icon: MsGroupIcon, label: '구성원', show: !isImpersonating && !adminMenusVisible },
  ] satisfies NavNode[]).filter(i => i.show);

  const handleLogout = () => {
    onMobileClose();
    logout();
    navigate('/login');
  };

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen bg-white border-r border-gray-020 flex flex-col z-30 transition-all duration-200',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      'md:translate-x-0',
      collapsed ? 'md:w-[56px]' : 'md:w-[220px]',
      'w-[220px]',
    )}>

      {/* ── 로고 ── */}
      <div className={cn(
        'flex items-center h-[72px] border-b border-gray-010 flex-shrink-0 px-4',
        collapsed ? 'md:justify-center md:px-0' : 'gap-2.5',
      )}>
        <BrandIcon className="size-8 flex-shrink-0" />
        <span className={cn(
          'text-[13px] font-semibold text-gray-099 leading-tight flex-1',
          collapsed && 'md:hidden',
        )}>
          메이크스타 리뷰시스템
        </span>
        <button
          onClick={onToggle}
          className="hidden md:flex items-center justify-center size-6 rounded-md text-gray-040 hover:text-gray-060 hover:bg-gray-010 transition-colors flex-shrink-0"
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <MsChevronRightLineIcon size={12} /> : <MsChevronLeftLineIcon size={12} />}
        </button>
      </div>

      {/* ── 유저 이메일 + 드롭다운 ── */}
      {currentUser && (
        <div className={cn(
          'relative flex items-center justify-between px-4 py-2.5 border-b border-gray-010',
          collapsed && 'md:hidden',
        )} ref={menuRef}>
          <span className="text-[11px] text-gray-040 truncate flex-1">{currentUser.email}</span>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="ml-1 text-gray-030 hover:text-gray-050 transition-colors flex-shrink-0"
            title="더보기"
          >
            <MsMoreIcon size={12} />
          </button>

          {menuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-020 rounded-lg shadow-lg z-50 overflow-hidden py-1">
              <button
                onClick={() => { setMenuOpen(false); navigate('/settings'); onMobileClose(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-gray-060 hover:bg-gray-005 hover:text-gray-099 transition-colors"
              >
                <MsSettingIcon size={12} className="flex-shrink-0" />
                설정
              </button>
              <button
                onClick={() => { setMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-gray-050 hover:bg-red-005 hover:text-red-050 transition-colors"
              >
                <MsLogoutIcon size={12} className="flex-shrink-0" />
                로그아웃
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((node, i) => {
          if (node.kind === 'section') {
            return (
              <div
                key={`section-${i}`}
                className={cn(
                  'px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-040',
                  collapsed && 'md:hidden',
                )}
              >
                {node.label}
              </div>
            );
          }
          const Icon = node.icon;
          return (
            <NavLink
              key={node.to}
              to={node.to}
              end={node.to === '/' || node.to === '/cycles'}
              title={collapsed ? node.label : undefined}
              onClick={onMobileClose}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                node.indent && !collapsed && 'md:ml-1.5',
                collapsed && 'md:justify-center md:px-0 md:py-2.5',
                isActive
                  ? 'bg-pink-005 text-pink-040 font-semibold'
                  : 'text-gray-060 hover:bg-gray-005 hover:text-gray-099 font-medium',
              )}
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className={cn('flex-1', collapsed && 'md:hidden')}>{node.label}</span>
              {node.badge != null && node.badge > 0 && (
                <Pill tone="danger" size="xs" className={cn('shrink-0', collapsed && 'md:hidden')}>
                  {node.badge}
                </Pill>
              )}
              <MsChevronRightLineIcon size={14} className={cn('flex-shrink-0 text-gray-030', collapsed && 'md:hidden')} />
            </NavLink>
          );
        })}
      </nav>

    </aside>
  );
}
