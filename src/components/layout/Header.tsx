import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, ChevronDown, Menu } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Avatar } from '../catalyst/avatar';
import { Divider } from '../catalyst/divider';
import { Badge } from '../catalyst/badge';
import { NotificationPanel } from '../common/NotificationPanel';

const ROLE_META: Record<string, { label: string; color: 'indigo' | 'emerald' | 'zinc' }> = {
  admin:    { label: '관리자', color: 'indigo'  },
  manager:  { label: '조직장',   color: 'emerald' },
  employee: { label: '팀원',   color: 'zinc'    },
};

interface Props {
  onMobileToggle: () => void;
}

export function Header({ onMobileToggle }: Props) {
  const { currentUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!currentUser) return null;

  const role = ROLE_META[currentUser.role];

  return (
    /* Catalyst Navbar */
    <header className="h-14 bg-white border-b border-zinc-950/5 flex items-center justify-between px-4 md:justify-end md:px-6 sticky top-0 z-10">

      {/* 햄버거 — 모바일 */}
      <button
        onClick={onMobileToggle}
        className="md:hidden p-1.5 hover:bg-zinc-950/5 rounded-lg text-zinc-600 transition-colors"
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-1">
        <NotificationPanel />

        {/* User dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-950/5 transition-colors"
          >
            <Avatar
              initials={currentUser.name.slice(0, 2)}
              color={currentUser.avatarColor}
              className="size-7"
            />
            <div className="hidden sm:block text-left">
              <p className="text-sm/5 font-semibold text-zinc-950 leading-tight">
                {currentUser.name}
              </p>
            </div>
            <ChevronDown size={12} className="text-zinc-400 hidden sm:block" />
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-60 bg-white rounded-xl shadow-[0_8px_16px_rgb(0,0,0,0.08),0_2px_4px_rgb(0,0,0,0.05)] ring-1 ring-zinc-950/5 z-50 overflow-hidden animate-[fadeSlideDown_0.15s_ease]">
              {/* User info */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar
                    initials={currentUser.name.slice(0, 2)}
                    color={currentUser.avatarColor}
                    className="size-9"
                  />
                  <div className="min-w-0">
                    <p className="text-sm/6 font-semibold text-zinc-950 truncate">{currentUser.name}</p>
                    <p className="text-xs/5 text-zinc-500 truncate">{currentUser.position}</p>
                  </div>
                </div>
                <Badge color={role.color}>{role.label}</Badge>
              </div>

              <Divider soft />

              <div className="py-1">
                <button
                  onClick={() => { navigate('/settings'); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm/6 text-zinc-700 hover:bg-zinc-950/[2.5%] transition-colors"
                >
                  <Settings size={14} className="text-zinc-400 shrink-0" />
                  설정
                </button>
                <button
                  onClick={() => { logout(); navigate('/login'); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm/6 text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} className="shrink-0" />
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
