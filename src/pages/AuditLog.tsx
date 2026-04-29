import { useMemo, useState } from 'react';
import { useTeamStore } from '../stores/teamStore';
import { useAuditLogStore } from '../stores/auditLogStore';
import { useImpersonationLogs } from '../hooks/useImpersonationLogs';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { usePermission } from '../hooks/usePermission';
import { EmptyState } from '../components/ui/EmptyState';
import { Pill } from '../components/ui/Pill';
import { HeaderTab } from '../components/layout/HeaderTab';
import { MsRefreshIcon, MsLogoutIcon, MsArticleIcon } from '../components/ui/MsIcons';
import { formatDateTime, timeAgo } from '../utils/dateUtils';
import type { AuditAction } from '../types';

type TabKey = 'all' | 'impersonation' | 'system';

const ACTION_LABEL: Record<AuditAction, string> = {
  'cycle.status_transition':           '상태 전환',
  'cycle.repushed':                     '사이클 재푸시',
  'cycle.settings_updated':             '설정 변경',
  'submission.reminder_sent':          '리마인드 발송',
  'submission.deadline_extended':      '기한 연장',
  'submission.reviewer_reassigned':    '작성자 변경',
  'submission.proxy_write_started':    '대리 작성 진입',
  'submission.proxy_submitted':        '대리 제출',
  'submission.reopened':                '제출 재오픈',
  'reviewer_assignment.created':       '평가권 부여',
  'reviewer_assignment.ended':         '평가권 종료',
  'reviewer_assignment.bulk_inherit':  '평가권 일괄 부여',
  'org_snapshot.created':              '인사 스냅샷 생성',
  'auth.impersonate_start':            '마스터 로그인 시작',
  'auth.impersonate_end':              '마스터 로그인 종료',
  'org.user_status_changed':           '구성원 상태 변경',
  'org.migrated_to_r1':                'R1 마이그레이션',
  'permission_group.created':          '권한 그룹 생성',
  'permission_group.updated':          '권한 그룹 수정',
  'permission_group.deleted':          '권한 그룹 삭제',
  'permission_group.member_added':     '권한 그룹 멤버 추가',
  'permission_group.member_removed':   '권한 그룹 멤버 제거',
};

/**
 * R6 Phase E: 통합 감사 로그.
 * - 마스터 로그인 (시트 _마스터로그인) — 가장 자주 점검할 항목
 * - 시스템 audit (auditLogStore) — 사이클·권한 그룹·평가권 변경 등
 *
 * 권한: audit.view (소유자 + '마스터 로그인' 시스템 그룹 멤버)
 */
export function AuditLog() {
  const { can } = usePermission();
  const users = useTeamStore(s => s.users);
  const auditEntries = useAuditLogStore(s => s.entries);
  const { logs: impersonationLogs, loading: impLoading, refetch } = useImpersonationLogs();

  const [tab, setTab] = useState<TabKey>('impersonation');

  /* Phase D-3.E: ListToolbar segments → 헤더 탭, rightSlot → tabActions.
     subtitle 제거 (다른 페이지 일관). */
  const headerTabs = useMemo(() => (
    <>
      <HeaderTab active={tab === 'impersonation'} onClick={() => setTab('impersonation')}>
        마스터 로그인 {impersonationLogs.length}
      </HeaderTab>
      <HeaderTab active={tab === 'system'} onClick={() => setTab('system')}>
        시스템 액션 {auditEntries.length}
      </HeaderTab>
      <HeaderTab active={tab === 'all'} onClick={() => setTab('all')}>
        전체 {impersonationLogs.length + auditEntries.length}
      </HeaderTab>
    </>
  ), [tab, impersonationLogs.length, auditEntries.length]);

  const headerTabActions = useMemo(() => (
    <button
      onClick={() => refetch()}
      className="inline-flex items-center gap-1 h-6 min-w-6 px-2 text-xs font-bold rounded-md border border-bd-primary text-fg-default hover:bg-interaction-hovered transition-colors"
    >
      <MsRefreshIcon size={14} /> 새로고침
    </button>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [refetch]);

  useSetPageHeader('감사 로그', undefined, {
    tabs: headerTabs,
    tabActions: headerTabActions,
  });

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach(u => m.set(u.id, u.name));
    return m;
  }, [users]);

  if (!can.viewAuditLog) {
    return (
      <EmptyState
        illustration="empty-list"
        title="권한이 없어요"
        description="감사 로그는 'audit.view' 권한 보유자만 열람할 수 있습니다."
      />
    );
  }

  /* Phase D-3.E: 본문 카드 컨테이너 모두 제거 + 시트형 평면 list (§ 7.6 정합) */
  return (
    <div>
      {(tab === 'impersonation' || tab === 'all') && (
        <section className="mb-6">
          <header className="flex items-center gap-2 mb-2">
            <MsLogoutIcon size={14} className="text-orange-070" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">마스터 로그인</h2>
            {impLoading && <span className="text-[11px] text-fg-subtlest">로딩 중…</span>}
          </header>

          {impersonationLogs.length === 0 ? (
            <EmptyState
              icon={MsLogoutIcon}
              title="마스터 로그인 기록이 없습니다."
              description="관리자가 다른 사용자 화면을 조회하면 여기에 표시됩니다."
              variant="inline"
            />
          ) : (
            <div className="border-y border-bd-default divide-y divide-bd-default">
              {impersonationLogs.map(log => {
                const actorName = userMap.get(log.actorId) ?? log.actorId;
                const targetName = userMap.get(log.targetUserId) ?? log.targetUserId;
                const isActive = !log.endedAt;
                const durationMin = log.endedAt
                  ? Math.round((new Date(log.endedAt).getTime() - new Date(log.startedAt).getTime()) / 60000)
                  : Math.round((Date.now() - new Date(log.startedAt).getTime()) / 60000);
                return (
                  <div key={log.id} className="flex items-center gap-3 px-2 py-3">
                    <div className="size-8 rounded-lg bg-orange-005 flex items-center justify-center shrink-0">
                      <MsLogoutIcon size={14} className="text-orange-070" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg-default">
                        <strong>{actorName}</strong> → <strong>{targetName}</strong>
                        {isActive && <Pill tone="danger" size="xs" className="ml-2">진행 중</Pill>}
                      </p>
                      <p className="text-[11px] text-fg-subtlest mt-0.5">
                        시작 {formatDateTime(log.startedAt)}
                        {' · '}
                        {log.endedAt ? `종료 ${formatDateTime(log.endedAt)} · 지속 ${durationMin}분` : `진행 ${durationMin}분`}
                      </p>
                      {log.ip && (
                        <p className="text-[10px] text-fg-subtlest mt-0.5 truncate">IP: {log.ip}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-fg-subtlest shrink-0">{timeAgo(log.startedAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {(tab === 'system' || tab === 'all') && (
        <section>
          <header className="flex items-center gap-2 mb-2">
            <MsArticleIcon size={14} className="text-blue-070" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-fg-subtle">시스템 액션</h2>
          </header>

          {auditEntries.length === 0 ? (
            <EmptyState
              icon={MsArticleIcon}
              title="시스템 액션 로그가 없습니다."
              description="사이클 발행, 권한 그룹 변경 등이 발생하면 여기에 기록됩니다."
              variant="inline"
            />
          ) : (
            <div className="border-y border-bd-default divide-y divide-bd-default">
              {auditEntries.slice(0, 200).map(entry => {
                const actorName = userMap.get(entry.actorId) ?? entry.actorId;
                return (
                  <div key={entry.id} className="flex items-center gap-3 px-2 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-fg-default">
                        <Pill tone="neutral" size="xs">{ACTION_LABEL[entry.action] ?? entry.action}</Pill>
                        <span className="ml-2 font-medium">{actorName}</span>
                        <span className="ml-1 text-fg-subtle">— {entry.summary}</span>
                      </p>
                      <p className="text-[11px] text-fg-subtlest mt-0.5">
                        {formatDateTime(entry.at)}
                        {entry.cycleId && <> · 사이클 {entry.cycleId}</>}
                      </p>
                    </div>
                    <span className="text-[11px] text-fg-subtlest shrink-0">{timeAgo(entry.at)}</span>
                  </div>
                );
              })}
              {auditEntries.length > 200 && (
                <div className="px-2 py-3 text-center text-[11px] text-fg-subtlest">
                  최근 200개만 표시됩니다.
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
