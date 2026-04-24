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
          <span className="text-xs text-gray-050">필터</span>
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
              <p className="text-sm font-semibold text-gray-070">기록이 없습니다.</p>
              <p className="mt-1 text-xs text-gray-040">관리자 개입이 일어나면 여기에 남습니다.</p>
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
                      <span className="ml-auto text-[11px] text-gray-040" title={formatDateTime(e.at)}>
                        {timeAgo(e.at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-080">{e.summary}</p>
                    {e.targetIds.length > 0 && (
                      <p className="text-[11px] text-gray-040 truncate" title={e.targetIds.join(', ')}>
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
