import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings, ChevronLeft, ChevronRight, Star, Bell, RefreshCw, Building2,
  LogOut, UserCheck,
} from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { UserAvatar } from '../ui/UserAvatar';
import { cn } from '../ui/cn';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: Props) {
  const { isLeader, isAdmin } = usePermission();
  const { currentUser, logout } = useAuthStore();
  const { notifications } = useNotificationStore();
  const navigate = useNavigate();

  const unreadCount = notifications.filter(n => n.userId === currentUser?.id && !n.isRead).length;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const navItems = [
    { to: '/',              icon: LayoutDashboard, label: '홈',        show: true,                              badge: false },
    { to: '/reviews/me',    icon: Star,            label: '내 리뷰',   show: !isAdmin,                          badge: false },
    { to: '/reviews/team',  icon: UserCheck,       label: '하향 평가', show: currentUser?.role === 'leader',    badge: false },
    { to: '/team',          icon: Building2,       label: '구성원',    show: true,                              badge: false },
    { to: '/cycles',        icon: RefreshCw,       label: '리뷰 운영', show: isAdmin,                           badge: false },
    { to: '/notifications', icon: Bell,            label: '알림',      show: true,                              badge: true  },
  ].filter(i => i.show);

  const handleLogout = () => {
    onMobileClose();
    logout();
    navigate('/login');
  };

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen bg-neutral-950 border-r border-white/5 flex flex-col z-30 transition-all duration-200',
      'w-56',
      mobileOpen ? 'translate-x-0' : '-translate-x-full',
      'md:translate-x-0',
      collapsed ? 'md:w-14' : 'md:w-56',
    )}>

      {/* ── Logo ── */}
      <div className={cn(
        'flex items-center h-14 border-b border-white/5 flex-shrink-0 px-4 gap-2.5',
        collapsed && 'md:justify-center md:px-0',
      )}>
        <div className="w-7 h-7 bg-primary-600 rounded-md flex items-center justify-center flex-shrink-0">
          <Star size={14} className="text-white" />
        </div>
        <span className={cn(
          'text-sm font-semibold text-white tracking-tight',
          collapsed && 'md:hidden',
        )}>
          ReviewFlow
        </span>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            onClick={onMobileClose}
            className={({ isActive }) => cn(
              'relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
              collapsed && 'md:justify-center',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-neutral-400 hover:bg-white/5 hover:text-white',
            )}
          >
            <span className="relative flex-shrink-0">
              <Icon size={16} />
              {badge && unreadCount > 0 && collapsed && (
                <span className="absolute -top-1 -right-1 w-[7px] h-[7px] bg-danger-500 rounded-full border border-neutral-950 hidden md:block" />
              )}
            </span>
            <span className={cn('flex-1 leading-none', collapsed && 'md:hidden')}>
              {label}
            </span>
            {badge && unreadCount > 0 && (
              <span className={cn(
                'text-[10px] font-bold bg-danger-500 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center leading-none',
                collapsed && 'md:hidden',
              )}>
                {unreadLabel}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── User + Actions ── */}
      <div className="border-t border-white/5 p-2 flex-shrink-0 space-y-1">

        {/* 펼쳐진 상태: 유저 정보 + 아이콘 액션 */}
        {currentUser && (
          <div className={cn(
            'flex items-center gap-2.5 px-2 py-2 rounded-lg',
            collapsed && 'md:hidden',
          )}>
            <UserAvatar user={currentUser} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate leading-tight">
                {currentUser.name}
              </p>
              <p className="text-[11px] text-neutral-400 truncate leading-tight mt-0.5">
                {currentUser.department}
              </p>
            </div>
            {/* 설정 */}
            <button
              onClick={() => { navigate('/settings'); onMobileClose(); }}
              title="설정"
              className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <Settings size={14} />
            </button>
            {/* 로그아웃 */}
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="p-1.5 rounded-md text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors flex-shrink-0"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {/* 접힌 상태: 아바타 + 로그아웃만 */}
        {currentUser && (
          <div className={cn(
            'hidden flex-col items-center gap-1',
            collapsed && 'md:flex',
          )}>
            <button
              onClick={() => { navigate('/settings'); onMobileClose(); }}
              title={`${currentUser.name} · 설정`}
              className="p-1 rounded-md hover:bg-white/10 transition-colors"
            >
              <UserAvatar user={currentUser} size="sm" />
            </button>
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="p-1.5 rounded-md text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
            >
              <LogOut size={13} />
            </button>
          </div>
        )}

        {/* 접기/펼치기 토글 */}
        <button
          onClick={onToggle}
          className="hidden md:flex w-full items-center justify-center py-1.5 rounded-lg hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-colors"
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>
    </aside>
  );
}
