import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import { useTeamStore } from '../stores/teamStore';
import { refetchOrg, refetchReview } from '../utils/syncControl';
import { useReviewStore } from '../stores/reviewStore';
import { useShowToast } from '../components/ui/Toast';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Sheet } from 'lucide-react';
import { MsProfileIcon, MsCheckCircleIcon, MsCancelIcon, MsRefreshIcon, MsInfoIcon } from '../components/ui/MsIcons';
import { MsSwitch, MsInput } from '../components/ui/MsControl';
import { MsButton } from '../components/ui/MsButton';
import { SyncRetryDrawer } from '../components/review/SyncRetryDrawer';
import { timeAgo } from '../utils/dateUtils';
import { syncAccounts } from '../utils/authApi';
import { getSetting, setSetting } from '../utils/settingsApi';

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
  const [urlDraft, setUrlDraft] = useState(scriptUrl);
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);

  useSetPageHeader('설정');
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [syncAccountsState, setSyncAccountsState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');

  // R8: 자동 승인 토글. null = 로딩 중 / 미연결, 'unknown' = 조회 실패 (UI 비활성)
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [autoApproveSaving, setAutoApproveSaving] = useState(false);
  useEffect(() => {
    if (!scriptUrl) { setAutoApprove(null); return; }
    let cancelled = false;
    void getSetting('auto_approve_domain')
      .then(v => { if (!cancelled) setAutoApprove(v === 'true'); })
      .catch(() => { if (!cancelled) setAutoApprove(false); /* 시트 없거나 통신 실패 — OFF 로 표시 */ });
    return () => { cancelled = true; };
  }, [scriptUrl]);

  const handleToggleAutoApprove = async (next: boolean) => {
    if (!currentUser || autoApprove === null) return;
    setAutoApproveSaving(true);
    const prev = autoApprove;
    setAutoApprove(next);  // 낙관적 갱신
    try {
      await setSetting({ key: 'auto_approve_domain', value: String(next), modifierId: currentUser.id });
      showToast('success', next ? '자동 승인 ON — 신규 로그인 즉시 활성화됩니다' : '자동 승인 OFF — 승인 대기 큐로 전환');
    } catch (e) {
      setAutoApprove(prev);
      showToast('error', '저장 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
    } finally {
      setAutoApproveSaving(false);
    }
  };

  const handleSyncAccounts = async () => {
    setSyncAccountsState('loading');
    const result = await syncAccounts();
    setSyncAccountsState(result.ok ? 'ok' : 'fail');
    if (result.ok) {
      showToast('success', `_계정 시트 동기화 완료 — ${result.created}명 신규 추가`);
    } else {
      showToast('error', '_계정 시트 동기화에 실패했습니다. Apps Script URL을 확인해 주세요.');
    }
    setTimeout(() => setSyncAccountsState('idle'), 3000);
  };

  const handleSaveUrl = () => {
    setScriptUrl(urlDraft.trim());
    showToast('success', 'Apps Script URL이 저장되었습니다. 동기화를 시작합니다...');
    setTestState('idle');
    setTimeout(() => { void refetchOrg({ force: true }); void refetchReview({ force: true }); }, 100);
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
    <div className="divide-y divide-bd-default">
      {/* Profile */}
      <section className="py-6 first:pt-0">
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
      </section>

      {/* Google Sheets 연동 (관리자 전용) */}
      {currentUser.role === 'admin' && (
      <section className="py-6">
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
                <button onClick={() => refetchOrg({ force: true })} disabled={orgLoading} title="지금 동기화"
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
                <button onClick={() => refetchReview({ force: true })} disabled={reviewLoading} title="지금 동기화"
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

          {/* 저장 / _계정 시트 동기화 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              {scriptUrl && (
                <button
                  onClick={handleSyncAccounts}
                  disabled={syncAccountsState === 'loading'}
                  className="px-3 py-2 text-xs font-semibold text-yellow-070 bg-yellow-005 border border-yellow-060/20 rounded-lg hover:bg-yellow-060/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {syncAccountsState === 'loading' ? '처리 중...' : '_계정 시트 동기화'}
                </button>
              )}
              {scriptUrl && (
                <p className="text-[11px] text-gray-040">_구성원 시트의 사번/이메일을 _계정 시트에 누락 없이 채워 권한관리 인덱스로 사용</p>
              )}
            </div>
            <MsButton onClick={handleSaveUrl} disabled={urlDraft.trim() === scriptUrl} size="sm">저장</MsButton>
          </div>
        </div>
      </section>
      )}

      {/* R8: 운영 토글 — 자동 승인 모드 (관리자 전용, scriptUrl 연결된 경우만) */}
      {currentUser.role === 'admin' && scriptUrl && (
        <section className="py-6">
          <div className="flex items-center gap-2 mb-4">
            <MsInfoIcon size={16} className="text-gray-040" />
            <h2 className="text-sm font-semibold text-gray-080">운영 토글</h2>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-080">신규 사용자 자동 승인</p>
              <p className="text-xs text-gray-040 mt-1 leading-5">
                @makestar.com 도메인 첫 로그인 시 승인 대기 큐를 거치지 않고 즉시 활성 멤버로 등록합니다.
                임시 사번(<code className="text-[11px] bg-gray-010 px-1 rounded">auto_*</code>) 으로 들어오며, 직책·소속 조직·보고대상은 비어 있는 채로 진입합니다 — 운영자 보강 필요.
              </p>
              <p className="text-[11px] text-orange-070 mt-2 leading-4">
                ⚠️ 배포 직후 일괄 로그인용. 안정화되면 OFF 로 전환해 정상 승인 큐로 복귀하세요.
              </p>
            </div>
            <div className="flex-shrink-0 pt-1">
              {autoApprove === null ? (
                <span className="text-xs text-gray-040">불러오는 중…</span>
              ) : (
                <MsSwitch
                  checked={autoApprove}
                  onChange={next => void handleToggleAutoApprove(next)}
                  disabled={autoApproveSaving}
                />
              )}
            </div>
          </div>
        </section>
      )}

      <p className="text-center text-xs text-gray-030 py-6">메이크스타 리뷰시스템 v0.1.0 · 프로토타입</p>

      <SyncRetryDrawer open={syncDrawerOpen} onClose={() => setSyncDrawerOpen(false)} />
    </div>
  );
}
