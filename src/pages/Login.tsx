import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { verifyGoogleLogin } from '../utils/authApi';
import type { User } from '../types';
import { Loader2 } from 'lucide-react';
import { MsSettingIcon } from '../components/ui/MsIcons';

const ALLOWED_DOMAIN = 'makestar.com';

export function Login() {
  const { login } = useAuthStore();
  const { users, isLoading: usersLoading } = useTeamStore();
  const { scriptUrl } = useSheetsSyncStore();
  const navigate = useNavigate();

  // scriptUrl 도 없고 구성원도 비어있는 최초 부팅 상태에서만 부트스트랩 모드 노출
  const isSetupMode = users.length === 0 && !usersLoading && !scriptUrl;

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSetupLogin = (credentialResponse: CredentialResponse) => {
    // 부트스트랩: 시트 연동 전에 makestar.com 계정으로 임시 admin 진입
    const cred = credentialResponse.credential;
    if (!cred) { setError('Google 응답이 비어 있습니다.'); return; }
    const claims = decodeJwtPayload(cred);
    if (!claims) { setError('토큰 파싱에 실패했습니다.'); return; }
    if (claims.hd !== ALLOWED_DOMAIN || claims.email_verified !== true) {
      setError(`@${ALLOWED_DOMAIN} 계정으로만 로그인할 수 있습니다.`);
      return;
    }
    const bootstrapAdmin: User = {
      id: 'setup_admin',
      name: claims.name || '초기 관리자',
      email: String(claims.email ?? 'admin@setup.local'),
      role: 'admin',
      department: '관리',
      position: '관리자',
      avatarColor: '#4f46e5',
    };
    login(bootstrapAdmin);
    navigate('/settings');
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const cred = credentialResponse.credential;
    if (!cred) { setError('Google 응답이 비어 있습니다.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await verifyGoogleLogin(cred);

      // R7: 신규 회원 (시트 미등록 → 대기승인 큐) — 빈 페이지로 이동
      if (result.status === 'pending') {
        const pendingUser: User = {
          id: `pending_${result.email}`,
          name: result.name || result.email.split('@')[0],
          email: result.email,
          role: 'member',                // 컴파일 호환 — 권한그룹 미부여
          position: '',
          department: '',                // legacy 필수 필드 호환
          avatarColor: '#9ca3af',
          status: 'pending',
        };
        login(pendingUser);
        navigate('/pending-approval');
        return;
      }

      // 기존 회원 — _구성원 시트의 사번/이메일로 매칭
      const findUser = () =>
        useTeamStore.getState().users.find(
          u => u.id === result.userId || u.email.toLowerCase() === result.email.toLowerCase()
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
      login({ ...user, status: 'active' });
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google 로그인에 실패했습니다.');
  };

  return (
    <div className="min-h-screen bg-gray-010 flex flex-col items-center justify-center p-6">
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
          <h1 className="text-2xl/8 font-semibold text-gray-099 tracking-tight">메이크스타 리뷰시스템</h1>
          <p className="text-sm/6 text-gray-050 mt-1">@{ALLOWED_DOMAIN} 계정으로 로그인하세요</p>
        </div>

        {/* org 동기화 중 안내 */}
        {usersLoading && scriptUrl && (
          <div className="flex items-center gap-2 justify-center py-2 text-xs text-gray-040">
            <Loader2 className="size-3.5 animate-spin" />
            구성원 데이터를 불러오는 중...
          </div>
        )}

        {/* 초기 설정 모드 — 시트 연동 전 부트스트랩 */}
        {isSetupMode && (
          <div className="bg-white rounded-2xl ring-1 ring-yellow-060/20 shadow-sm p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-yellow-005 flex items-center justify-center flex-shrink-0">
                <MsSettingIcon size={16} className="text-yellow-060" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-099">초기 설정이 필요합니다</p>
                <p className="text-xs text-gray-050 mt-0.5 leading-relaxed">
                  Google Sheets 연동이 설정되지 않았습니다.<br />
                  @{ALLOWED_DOMAIN} 계정으로 로그인하여 Apps Script URL을 먼저 등록해 주세요.
                </p>
              </div>
            </div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleSetupLogin}
                onError={handleGoogleError}
                hosted_domain={ALLOWED_DOMAIN}
                text="signin_with"
                theme="outline"
                size="large"
              />
            </div>
          </div>
        )}

        {/* 일반 로그인 — Google 버튼 */}
        {!isSetupMode && (
          <div className="bg-white rounded-2xl ring-1 ring-gray-010 shadow-sm">
            <div className="p-5 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-3 text-sm text-gray-050">
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  로그인 중...
                </div>
              ) : (
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    hosted_domain={ALLOWED_DOMAIN}
                    text="signin_with"
                    theme="outline"
                    size="large"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-050 bg-red-005 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-040 pb-4">
          @{ALLOWED_DOMAIN} 도메인의 구성원만 로그인할 수 있습니다.
        </p>
      </div>
    </div>
  );
}

/** ID Token(JWT) payload base64url 디코드 — 부트스트랩 모드의 도메인 힌트 검증용. */
function decodeJwtPayload(jwt: string): { email?: string; email_verified?: boolean; hd?: string; name?: string } | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}
