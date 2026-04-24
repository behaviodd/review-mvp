import { useMemo } from 'react';
import { ModalShell } from './ModalShell';
import { MsButton } from '../../ui/MsButton';
import { MsDownloadIcon } from '../../ui/MsIcons';
import { resolveTargetMembers } from '../../../utils/resolveTargets';
import { createCycleSubmissions } from '../../../utils/createCycleSubmissions';
import { getSmallestOrg } from '../../../utils/userUtils';
import { useTeamStore } from '../../../stores/teamStore';
import type { ReviewCycle } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  cycle: ReviewCycle;
  title?: string;
}

function downloadCSV(filename: string, rows: string[][]) {
  const escape = (cell: string) => {
    const needsQuote = /[",\n]/.test(cell);
    const safe = cell.replace(/"/g, '""');
    return needsQuote ? `"${safe}"` : safe;
  };
  const csv = rows.map(r => r.map(c => escape(String(c ?? ''))).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DryRunModal({ open, onClose, cycle, title }: Props) {
  const users = useTeamStore(s => s.users);
  const orgUnits = useTeamStore(s => s.orgUnits);

  const dryRun = useMemo(() => {
    if (!open) return null;
    const targets = resolveTargetMembers(cycle, users);
    const subs = createCycleSubmissions(cycle.id || 'candidate', targets, users, orgUnits, cycle);
    const selfCount = subs.filter(s => s.type === 'self').length;
    const downCount = subs.filter(s => s.type === 'downward').length;
    const perMember = targets.map(m => {
      const self = subs.find(s => s.type === 'self' && s.revieweeId === m.id);
      const downward = subs.filter(s => s.type === 'downward' && s.revieweeId === m.id);
      const reviewer = downward[0] ? users.find(u => u.id === downward[0].reviewerId) : undefined;
      return {
        user: m,
        hasSelf: !!self,
        managerName: reviewer?.name,
        managerMissing: downward.length === 0,
        inactive: m.isActive === false || !!m.leaveDate,
      };
    });
    const managerMissing = perMember.filter(r => r.managerMissing).length;
    return { targets, subs, selfCount, downCount, perMember, managerMissing };
  }, [open, cycle, users, orgUnits]);

  if (!open || !dryRun) return null;

  const handleCSV = () => {
    const rows: string[][] = [
      ['이름', '이메일', '조직', '직책', '자기평가', '조직장 리뷰', '비고'],
      ...dryRun.perMember.map(r => [
        r.user.name,
        r.user.email,
        getSmallestOrg(r.user),
        r.user.position,
        r.hasSelf ? 'O' : '-',
        r.managerMissing ? '매니저 없음' : (r.managerName ?? ''),
        r.inactive ? '비활성/퇴사 예정' : '',
      ]),
    ];
    downloadCSV(`${title ?? 'cycle'}_dryrun_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="드라이런 프리뷰"
      description={`${title ?? cycle.title} · 발행 시 이 사이클이 만드는 제출 레코드를 미리 확인합니다.`}
      widthClass="max-w-3xl"
      footer={
        <>
          <MsButton variant="ghost" size="sm" onClick={onClose}>닫기</MsButton>
          <MsButton variant="outline-default" size="sm" onClick={handleCSV} leftIcon={<MsDownloadIcon />}>
            CSV 다운로드
          </MsButton>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { label: '대상자', value: `${dryRun.targets.length}명` },
            { label: '자기평가 생성', value: `${dryRun.selfCount}건` },
            { label: '조직장 리뷰', value: `${dryRun.downCount}건` },
            { label: '매니저 없음', value: `${dryRun.managerMissing}명`, danger: dryRun.managerMissing > 0 },
          ].map(k => (
            <div key={k.label} className="rounded-lg border border-gray-010 bg-white px-3 py-2">
              <p className="text-[11px] text-gray-040">{k.label}</p>
              <p className={`text-lg font-bold tabular-nums ${k.danger ? 'text-red-060' : 'text-gray-080'}`}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-010">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.6fr)] gap-3 bg-gray-001 px-3 py-2 text-[11px] font-semibold text-gray-050">
            <span>이름</span>
            <span>조직</span>
            <span>직책</span>
            <span>조직장</span>
            <span>상태</span>
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-005">
            {dryRun.perMember.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-gray-040">대상자가 없습니다.</li>
            ) : (
              dryRun.perMember.map(r => (
                <li
                  key={r.user.id}
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.6fr)] gap-3 px-3 py-1.5 text-xs items-center ${
                    r.managerMissing || r.inactive ? 'bg-red-005/50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-080 truncate">{r.user.name}</p>
                    <p className="text-[10px] text-gray-040 truncate">{r.user.email}</p>
                  </div>
                  <span className="truncate text-gray-060">{getSmallestOrg(r.user)}</span>
                  <span className="truncate text-gray-060">{r.user.position}</span>
                  <span className={r.managerMissing ? 'text-red-060 font-semibold' : 'text-gray-070'}>
                    {r.managerMissing ? '매니저 없음' : r.managerName}
                  </span>
                  <span className="text-[10px] font-semibold">
                    {r.inactive ? <span className="text-orange-060">비활성</span> : <span className="text-green-060">OK</span>}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </ModalShell>
  );
}
