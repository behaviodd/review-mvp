import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { verifyLogin } from '../utils/authApi';
import type { User } from '../types';
import { Eye, EyeOff, ChevronDown, Settings2, Loader2 } from 'lucide-react';

/* ── 메인 로그인 페이지 ────────────────────────────────────────────────── */
export function Login() {
  const { login } = useAuthStore();
  const { users, isLoading: usersLoading } = useTeamStore();
  const { scriptUrl } = useSheetsSyncStore();
  const navigate = useNavigate();

  // scriptUrl이 있어도 구성원이 없으면 초기 설정 모드 표시
  const isSetupMode = users.length === 0 && !usersLoading;

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

      // 로컬 users 스토어에서 찾기 — 아직 org sync 중이면 최대 3초 대기
      const findUser = () =>
        useTeamStore.getState().users.find(
          u => u.id === result.userId || u.email.toLowerCase() === email.trim().toLowerCase()
        );

      let user: User | undefined = findUser();
      if (!user && (usersLoading || useTeamStore.getState().isLoading)) {
        await new Promise(r => setTimeout(r, 3000));
        user = findUser();
      }

      if (!user) {
        setError('구성원 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      login(user, result.isTemp);
      navigate('/');
    } catch (e) {
      // verifyLogin이 throw한 실제 원인을 그대로 표시
      setError(e instanceof Error ? e.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /* 체험 계정 로그인 (비밀번호 없음) */
  const handleDemoLogin = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) { login(user); navigate('/'); }
  };

  const { orgUnits } = useTeamStore();
  const headIds = new Set(orgUnits.map(u => u.headId).filter(Boolean));
  const roleGroups = {
    admin:  users.filter(u => u.role === 'admin').slice(0, 2),
    leader: users.filter(u => u.role === 'leader' || (u.role !== 'admin' && headIds.has(u.id))).slice(0, 4),
    member: users.filter(u => u.role === 'member' && !headIds.has(u.id)).slice(0, 4),
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
          <div className="inline-flex items-center justify-center size-12 mb-3">
            <svg className="size-12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#login-clip)">
                <path d="M0 6.4C0 4.15979 0 3.03968 0.435974 2.18404C0.819467 1.43139 1.43139 0.819467 2.18404 0.435974C3.03968 0 4.15979 0 6.4 0H17.6C19.8402 0 20.9603 0 21.816 0.435974C22.5686 0.819467 23.1805 1.43139 23.564 2.18404C24 3.03968 24 4.15979 24 6.4V17.6C24 19.8402 24 20.9603 23.564 21.816C23.1805 22.5686 22.5686 23.1805 21.816 23.564C20.9603 24 19.8402 24 17.6 24H6.4C4.15979 24 3.03968 24 2.18404 23.564C1.43139 23.1805 0.819467 22.5686 0.435974 21.816C0 20.9603 0 19.8402 0 17.6V6.4Z" fill="url(#login-grad)"/>
                <path fillRule="evenodd" clipRule="evenodd" d="M20.3158 10.8307L18.0583 9.51837C17.4989 9.19275 17.1593 8.60071 17.1593 7.95933V5.35436C17.1593 4.30843 16.0205 3.65718 15.1115 4.19002L12.904 5.47277C12.3446 5.79839 11.6454 5.79839 11.076 5.47277L8.87847 4.19002C7.96948 3.66705 6.83074 4.31829 6.83074 5.35436V7.95933C6.83074 8.60071 6.49112 9.19275 5.93174 9.51837L3.67425 10.8307C2.77525 11.3537 2.77525 12.6463 3.67425 13.1693L5.93174 14.4816C6.49112 14.8073 6.83074 15.3993 6.83074 16.0407V18.6456C6.83074 19.6916 7.96948 20.3428 8.87847 19.81L11.086 18.5272C11.6454 18.2016 12.3446 18.2016 12.914 18.5272L15.1215 19.81C16.0305 20.3329 17.1693 19.6817 17.1693 18.6456V16.0407C17.1693 15.3993 17.5089 14.8073 18.0683 14.4816L20.3257 13.1693C21.2247 12.6463 21.2247 11.3537 20.3257 10.8307H20.3158ZM17.1493 12.5772L15.5511 13.5048C15.2614 13.6725 15.0816 13.9883 15.0816 14.3238V16.1788C15.0816 16.6919 14.5122 17.0175 14.0627 16.7511L12.4845 15.8335C12.1848 15.6657 11.8252 15.6657 11.5255 15.8335L9.94728 16.7412C9.48779 17.0077 8.91842 16.682 8.91842 16.1591V14.304C8.91842 13.9685 8.73862 13.6626 8.44895 13.4949L6.85072 12.5674C6.40122 12.3108 6.40122 11.6596 6.85072 11.403L8.44895 10.4755C8.73862 10.3078 8.91842 9.992 8.91842 9.65651V7.81132C8.91842 7.28836 9.48779 6.9726 9.94728 7.22915L11.5255 8.13695C11.8252 8.30469 12.1848 8.30469 12.4845 8.13695L14.0627 7.22915C14.5222 6.96274 15.0916 7.28836 15.0916 7.81132V9.66638C15.0916 10.0019 15.2714 10.3078 15.561 10.4755L17.1593 11.403C17.6088 11.6596 17.6088 12.3108 17.1593 12.5674L17.1493 12.5772Z" fill="white"/>
              </g>
              <defs>
                <radialGradient id="login-grad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24.5 24) rotate(-135) scale(33.9411)">
                  <stop stopColor="#FDAA87"/><stop offset="0.802885" stopColor="#FF558F"/>
                </radialGradient>
                <clipPath id="login-clip"><rect width="24" height="24" fill="white"/></clipPath>
              </defs>
            </svg>
          </div>
          <h1 className="text-2xl/8 font-semibold text-zinc-950 tracking-tight">ReviewFlow</h1>
          <p className="text-sm/6 text-zinc-500 mt-1">이메일과 비밀번호로 로그인하세요</p>
        </div>

        {/* org 동기화 중 안내 */}
        {usersLoading && scriptUrl && (
          <div className="flex items-center gap-2 justify-center py-2 text-xs text-zinc-400">
            <Loader2 className="size-3.5 animate-spin" />
            구성원 데이터를 불러오는 중...
          </div>
        )}

        {/* 초기 설정 모드 배너 */}
        {isSetupMode && !scriptUrl && (
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
              className="w-full py-2 text-sm font-semibold text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                            className="flex items-center gap-2 p-2 rounded-lg border border-zinc-100 hover:border-primary-200 hover:bg-primary-50/50 text-left transition-all group"
                          >
                            <div
                              className="size-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                              style={{ backgroundColor: user.avatarColor }}
                            >
                              {user.name.slice(0, 1)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-zinc-800 truncate group-hover:text-primary-600 transition-colors">
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
