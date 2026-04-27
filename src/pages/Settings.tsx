import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { useTeamStore } from '../stores/teamStore';
import { useOrgSync } from '../hooks/useOrgSync';
import { useReviewSync } from '../hooks/useReviewSync';
import { useReviewStore } from '../stores/reviewStore';
import { useShowToast } from '../components/ui/Toast';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Shield, Sheet } from 'lucide-react';
import { MsProfileIcon, MsCheckCircleIcon, MsCancelIcon, MsRefreshIcon, MsInfoIcon, MsChevronDownLineIcon, MsShowIcon, MsHideIcon } from '../components/ui/MsIcons';
import { MsSwitch, MsInput } from '../components/ui/MsControl';
import { verifyLogin, changePassword, batchInitAccounts } from '../utils/authApi';
import { MsButton } from '../components/ui/MsButton';
import { SyncRetryDrawer } from '../components/review/SyncRetryDrawer';
import { timeAgo } from '../utils/dateUtils';


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
  const strengthColor = ['', 'bg-red-040', 'bg-yellow-060', 'bg-green-040'];

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

  return (
    <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-040" />
          <h2 className="text-sm font-semibold text-gray-080">개인정보 및 보안</h2>
        </div>
        <MsChevronDownLineIcon size={16} className={`text-gray-040 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-040 uppercase tracking-wide">비밀번호 변경</p>

          {/* 현재 비밀번호 */}
          <MsInput
            label="현재 비밀번호"
            type={show ? 'text' : 'password'}
            value={form.current}
            onChange={e => { setForm(f => ({ ...f, current: e.target.value })); setError(''); }}
            placeholder="현재 비밀번호"
            autoComplete="current-password"
            rightSlot={
              <button type="button" onClick={() => setShow(v => !v)} className="text-gray-040 hover:text-gray-060">
                {show ? <MsHideIcon size={16} /> : <MsShowIcon size={16} />}
              </button>
            }
          />

          {/* 새 비밀번호 */}
          <div>
            <MsInput
              label="새 비밀번호"
              type={show ? 'text' : 'password'}
              value={form.next}
              onChange={e => { setForm(f => ({ ...f, next: e.target.value })); setError(''); }}
              placeholder="새 비밀번호 (6자 이상)"
              autoComplete="new-password"
            />
            {form.next.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${strength >= i ? strengthColor[strength] : 'bg-gray-010'}`} />
                  ))}
                </div>
                <span className={`text-[11px] font-medium ${strength === 1 ? 'text-red-040' : strength === 2 ? 'text-yellow-060' : 'text-green-060'}`}>
                  {strengthLabel[strength]}
                </span>
              </div>
            )}
          </div>

          {/* 새 비밀번호 확인 */}
          <MsInput
            label="새 비밀번호 확인"
            type={show ? 'text' : 'password'}
            value={form.confirm}
            onChange={e => { setForm(f => ({ ...f, confirm: e.target.value })); setError(''); }}
            placeholder="새 비밀번호 재입력"
            autoComplete="new-password"
          />

          {error && <p className="text-xs text-red-050 bg-red-005 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <MsButton type="button" variant="ghost" size="sm" onClick={reset}>취소</MsButton>
            <MsButton
              type="submit"
              size="sm"
              disabled={!form.current || !form.next || !form.confirm}
              loading={loading}
            >
              비밀번호 변경
            </MsButton>
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
    pendingOps, lastSuccessAt,
  } = useSheetsSyncStore();
  const { users, isLoading: orgLoading } = useTeamStore();
  const { cycles, templates, submissions, isLoading: reviewLoading } = useReviewStore();
  const { refetch: refetchOrg } = useOrgSync();
  const { refetch: refetchReview } = useReviewSync();
  const [urlDraft, setUrlDraft] = useState(scriptUrl);
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);

  useSetPageHeader('설정');
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
      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <MsProfileIcon size={16} className="text-gray-040" />
          <h2 className="text-sm font-semibold text-gray-080">프로필</h2>
        </div>
        <div className="flex items-center gap-4">
          <UserAvatar user={currentUser} size="xl" />
          <div>
            <p className="text-lg font-semibold text-gray-099">{currentUser.name}</p>
            <p className="text-sm text-gray-050">{currentUser.position}</p>
            <p className="text-xs text-gray-040">{currentUser.department} · {currentUser.email}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-005 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-060">역할</p>
            <p className="text-sm text-gray-080 mt-0.5">
              {currentUser.role === 'admin' ? '관리자' : currentUser.role === 'leader' ? '조직장' : '팀원'}
            </p>
          </div>
          <MsButton variant="outline-default" size="sm" disabled title="프로필 편집은 아직 지원되지 않습니다">편집</MsButton>
        </div>
      </div>

      {/* Privacy */}
      <PasswordChangeSection />

      {/* Google Sheets 연동 (관리자 전용) */}
      {currentUser.role === 'admin' && (
      <div className="bg-white rounded-xl border border-gray-010 shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sheet className="w-4 h-4 text-gray-040" />
          <h2 className="text-sm font-semibold text-gray-080">Google Sheets 연동</h2>
        </div>

        <div className="space-y-5">
          {/* Apps Script URL */}
          <div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <MsInput
                  label="Apps Script 웹앱 URL"
                  size="sm"
                  type="url"
                  value={urlDraft}
                  onChange={e => { setUrlDraft(e.target.value); setTestState('idle'); }}
                  placeholder="https://script.google.com/macros/s/…/exec"
                  rightSlot={
                    testState === 'ok' ? <MsCheckCircleIcon size={16} className="text-green-040" /> :
                    testState === 'fail' ? <MsCancelIcon size={16} className="text-red-040" /> :
                    undefined
                  }
                />
              </div>
              <MsButton
                variant="outline-default"
                size="sm"
                onClick={handleTest}
                loading={testState === 'testing'}
              >
                연결 테스트
              </MsButton>
            </div>
            {/* 개발 환경 설정 안내 */}
            <div className="mt-2 flex gap-1.5 bg-yellow-005 border border-yellow-060/20 rounded-lg px-3 py-2">
              <MsInfoIcon size={12} className="text-yellow-060 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-070 leading-relaxed">
                <span className="font-medium">로컬 개발:</span>{' '}
                프로젝트 루트에 <code className="bg-yellow-060/10 px-1 rounded">.env.local</code> 파일을 만들고{' '}
                <code className="bg-yellow-060/10 px-1 rounded">APPS_SCRIPT_URL=위의 URL</code> 을 추가한 뒤 서버를 재시작하세요.
                <br />
                <span className="font-medium">배포:</span>{' '}
                Vercel 대시보드 → Settings → Environment Variables 에 <code className="bg-yellow-060/10 px-1 rounded">APPS_SCRIPT_URL</code> 을 등록하세요.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-005 pt-4 space-y-4">
            {/* ── 조직 데이터 동기화 ── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-080">조직 데이터 자동 동기화</p>
                <p className="text-xs text-gray-040 mt-0.5">구성원 시트 → 팀 구성 화면 반영 (60초 주기)</p>
              </div>
              <MsSwitch checked={orgSyncEnabled} onChange={setOrgSyncEnabled} />
            </div>

            {orgSyncEnabled && (
              <div className="bg-gray-005 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div>
                  {orgSyncError ? (
                    <p className="text-xs text-red-040 flex items-center gap-1">
                      <MsCancelIcon size={12} className="shrink-0" /> {orgSyncError}
                    </p>
                  ) : orgLastSyncedAt ? (
                    <p className="text-xs text-green-060 flex items-center gap-1">
                      <MsCheckCircleIcon size={12} className="shrink-0" />
                      {formatSyncTime(orgLastSyncedAt)} · 구성원 {users.length}명
                    </p>
                  ) : (
                    <p className="text-xs text-gray-040">아직 동기화된 기록이 없습니다.</p>
                  )}
                </div>
                <button onClick={refetchOrg} disabled={orgLoading} title="지금 동기화"
                  className="p-1 rounded-md text-gray-040 hover:text-gray-070 hover:bg-gray-010 disabled:opacity-40 transition-colors">
                  <MsRefreshIcon size={12} className={`${orgLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* ── 리뷰 운영 데이터 동기화 ── */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-080">리뷰 운영 데이터 자동 동기화</p>
                <p className="text-xs text-gray-040 mt-0.5">리뷰·템플릿·제출내용 시트 ↔ 앱 (5분 주기)</p>
              </div>
              <MsSwitch checked={reviewSyncEnabled} onChange={setReviewSyncEnabled} />
            </div>

            {reviewSyncEnabled && (
              <div className="bg-gray-005 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <div>
                  {reviewSyncError ? (
                    <p className="text-xs text-red-040 flex items-center gap-1">
                      <MsCancelIcon size={12} className="shrink-0" /> {reviewSyncError}
                    </p>
                  ) : reviewLastSyncedAt ? (
                    <p className="text-xs text-green-060 flex items-center gap-1">
                      <MsCheckCircleIcon size={12} className="shrink-0" />
                      {formatSyncTime(reviewLastSyncedAt)} · 리뷰 {cycles.length}개 · 템플릿 {templates.length}개 · 제출 {submissions.length}건
                    </p>
                  ) : (
                    <p className="text-xs text-gray-040">아직 동기화된 기록이 없습니다.</p>
                  )}
                </div>
                <button onClick={refetchReview} disabled={reviewLoading} title="지금 동기화"
                  className="p-1 rounded-md text-gray-040 hover:text-gray-070 hover:bg-gray-010 disabled:opacity-40 transition-colors">
                  <MsRefreshIcon size={12} className={`${reviewLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* ── 쓰기 큐 상태 (경로 A) ── */}
            <div className="flex items-start justify-between gap-3 pt-1">
              <div className="min-w-0">
                <p className="text-sm text-gray-080">쓰기 큐 상태</p>
                <p className="text-xs text-gray-040 mt-0.5">
                  리뷰 저장·리마인드 등 쓰기 실패가 생기면 여기에 쌓입니다.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${pendingOps.filter(o => o.tryCount > 0).length > 0 ? 'bg-red-005 text-red-070' : pendingOps.length > 0 ? 'bg-orange-005 text-orange-070' : 'bg-green-005 text-green-070'}`}>
                    대기 {pendingOps.length}건 · 실패 {pendingOps.filter(o => o.tryCount > 0).length}건
                  </span>
                  <span className="text-gray-050">
                    {lastSuccessAt ? `마지막 성공: ${timeAgo(lastSuccessAt)}` : '성공 이력 없음'}
                  </span>
                </div>
              </div>
              <MsButton
                variant="outline-default"
                size="sm"
                onClick={() => setSyncDrawerOpen(true)}
              >
                동기화 상태 열기
              </MsButton>
            </div>

          </div>

          {/* 저장 / 계정 일괄 초기화 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {scriptUrl && (
                <button
                  onClick={handleBatchInitAccounts}
                  disabled={batchInitState === 'loading'}
                  className="px-3 py-2 text-xs font-semibold text-yellow-070 bg-yellow-005 border border-yellow-060/20 rounded-lg hover:bg-yellow-060/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {batchInitState === 'loading' ? '처리 중...' : '계정 일괄 초기화'}
                </button>
              )}
              {scriptUrl && (
                <p className="text-[11px] text-gray-040">시트에서 가져온 구성원의 초기 비밀번호를 사번으로 설정</p>
              )}
            </div>
            <MsButton onClick={handleSaveUrl} disabled={urlDraft.trim() === scriptUrl} size="sm">저장</MsButton>
          </div>
        </div>
      </div>
      )}

      <p className="text-center text-xs text-gray-030 pb-4">메이크스타 리뷰시스템 v0.1.0 · 프로토타입</p>

      <SyncRetryDrawer open={syncDrawerOpen} onClose={() => setSyncDrawerOpen(false)} />
    </div>
  );
}
