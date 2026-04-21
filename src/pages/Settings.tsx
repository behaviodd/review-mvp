import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { useTeamStore } from '../stores/teamStore';
import { useOrgSync } from '../hooks/useOrgSync';
import { useReviewSync } from '../hooks/useReviewSync';
import { useReviewStore } from '../stores/reviewStore';
import { useShowToast } from '../components/ui/Toast';
import { UserAvatar } from '../components/ui/UserAvatar';
import { User, Shield, Sheet, CheckCircle2, XCircle, RefreshCw, Info, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Switch } from '../components/catalyst/switch';
import { verifyLogin, changePassword, batchInitAccounts } from '../utils/authApi';


/* ── 비밀번호 변경 섹션 ──────────────────────────────────────────────── */
function PasswordChangeSection() {
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = form.next.length === 0 ? 0 : form.next.length < 6 ? 1 : form.next.length < 10 ? 2 : 3;
  const strengthLabel = ['', '약함', '보통', '강함'];
  const strengthColor = ['', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400'];

  const reset = () => { setForm({ current: '', next: '', confirm: '' }); setError(''); setOpen(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (form.next !== form.confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return; }
    if (form.next.length < 6)      { setError('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (form.current === form.next) { setError('현재 비밀번호와 다른 비밀번호를 사용해 주세요.'); return; }

    setLoading(true);
    setError('');
    try {
      const verified = await verifyLogin(currentUser.email, form.current);
      if (!verified) { setError('현재 비밀번호가 올바르지 않습니다.'); return; }
      const ok = await changePassword(currentUser.id, form.next);
      if (!ok) { setError('변경에 실패했습니다. 다시 시도해 주세요.'); return; }
      showToast('success', '비밀번호가 변경되었습니다.');
      reset();
    } finally {
      setLoading(false);
    }
  };

  const inp = 'w-full px-3 py-2 pr-10 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white';

  return (
    <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-700">개인정보 및 보안</h2>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">비밀번호 변경</p>

          {/* 현재 비밀번호 */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">현재 비밀번호</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={form.current}
                onChange={e => { setForm(f => ({ ...f, current: e.target.value })); setError(''); }}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
                className={inp}
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* 새 비밀번호 */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">새 비밀번호</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={form.next}
                onChange={e => { setForm(f => ({ ...f, next: e.target.value })); setError(''); }}
                placeholder="새 비밀번호 (6자 이상)"
                autoComplete="new-password"
                className={inp}
              />
            </div>
            {form.next.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? strengthColor[strength] : 'bg-zinc-100'}`} />
                  ))}
                </div>
                <span className={`text-[11px] font-medium ${strength === 1 ? 'text-rose-500' : strength === 2 ? 'text-amber-500' : 'text-emerald-600'}`}>
                  {strengthLabel[strength]}
                </span>
              </div>
            )}
          </div>

          {/* 새 비밀번호 확인 */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">새 비밀번호 확인</label>
            <input
              type={show ? 'text' : 'password'}
              value={form.confirm}
              onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setError(''); }}
              placeholder="새 비밀번호 재입력"
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-zinc-950/10 rounded-lg bg-zinc-50 focus:outline-none focus:ring-4 focus:ring-zinc-950/5 focus:bg-white"
            />
          </div>

          {error && <p className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={reset}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900">
              취소
            </button>
            <button
              type="submit"
              disabled={!form.current || !form.next || !form.confirm || loading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function Settings() {
  const { currentUser } = useAuthStore();
  const showToast = useShowToast();
  const {
    scriptUrl, setScriptUrl,
    orgSyncEnabled, setOrgSyncEnabled,
    orgLastSyncedAt, orgSyncError,
    reviewSyncEnabled, setReviewSyncEnabled,
    reviewLastSyncedAt, reviewSyncError,
  } = useSheetsSyncStore();
  const { users, isLoading: orgLoading } = useTeamStore();
  const { cycles, templates, submissions, isLoading: reviewLoading } = useReviewStore();
  const { refetch: refetchOrg } = useOrgSync();
  const { refetch: refetchReview } = useReviewSync();
  const [urlDraft, setUrlDraft] = useState(scriptUrl);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [batchInitState, setBatchInitState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');

  const handleBatchInitAccounts = async () => {
    setBatchInitState('loading');
    const result = await batchInitAccounts();
    setBatchInitState(result.ok ? 'ok' : 'fail');
    if (result.ok) {
      showToast('success', `계정 일괄 초기화 완료 — ${result.created}명 신규 등록`);
    } else {
      showToast('error', '계정 초기화에 실패했습니다. Apps Script URL을 확인해 주세요.');
    }
    setTimeout(() => setBatchInitState('idle'), 3000);
  };

  const handleSaveUrl = () => {
    setScriptUrl(urlDraft.trim());
    showToast('success', 'Apps Script URL이 저장되었습니다. 동기화를 시작합니다...');
    setTestState('idle');
    setTimeout(() => { refetchOrg(); refetchReview(); }, 100);
  };

  const handleTest = async () => {
    setTestState('testing');
    try {
      const headers: Record<string, string> = {};
      const url = urlDraft.trim();
      if (url.startsWith('https://script.google.com/')) headers['X-Script-Url'] = url;
      const res = await fetch('/api/org-sync?action=getOrg', { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { rows?: unknown[]; users?: unknown[]; error?: string };
      if (data.error) throw new Error(data.error);
      const rows = data.rows ?? data.users;
      if (!Array.isArray(rows)) throw new Error('응답 형식 오류');
      setTestState('ok');
      showToast('success', `연결 성공! 구성원 ${rows.length}명 확인`);
    } catch (e) {
      setTestState('fail');
      showToast('error', `연결 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  };

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} 동기화됨`;
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-neutral-900">설정</h1>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
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
              {currentUser.role === 'admin' ? '관리자' : currentUser.role === 'leader' ? '조직장' : '팀원'}
            </p>
          </div>
          <button
            disabled
            title="프로필 편집은 아직 지원되지 않습니다"
            className="px-3 py-1.5 text-xs font-medium text-neutral-300 border border-neutral-100 rounded-lg cursor-not-allowed bg-neutral-50"
          >
            편집
          </button>
        </div>
      </div>

      {/* Privacy */}
      <PasswordChangeSection />

      {/* Google Sheets 연동 (관리자 전용) */}
      {currentUser.role === 'admin' && (
      <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sheet className="w-4 h-4 text-neutral-400" />
          <h2 className="text-sm font-semibold text-neutral-700">Google Sheets 연동</h2>
        </div>

        <div className="space-y-5">
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
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg bg-neutral-50 text-xs text-neutral-700 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 focus:bg-white pr-8"
                />
                {testState === 'ok' && (
                  <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                )}
                {testState === 'fail' && (
                  <XCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-500" />
                )}
              </div>
              <button
                onClick={handleTest}
                disabled={testState === 'testing'}
                className="px-3 py-2 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {testState === 'testing' ? '확인 중…' : '연결 테스트'}
              </button>
            </div>
            {/* 개발 환경 설정 안내 */}
            <div className="mt-2 flex gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                <span className="font-medium">로컬 개발:</span>{' '}
                프로젝트 루트에 <code className="bg-amber-100 px-1 rounded">.env.local</code> 파일을 만들고{' '}
                <code className="bg-amber-100 px-1 rounded">APPS_SCRIPT_URL=위의 URL</code> 을 추가한 뒤 서버를 재시작하세요.
                <br />
                <span className="font-medium">배포:</span>{' '}
                Vercel 대시보드 → Settings → Environment Variables 에 <code className="bg-amber-100 px-1 rounded">APPS_SCRIPT_URL</code> 을 등록하세요.
              </p>
            </div>
          </div>

          <div className="border-t border-neutral-50 pt-4 space-y-4">
            {/* ── 조직 데이터 동기화 ── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-800">조직 데이터 자동 동기화</p>
                <p className="text-xs text-neutral-400 mt-0.5">구성원 시트 → 팀 구성 화면 반영 (60초 주기)</p>
              </div>
              <Switch checked={orgSyncEnabled} onChange={setOrgSyncEnabled} />
            </div>

            {orgSyncEnabled && (
              <div className="bg-zinc-50 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div>
                  {orgSyncError ? (
                    <p className="text-xs text-rose-500 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 shrink-0" /> {orgSyncError}
                    </p>
                  ) : orgLastSyncedAt ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      {formatSyncTime(orgLastSyncedAt)} · 구성원 {users.length}명
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-400">아직 동기화된 기록이 없습니다.</p>
                  )}
                </div>
                <button onClick={refetchOrg} disabled={orgLoading} title="지금 동기화"
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${orgLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* ── 리뷰 운영 데이터 동기화 ── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-800">리뷰 운영 데이터 자동 동기화</p>
                <p className="text-xs text-neutral-400 mt-0.5">리뷰·템플릿·제출내용 시트 ↔ 앱 (5분 주기)</p>
              </div>
              <Switch checked={reviewSyncEnabled} onChange={setReviewSyncEnabled} />
            </div>

            {reviewSyncEnabled && (
              <div className="bg-zinc-50 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div>
                  {reviewSyncError ? (
                    <p className="text-xs text-rose-500 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 shrink-0" /> {reviewSyncError}
                    </p>
                  ) : reviewLastSyncedAt ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      {formatSyncTime(reviewLastSyncedAt)} · 리뷰 {cycles.length}개 · 템플릿 {templates.length}개 · 제출 {submissions.length}건
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-400">아직 동기화된 기록이 없습니다.</p>
                  )}
                </div>
                <button onClick={refetchReview} disabled={reviewLoading} title="지금 동기화"
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${reviewLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

          </div>

          {/* 저장 / 계정 일괄 초기화 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {scriptUrl && (
                <button
                  onClick={handleBatchInitAccounts}
                  disabled={batchInitState === 'loading'}
                  className="px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {batchInitState === 'loading' ? '처리 중...' : '계정 일괄 초기화'}
                </button>
              )}
              {scriptUrl && (
                <p className="text-[11px] text-neutral-400">시트에서 가져온 구성원의 초기 비밀번호를 사번으로 설정</p>
              )}
            </div>
            <button
              onClick={handleSaveUrl}
              disabled={urlDraft.trim() === scriptUrl}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </div>
      )}

      <p className="text-center text-xs text-neutral-300 pb-4">ReviewFlow MVP v0.1.0 · 프로토타입</p>
    </div>
  );
}
