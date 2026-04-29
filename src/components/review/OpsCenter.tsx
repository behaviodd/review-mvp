import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useSheetsSyncStore } from '../../stores/sheetsSyncStore';
import { useShowToast } from '../ui/Toast';
import { MsButton } from '../ui/MsButton';
import { MsRefreshIcon } from '../ui/MsIcons';
import {
  DEFAULT_FILTERS,
  applyFilters,
  buildOpsRows,
  collectPendingSubmissionIds,
  computeKpis,
  listOrgsFromRows,
  type OpsFilters,
  type OpsRow,
} from '../../utils/opsCenter';
import { repushCycle, repushSubmissions, type SyncSummary } from '../../utils/syncQueue';
import { OpsImpactBanner } from './OpsImpactBanner';
import { OpsKpiStrip } from './OpsKpiStrip';
import { OpsFilterBar } from './OpsFilterBar';
import { OpsTable } from './OpsTable';
import { OpsBulkBar } from './OpsBulkBar';
import { SyncStatusBadge } from './SyncStatusBadge';
import { SyncRetryDrawer } from './SyncRetryDrawer';
import { AuditLogDrawer } from './AuditLogDrawer';
import { ExtendDeadlineModal } from './modals/ExtendDeadlineModal';
import { canBulkIntervene, canViewAuditLog } from '../../utils/permissions';
import { useAuditLogStore } from '../../stores/auditLogStore';
import { MsArticleIcon } from '../ui/MsIcons';

interface Props {
  cycleId: string;
  onOpenMember: (userId: string) => void;
  headerActions?: ReactNode;
}

export function OpsCenter({ cycleId, onOpenMember, headerActions }: Props) {
  const cycle = useReviewStore(s => s.cycles.find(c => c.id === cycleId));
  const submissions = useReviewStore(s => s.submissions);
  const bulkRemind = useReviewStore(s => s.bulkRemind);
  const users = useTeamStore(s => s.users);
  const currentUser = useAuthStore(s => s.currentUser);
  const pendingOps = useSheetsSyncStore(s => s.pendingOps);
  const lastSuccessAt = useSheetsSyncStore(s => s.lastSuccessAt);
  const reviewSyncError = useSheetsSyncStore(s => s.reviewSyncError);
  const showToast = useShowToast();

  const [filters, setFilters] = useState<OpsFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [repushingCycle, setRepushingCycle] = useState(false);
  const [repushingSelection, setRepushingSelection] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const allRows = useMemo<OpsRow[]>(() => {
    if (!cycle) return [];
    return buildOpsRows(cycle, submissions, users, filters.perspective);
  }, [cycle, submissions, users, filters.perspective]);

  const filteredRows = useMemo(() => applyFilters(allRows, filters), [allRows, filters]);
  const orgs = useMemo(() => listOrgsFromRows(allRows), [allRows]);
  const kpis = useMemo(() => (cycle ? computeKpis(cycle, submissions) : null), [cycle, submissions]);

  const selectedRows = useMemo(
    () => filteredRows.filter(r => selected.has(r.key)),
    [filteredRows, selected],
  );
  const pendingIds = useMemo(
    () => collectPendingSubmissionIds(selectedRows, submissions, filters.stage),
    [selectedRows, submissions, filters.stage],
  );

  const syncSummary: SyncSummary = useMemo(() => ({
    pending: pendingOps.length,
    failed: pendingOps.filter(o => o.tryCount > 0).length,
    lastSuccessAt,
    lastError: reviewSyncError,
  }), [pendingOps, lastSuccessAt, reviewSyncError]);

  const auditEntries = useAuditLogStore(s => s.entries);
  const auditCount = useMemo(
    () => auditEntries.filter(e => e.cycleId === cycleId).length,
    [auditEntries, cycleId],
  );

  if (!cycle || !kpis) return null;

  const toggleOne = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    const allInView = filteredRows.every(r => selected.has(r.key));
    setSelected(prev => {
      const next = new Set(prev);
      if (allInView) {
        for (const r of filteredRows) next.delete(r.key);
      } else {
        for (const r of filteredRows) next.add(r.key);
      }
      return next;
    });
  };

  const handleRemind = () => {
    if (!currentUser) {
      showToast('error', '로그인 정보를 확인할 수 없습니다.');
      return;
    }
    if (pendingIds.length === 0) {
      showToast('info', '미제출자가 없습니다.');
      return;
    }
    const result = bulkRemind(pendingIds, currentUser.id);
    const msg = result.skipped > 0
      ? `${result.sent}명에게 리마인드를 발송했습니다. (${result.skipped}건은 이미 제출되어 건너뜀)`
      : `${result.sent}명에게 리마인드를 발송했습니다.`;
    showToast('success', msg);
    setSelected(new Set());
  };

  const handleRepushCycle = async () => {
    if (repushingCycle) return;
    setRepushingCycle(true);
    try {
      const res = await repushCycle(cycle.id);
      if (res.failed === 0) {
        showToast('success', `사이클 재푸시 완료 · ${res.success}건`);
      } else {
        showToast('error', `일부 실패 · 성공 ${res.success} / 실패 ${res.failed}. 동기화 상태에서 재시도하세요.`);
      }
    } finally {
      setRepushingCycle(false);
    }
  };

  const handleRepushSelection = async () => {
    if (repushingSelection) return;
    const submissionIds = Array.from(new Set(selectedRows.flatMap(r => r.allSubmissionIds)));
    if (submissionIds.length === 0) {
      showToast('info', '재푸시할 항목이 없습니다.');
      return;
    }
    setRepushingSelection(true);
    try {
      const res = await repushSubmissions(submissionIds);
      if (res.failed === 0) {
        showToast('success', `${res.success}건 재푸시 완료`);
      } else {
        showToast('error', `일부 실패 · 성공 ${res.success} / 실패 ${res.failed}`);
      }
    } finally {
      setRepushingSelection(false);
    }
  };

  /* Phase D-3.D-4: space-y-4 제거 — 본문 영역 (KpiStrip / FilterBar / Table) 사이
     spacing 0 으로 vertical line 끝과 다음 horizontal line 이 직접 만남 (T 자 → + 자).
     헤더와 ImpactBanner 만 자체 mb-4 로 spacing 처리. */
  return (
    <section className="relative" aria-label="운영 센터">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-080">운영 센터</h2>
          <p className="text-xs text-gray-040">제출 현황을 모니터링하고 미제출자에게 리마인드를 보낼 수 있어요.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SyncStatusBadge summary={syncSummary} onOpen={() => setDrawerOpen(true)} />
          {canViewAuditLog(currentUser) && (
            <MsButton
              variant="outline-default"
              size="sm"
              onClick={() => setAuditOpen(true)}
              leftIcon={<MsArticleIcon />}
              title="이 사이클에 대한 관리자 개입 이력 보기"
            >
              감사 로그 {auditCount > 0 ? `(${auditCount})` : ''}
            </MsButton>
          )}
          <MsButton
            variant="outline-default"
            size="sm"
            onClick={handleRepushCycle}
            disabled={repushingCycle}
            loading={repushingCycle}
            leftIcon={<MsRefreshIcon className={repushingCycle ? 'animate-spin' : ''} />}
            title="이 사이클의 모든 데이터를 시트에 다시 전송"
          >
            사이클 재푸시
          </MsButton>
          {headerActions}
        </div>
      </div>

      <OpsImpactBanner cycle={cycle} />

      <OpsKpiStrip kpis={kpis} />

      <OpsFilterBar
        filters={filters}
        onChange={setFilters}
        orgs={orgs}
      />

      <OpsTable
        rows={filteredRows}
        selected={selected}
        onToggle={toggleOne}
        onToggleAll={toggleAll}
        onRowOpen={row => onOpenMember(row.user.id)}
        deadlines={{ self: cycle.selfReviewDeadline, manager: cycle.managerReviewDeadline }}
        perspectiveLabel={filters.perspective === 'reviewee' ? '대상자' : '작성자'}
        showPeer={kpis.hasPeer}
        showUpward={kpis.hasUpward}
      />

      <OpsBulkBar
        selectedCount={selected.size}
        pendingCount={pendingIds.length}
        onRemind={handleRemind}
        onRepush={handleRepushSelection}
        onClear={() => setSelected(new Set())}
        repushLoading={repushingSelection}
        canIntervene={canBulkIntervene({ actor: currentUser, cycle })}
        onExtendDeadline={() => setExtendOpen(true)}
      />

      <SyncRetryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {currentUser && (
        <ExtendDeadlineModal
          open={extendOpen}
          onClose={() => setExtendOpen(false)}
          cycleId={cycle.id}
          submissionIds={Array.from(new Set(selectedRows.flatMap(r => r.allSubmissionIds)))}
          actorId={currentUser.id}
          onApplied={() => setSelected(new Set())}
        />
      )}
      {canViewAuditLog(currentUser) && (
        <AuditLogDrawer
          cycleId={cycle.id}
          open={auditOpen}
          onClose={() => setAuditOpen(false)}
        />
      )}
    </section>
  );
}
