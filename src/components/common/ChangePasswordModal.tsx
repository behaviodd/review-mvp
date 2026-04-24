import { useState } from 'react';
import { MsLockIcon, MsShowIcon, MsHideIcon } from '../ui/MsIcons';
import { MsButton } from '../ui/MsButton';
import { MsInput } from '../ui/MsControl';
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
  const strengthColor = ['', 'bg-red-040', 'bg-yellow-060', 'bg-green-040'];
  const strengthText  = ['', 'text-red-040', 'text-yellow-060', 'text-green-060'];

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
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-gray-010 w-full max-w-sm mx-4 p-6 space-y-5">

        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center size-11 bg-yellow-005 rounded-xl mb-2">
            <MsLockIcon size={20} className="text-yellow-060" />
          </div>
          <h2 className="text-base font-semibold text-gray-099">비밀번호 변경 필요</h2>
          <p className="text-xs text-gray-050 leading-relaxed">
            초기 비밀번호(사번)로 로그인하셨습니다.<br />
            보안을 위해 새 비밀번호를 설정해 주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 새 비밀번호 */}
          <div>
            <MsInput
              label="새 비밀번호"
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={e => { setPw(e.target.value); setError(''); }}
              placeholder="6자 이상"
              autoFocus
              rightSlot={
                <button type="button" onClick={() => setShow(v => !v)} className="text-gray-040 hover:text-gray-060">
                  {show ? <MsHideIcon size={16} /> : <MsShowIcon size={16} />}
                </button>
              }
            />
            {/* 강도 바 */}
            {pw.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? strengthColor[strength] : 'bg-gray-010'}`}
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
          <MsInput
            label="비밀번호 확인"
            type={show ? 'text' : 'password'}
            value={pwConfirm}
            onChange={e => { setPwConfirm(e.target.value); setError(''); }}
            placeholder="비밀번호 재입력"
          />

          {error && (
            <p className="text-xs text-red-050 bg-red-005 px-3 py-2 rounded-lg">{error}</p>
          )}

          <MsButton
            type="submit"
            disabled={!pw || !pwConfirm}
            loading={loading}
            className="w-full"
          >
            비밀번호 변경
          </MsButton>
        </form>
      </div>
    </div>
  );
}
