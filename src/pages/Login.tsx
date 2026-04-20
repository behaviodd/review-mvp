import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { verifyLogin } from '../utils/authApi';
import type { User } from '../types';
import { Star, Eye, EyeOff, ChevronDown, Settings2 } from 'lucide-react';

/* ── 메인 로그인 페이지 ────────────────────────────────────────────────── */
export function Login() {
  const { login } = useAuthStore();
  const { users } = useTeamStore();
  const { scriptUrl } = useSheetsSyncStore();
  const navigate = useNavigate();

  // Google Sheets 미연결 + 구성원 없음 → 초기 설정 모드
  const isSetupMode = !scriptUrl && users.length === 0;

  const handleSetupLogin = () => {
    const bootstrapAdmin: User = {
      id: 'setup_admin',
      name: '초기 관리자',
      email: 'admin@setup.local',
      role: 'admin',
      department: '관리',
      position: '관리자',
      avatarColor: '#4f46e5',
    };
    login(bootstrapAdmin);
    navigate('/settings');
  };

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showDemo, setShowDemo] = useState(false);

  /* 이메일 + 비밀번호 로그인 */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const result = await verifyLogin(email.trim(), password);
      if (!result) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        return;
      }
      const user = users.find(u => u.id === result.userId || u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user) {
        setError('계정을 찾을 수 없습니다. 관리자에게 문의하세요.');
        return;
      }
      login(user, result.isTemp);
      navigate('/');
    } catch {
      setError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  /* 체험 계정 로그인 (비밀번호 없음) */
  const handleDemoLogin = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) { login(user); navigate('/'); }
  };

  const roleGroups = {
    admin:    users.filter(u => u.role === 'admin').slice(0, 2),
    leader: users.filter(u => u.role === 'leader').slice(0, 4),
    member: users.filter(u => u.role === 'member').slice(0, 4),
  };
  const roleMeta = {
    admin:  { label: '관리자', desc: '리뷰 운영 · 전체 현황' },
    leader: { label: '조직장',   desc: '팀원 평가 · 팀 현황' },
    member: { label: '팀원',   desc: '셀프 리뷰 · 피드백' },
  };

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3">

        {/* 브랜드 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-10 bg-indigo-600 rounded-xl mb-3">
            <Star size={18} className="text-white" />
          </div>
          <h1 className="text-2xl/8 font-semibold text-zinc-950 tracking-tight">ReviewFlow</h1>
          <p className="text-sm/6 text-zinc-500 mt-1">이메일과 비밀번호로 로그인하세요</p>
        </div>

        {/* 초기 설정 모드 배너 */}
        {isSetupMode && (
          <div className="bg-white rounded-2xl ring-1 ring-amber-200 shadow-sm p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Settings2 className="size-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">초기 설정이 필요합니다</p>
                <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
                  Google Sheets 연동이 설정되지 않았습니다.<br />
                  설정 모드로 진입해 Apps Script URL을 먼저 등록해 주세요.
                </p>
              </div>
            </div>
            <button
              onClick={handleSetupLogin}
              className="w-full py-2 text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              설정 모드로 진입
            </button>
          </div>
        )}

        {/* 로그인 폼 */}
        <div className="bg-white rounded-2xl ring-1 ring-zinc-950/5 shadow-sm">
          <form onSubmit={handleLogin} className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="name@company.com"
                autoComplete="email"
                autoFocus
                className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white focus:border-zinc-950/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="비밀번호 (초기: 사번)"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 pr-10 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white focus:border-zinc-950/20 transition-all"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors">
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={!email.trim() || !password || loading}
              className="w-full py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        {/* 체험 계정 섹션 */}
        <div className="bg-white rounded-2xl ring-1 ring-zinc-950/5 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowDemo(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            <span>체험 계정으로 둘러보기</span>
            <ChevronDown className={`size-4 transition-transform duration-200 ${showDemo ? 'rotate-180' : ''}`} />
          </button>

          {showDemo && (
            <div className="border-t border-zinc-100 px-4 pb-4">
              {users.length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">
                  구성원 데이터가 없습니다.<br />
                  Google Sheets 연동 후 사용 가능합니다.
                </p>
              ) : (
                (['admin', 'leader', 'member'] as const).map(role => {
                  const group = roleGroups[role];
                  if (group.length === 0) return null;
                  const { label, desc } = roleMeta[role];
                  return (
                    <div key={role} className="mt-3 first:mt-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[11px] font-semibold text-zinc-500">{label}</span>
                        <span className="text-[11px] text-zinc-300">·</span>
                        <span className="text-[11px] text-zinc-400">{desc}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {group.map(user => (
                          <button
                            key={user.id}
                            onClick={() => handleDemoLogin(user.id)}
                            className="flex items-center gap-2 p-2 rounded-lg border border-zinc-100 hover:border-indigo-200 hover:bg-indigo-50/50 text-left transition-all group"
                          >
                            <div
                              className="size-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                              style={{ backgroundColor: user.avatarColor }}
                            >
                              {user.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-zinc-800 truncate group-hover:text-indigo-700 transition-colors">
                                {user.name}
                              </p>
                              <p className="text-[11px] text-zinc-400 truncate">{user.position}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-zinc-400 pb-4">
          초기 비밀번호는 사번입니다. 분실 시 관리자에게 초기화를 요청하세요.
        </p>
      </div>
    </div>
  );
}
