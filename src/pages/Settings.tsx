import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { useShowToast } from '../components/ui/Toast';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Bell, User, Shield, Moon, Sheet, CheckCircle2, XCircle } from 'lucide-react';
import { Switch } from '../components/catalyst/switch';

interface Toggle {
  label: string;
  desc: string;
  key: string;
}

const NOTIF_TOGGLES: Toggle[] = [
  { label: '마감 임박 알림', desc: '자기평가·리뷰 마감 3일 전 알림', key: 'deadline' },
  { label: '피드백 수신 알림', desc: '새 피드백을 받았을 때 알림', key: 'feedback' },
  { label: '독촉 알림 (매니저)', desc: '미제출 팀원 독촉 발송 알림', key: 'nudge' },
];

export function Settings() {
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();
  const { scriptUrl, enabled, setScriptUrl, setEnabled } = useSheetsSyncStore();
  const [urlDraft, setUrlDraft] = useState(scriptUrl);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');

  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>({
    deadline: true,
    feedback: true,
    nudge: false,
  });

  const handleSaveUrl = () => {
    setScriptUrl(urlDraft.trim());
    showToast('Apps Script URL이 저장되었습니다.', 'success');
    setTestState('idle');
  };

  const handleTest = async () => {
    const url = urlDraft.trim();
    if (!url) { showToast('URL을 먼저 입력해주세요.', 'info'); return; }
    setTestState('testing');
    try {
      // no-cors 방식은 응답을 읽을 수 없으므로 fetch 자체 성공 = URL 도달 가능으로 판단
      await fetch(url, { method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'ping' }) });
      setTestState('ok');
      showToast('연결되었습니다. 시트를 확인해 주세요.', 'success');
    } catch {
      setTestState('fail');
      showToast('URL에 연결할 수 없습니다.', 'error');
    }
  };

  const toggleNotif = (key: string) => {
    setNotifToggles(t => ({ ...t, [key]: !t[key] }));
  };

  if (!currentUser) return null;


  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-900">설정</h1>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-700">프로필</h2>
        </div>
        <div className="flex items-center gap-4">
          <UserAvatar user={currentUser} size="xl" />
          <div>
            <p className="text-lg font-semibold text-neutral-900">{currentUser.name}</p>
            <p className="text-sm text-neutral-500">{currentUser.position}</p>
            <p className="text-xs text-neutral-400">{currentUser.department} · {currentUser.email}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-neutral-50 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-neutral-600">역할</p>
            <p className="text-sm text-neutral-800 mt-0.5">
              {currentUser.role === 'admin' ? '관리자' : currentUser.role === 'manager' ? '팀장' : '팀원'}
            </p>
          </div>
          <button
            disabled
            title="프로필 편집은 아직 지원되지 않습니다"
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 border border-neutral-100 rounded cursor-not-allowed bg-neutral-50"
          >
            편집
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-700">알림 설정</h2>
        </div>
        <div className="space-y-4">
          {NOTIF_TOGGLES.map(({ label, desc, key }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-800">{label}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
              </div>
              <Switch checked={notifToggles[key]} onChange={() => toggleNotif(key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-700">화면 설정</h2>
        </div>
        <div className="flex items-center justify-between opacity-40 cursor-not-allowed">
          <div>
            <p className="text-sm text-neutral-800">다크 모드</p>
            <p className="text-xs text-neutral-400 mt-0.5">곧 지원 예정입니다</p>
          </div>
          <Switch checked={false} onChange={() => {}} disabled />
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-700">개인정보 및 보안</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: '비밀번호 변경', action: '변경' },
            { label: '2단계 인증', action: '설정' },
            { label: '데이터 내보내기', action: '내보내기' },
          ].map(({ label, action }) => (
            <div key={label} className="flex items-center justify-between py-1">
              <p className="text-sm text-neutral-800">{label}</p>
              <button
                disabled
                title="아직 지원되지 않는 기능입니다"
                className="text-xs font-medium text-neutral-300 cursor-not-allowed"
              >
                {action}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Google Sheets 연동 */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sheet className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-700">Google Sheets 연동</h2>
        </div>

        <div className="space-y-4">
          {/* 자동 동기화 토글 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-800">실시간 자동 동기화</p>
              <p className="text-xs text-neutral-400 mt-0.5">평가 제출 시 시트에 자동 반영</p>
            </div>
            <Switch checked={enabled} onChange={(v) => setEnabled(v)} />
          </div>

          {/* Apps Script URL */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">
              Apps Script 웹앱 URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  value={urlDraft}
                  onChange={e => { setUrlDraft(e.target.value); setTestState('idle'); }}
                  placeholder="https://script.google.com/macros/s/…/exec"
                  className="w-full px-3 py-2 border border-neutral-200 rounded bg-neutral-50 text-xs text-neutral-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white pr-8"
                />
                {testState === 'ok' && (
                  <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-success-500" />
                )}
                {testState === 'fail' && (
                  <XCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-danger-500" />
                )}
              </div>
              <button
                onClick={handleTest}
                disabled={testState === 'testing'}
                className="px-3 py-2 text-xs font-medium text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {testState === 'testing' ? '확인 중…' : '연결 테스트'}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">
              Google Sheets → 확장 프로그램 → Apps Script에서 배포 후 URL을 붙여넣으세요.
            </p>
          </div>

          {/* 저장 버튼 */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveUrl}
              disabled={urlDraft.trim() === scriptUrl}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-neutral-300 pb-4">ReviewFlow MVP v0.1.0 · 프로토타입</p>
    </div>
  );
}
