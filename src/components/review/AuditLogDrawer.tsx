import { useMemo, useState } from 'react';
import { useAuditLogStore } from '../../stores/auditLogStore';
import { useTeamStore } from '../../stores/teamStore';
import { MsSelect } from '../ui/MsControl';
import { SideDrawer } from '../ui/SideDrawer';
import { formatDateTime, timeAgo } from '../../utils/dateUtils';
import type { AuditAction } from '../../types';
import { cn } from '../../utils/cn';

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
  // R1
  'reviewer_assignment.created':       '평가권 부여',
  'reviewer_assignment.ended':         '평가권 종료',
  'reviewer_assignment.bulk_inherit':  '평가권 일괄 부여',
  'org_snapshot.created':              '인사 스냅샷 생성',
  'auth.impersonate_start':            '마스터 로그인 시작',
  'auth.impersonate_end':              '마스터 로그인 종료',
  'org.user_status_changed':           '구성원 상태 변경',
  'org.migrated_to_r1':                'R1 마이그레이션',
  // R6
  'permission_group.created':          '권한 그룹 생성',
  'permission_group.updated':          '권한 그룹 수정',
  'permission_group.deleted':          '권한 그룹 삭제',
  'permission_group.member_added':     '권한 그룹 멤버 추가',
  'permission_group.member_removed':   '권한 그룹 멤버 제거',
};

const ACTION_TONE: Record<AuditAction, string> = {
  'cycle.status_transition':           'bg-indigo-50 text-indigo-700',
  'cycle.repushed':                     'bg-gray-005 text-gray-070',
  'cycle.settings_updated':             'bg-blue-005 text-blue-070',
  'submission.reminder_sent':          'bg-orange-005 text-orange-070',
  'submission.deadline_extended':      'bg-yellow-005 text-yellow-070',
  'submission.reviewer_reassigned':    'bg-purple-005 text-purple-060',
  'submission.proxy_write_started':    'bg-red-005 text-red-060',
  'submission.proxy_submitted':        'bg-red-005 text-red-070',
  'submission.reopened':                'bg-blue-005 text-blue-070',
  // R1
  'reviewer_assignment.created':       'bg-purple-005 text-purple-060',
  'reviewer_assignment.ended':         'bg-gray-005 text-gray-070',
  'reviewer_assignment.bulk_inherit':  'bg-purple-005 text-purple-060',
  'org_snapshot.created':              'bg-blue-005 text-blue-070',
  'auth.impersonate_start':            'bg-red-005 text-red-070',
  'auth.impersonate_end':              'bg-gray-005 text-gray-070',
  'org.user_status_changed':           'bg-orange-005 text-orange-070',
  'org.migrated_to_r1':                'bg-green-005 text-green-070',
  // R6
  'permission_group.created':          'bg-purple-005 text-purple-060',
  'permission_group.updated':          'bg-purple-005 text-purple-060',
  'permission_group.deleted':          'bg-red-005 text-red-070',
  'permission_group.member_added':     'bg-purple-005 text-purple-060',
  'permission_group.member_removed':   'bg-gray-005 text-gray-070',
};

interface Props {
  cycleId: string;
  open: boolean;
  onClose: () => void;
}

export function AuditLogDrawer({ cycleId, open, onClose }: Props) {
  const allEntries = useAuditLogStore(s => s.entries);
  const users = useTeamStore(s => s.users);
  const [actionFilter, setActionFilter] = useState<'all' | AuditAction>('all');

  const entries = useMemo(() => {
    const base = allEntries.filter(e => e.cycleId === cycleId);
    if (actionFilter === 'all') return base;
    return base.filter(e => e.action === actionFilter);
  }, [allEntries, cycleId, actionFilter]);

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="감사 로그"
      description={`관리자 개입 기록 ${entries.length}건`}
      width="lg"
    >
      <>
        <div className="flex items-center gap-2 border-b border-gray-010 bg-gray-001 px-5 py-2">
          <span className="text-xs text-fg-subtle">필터</span>
          <MsSelect
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as 'all' | AuditAction)}
            className="text-xs"
          >
            <option value="all">전체</option>
            {(Object.keys(ACTION_LABEL) as AuditAction[]).map(a =>
              <option key={a} value={a}>{ACTION_LABEL[a]}</option>
            )}
          </MsSelect>
        </div>

        <div>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-base font-semibold text-gray-070">기록이 없습니다.</p>
              <p className="mt-1 text-xs text-fg-subtlest">관리자 개입이 일어나면 여기에 남습니다.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-005">
              {entries.map(e => {
                const actor = users.find(u => u.id === e.actorId);
                return (
                  <li key={e.id} className="flex flex-col gap-1 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', ACTION_TONE[e.action])}>
                        {ACTION_LABEL[e.action]}
                      </span>
                      <span className="text-xs text-gray-060 truncate">
                        {actor ? `${actor.name} (${actor.position})` : e.actorId}
                      </span>
                      <span className="ml-auto text-[11px] text-fg-subtlest" title={formatDateTime(e.at)}>
                        {timeAgo(e.at)}
                      </span>
                    </div>
                    <p className="text-base text-gray-080">{e.summary}</p>
                    {e.targetIds.length > 0 && (
                      <p className="text-[11px] text-fg-subtlest truncate" title={e.targetIds.join(', ')}>
                        대상 {e.targetIds.length}건
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </>
    </SideDrawer>
  );
}
