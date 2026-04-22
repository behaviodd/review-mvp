import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { MsLockIcon } from '../ui/MsIcons';
import { useAuthStore } from '../../stores/authStore';
import { changePassword } from '../../utils/authApi';

export function ChangePasswordModal({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { clearMustChangePassword } = useAuthStore();
  const [pw, setPw]             = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const strength = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2 : 3;
  const strengthLabel = ['', '약함', '보통', '강함'];
  const strengthColor = ['', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400'];
  const strengthText  = ['', 'text-rose-500', 'text-amber-500', 'text-emerald-600'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pwConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (pw.length < 6)    { setError('6자 이상 입력해 주세요.'); return; }
    setLoading(true);
    const ok = await changePassword(userId, pw);
    setLoading(false);
    if (!ok) { setError('변경에 실패했습니다. 다시 시도해 주세요.'); return; }
    clearMustChangePassword();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-zinc-950/5 w-full max-w-sm mx-4 p-6 space-y-5">

        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center size-11 bg-amber-100 rounded-xl mb-2">
            <MsLockIcon size={20} className="text-amber-600" />
          </div>
          <h2 className="text-base font-semibold text-zinc-950">비밀번호 변경 필요</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            초기 비밀번호(사번)로 로그인하셨습니다.<br />
            보안을 위해 새 비밀번호를 설정해 주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 새 비밀번호 */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">새 비밀번호</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={e => { setPw(e.target.value); setError(''); }}
                placeholder="6자 이상"
                autoFocus
                className="w-full px-3 py-2 pr-10 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {/* 강도 바 */}
            {pw.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? strengthColor[strength] : 'bg-zinc-100'}`}
                    />
                  ))}
                </div>
                <span className={`text-[11px] font-medium ${strengthText[strength]}`}>
                  {strengthLabel[strength]}
                </span>
              </div>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">비밀번호 확인</label>
            <input
              type={show ? 'text' : 'password'}
              value={pwConfirm}
              onChange={e => { setPwConfirm(e.target.value); setError(''); }}
              placeholder="비밀번호 재입력"
              className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={!pw || !pwConfirm || loading}
            className="w-full py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '저장 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  );
}
