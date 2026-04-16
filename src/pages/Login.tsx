import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { MOCK_USERS } from '../data/mockData';
import { Star } from 'lucide-react';
import { Avatar } from '../components/catalyst/avatar';
import { Badge } from '../components/catalyst/badge';
import type { BadgeColor } from '../components/catalyst/badge';
import { Divider } from '../components/catalyst/divider';

const ROLE_META: Record<string, { label: string; desc: string; color: BadgeColor }> = {
  admin:    { label: '관리자', desc: '리뷰 운영 · 전체 현황 · 리포트',  color: 'indigo'  },
  manager:  { label: '팀장',   desc: '팀원 평가 · 셀프 리뷰 · 팀 현황', color: 'emerald' },
  employee: { label: '팀원',   desc: '셀프 리뷰 · 피드백',              color: 'zinc'    },
};

export function Login() {
  const { login } = useAuthStore();
  const navigate  = useNavigate();

  const handleLogin = (userId: string) => {
    const user = MOCK_USERS.find(u => u.id === userId);
    if (user) { login(user); navigate('/'); }
  };

  const byRole = {
    admin:    MOCK_USERS.filter(u => u.role === 'admin'),
    manager:  MOCK_USERS.filter(u => u.role === 'manager'),
    employee: MOCK_USERS.filter(u => u.role === 'employee'),
  } as const;

  return (
    /* Catalyst Auth Layout */
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-10 bg-indigo-600 rounded-xl mb-4">
            <Star size={18} className="text-white" />
          </div>
          <h1 className="text-2xl/8 font-semibold text-zinc-950 tracking-tight">ReviewFlow</h1>
          <p className="text-sm/6 text-zinc-500 mt-1">체험 계정을 선택하세요</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl ring-1 ring-zinc-950/5 shadow-[0_1px_3px_rgb(0,0,0,0.05),0_1px_2px_-1px_rgb(0,0,0,0.05)] overflow-hidden">
          {(['admin', 'manager', 'employee'] as const).map((role, ri) => {
            const meta = ROLE_META[role];
            return (
              <div key={role}>
                {ri > 0 && <Divider soft />}

                {/* Role header */}
                <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                  <Badge color={meta.color}>{meta.label}</Badge>
                  <span className="text-xs/5 text-zinc-400">{meta.desc}</span>
                </div>

                {/* User list */}
                <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                  {byRole[role].map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleLogin(user.id)}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-zinc-950/8 bg-zinc-50 hover:bg-white hover:border-zinc-950/15 hover:shadow-sm transition-all text-left group"
                    >
                      <Avatar
                        initials={user.name.slice(0, 2)}
                        color={user.avatarColor}
                        className="size-8 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm/6 font-semibold text-zinc-950 group-hover:text-indigo-600 truncate transition-colors">
                          {user.name}
                        </p>
                        <p className="text-xs/5 text-zinc-400 truncate">{user.position}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs/5 text-zinc-400 mt-6">
          MVP 프로토타입 · 실제 인증 없음
        </p>
      </div>
    </div>
  );
}
