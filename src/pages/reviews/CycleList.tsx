import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import {
  MsRefreshIcon, MsPlusIcon, MsChevronRightLineIcon, MsEditIcon,
  MsDeleteIcon, MsArticleIcon, MsCancelIcon,
} from '../../components/ui/MsIcons';
import { MsButton } from '../../components/ui/MsButton';
import { MsCheckbox } from '../../components/ui/MsControl';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { useShowToast } from '../../components/ui/Toast';
import { TagInput, tagColor } from '../../components/review/TagInput';
import { FolderSidebar, CYCLE_DRAG_MIME } from '../../components/review/FolderSidebar';
import { CycleBulkBar } from '../../components/review/CycleBulkBar';
import { BulkMoveFolderModal } from '../../components/review/modals/BulkMoveFolderModal';
import { BulkAddTagModal } from '../../components/review/modals/BulkAddTagModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  DEFAULT_CYCLE_FILTERS, applyCycleFilters, filtersToParams, paramsToFilters,
  type CycleFilters, type CycleSort, type FolderSelection,
} from '../../utils/cycleFilter';
import type { ReviewStatus, ReviewType } from '../../types';
import { cn } from '../../utils/cn';

const STATUS_CONFIG: Record<ReviewStatus, { label: string; dot: string; text: string }> = {
  draft:          { label: '초안',        dot: 'bg-gray-030',  text: 'text-gray-050' },
  active:         { label: '진행 중',     dot: 'bg-pink-040',  text: 'text-pink-060' },
  self_review:    { label: '자기평가 중', dot: 'bg-pink-040',  text: 'text-pink-060' },
  manager_review: { label: '매니저 리뷰', dot: 'bg-pink-040',  text: 'text-pink-050' },
  calibration:    { label: '조율 중',     dot: 'bg-pink-040',  text: 'text-pink-050' },
  closed:         { label: '완료',        dot: 'bg-green-040', text: 'text-green-060' },
};

function StatusChip({ status }: { status: ReviewStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

type StatusPreset = 'all' | 'draft' | 'in_progress' | 'closed';
const STATUS_PRESET: Record<StatusPreset, ReviewStatus[]> = {
  all: [],
  draft: ['draft'],
  in_progress: ['self_review', 'manager_review', 'calibration', 'active'],
  closed: ['closed'],
};
function detectPreset(statuses: ReviewStatus[]): StatusPreset {
  if (statuses.length === 0) return 'all';
  const keys = Object.entries(STATUS_PRESET) as [StatusPreset, ReviewStatus[]][];
  for (const [k, arr] of keys) {
    if (k === 'all') continue;
    if (arr.length === statuses.length && arr.every(s => statuses.includes(s))) return k;
  }
  return 'all';
}

const SORT_OPTIONS: { value: CycleSort; label: string }[] = [
  { value: 'created_desc',    label: '최신순' },
  { value: 'created_asc',     label: '오래된순' },
  { value: 'deadline_asc',    label: '마감 임박순' },
  { value: 'completion_desc', label: '완료율 높은순' },
  { value: 'completion_asc',  label: '완료율 낮은순' },
];

export function CycleList() {
  const {
    cycles, submissions, archiveCycle, deleteCycle, updateCycle, addCycle,
  } = useReviewStore();
  const users = useTeamStore(s => s.users);
  const currentUser = useAuthStore(s => s.currentUser);
  const navigate = useNavigate();
  const showToast = useShowToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<CycleFilters>(() => paramsToFilters(searchParams), [searchParams]);
  const update = (patch: Partial<CycleFilters>) => {
    const next = { ...filters, ...patch };
    setSearchParams(filtersToParams(next), { replace: true });
  };

  const preset = detectPreset(filters.statuses);
  const setPreset = (p: StatusPreset) => update({ statuses: STATUS_PRESET[p] });

  const allTags = useMemo(
    () => Array.from(new Set(cycles.flatMap(c => c.tags ?? []))).sort(),
    [cycles],
  );

  const visible = useMemo(
    () => applyCycleFilters(cycles, users, filters),
    [cycles, users, filters],
  );

  const headerActions = useMemo(() => (
    <MsButton onClick={() => navigate('/cycles/new')} leftIcon={<MsPlusIcon size={16} />}>
      새 리뷰
    </MsButton>
  ), [navigate]);
  const headerSubtitle = useMemo(() => {
    const all = cycles.filter(c => !c.archivedAt);
    const inProgress = all.filter(c =>
      c.status === 'self_review' || c.status === 'manager_review' ||
      c.status === 'calibration' || c.status === 'active'
    ).length;
    const archived = cycles.filter(c => c.archivedAt).length;
    return `진행 중 ${inProgress} · 보관 ${archived} · 총 ${all.length}개`;
  }, [cycles]);
  useSetPageHeader('리뷰 운영', headerActions, { subtitle: headerSubtitle });

  /* ── 선택 상태 ─────────────────────────────────────── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    const allSelected = visible.every(c => selected.has(c.id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        for (const c of visible) next.delete(c.id);
      } else {
        for (const c of visible) next.add(c.id);
      }
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const selectedCycles = useMemo(
    () => cycles.filter(c => selected.has(c.id)),
    [cycles, selected],
  );
  const selectedStats = useMemo(() => {
    const members = new Set<string>();
    let subs = 0;
    for (const c of selectedCycles) {
      for (const u of users) {
        if (c.targetDepartments.includes(u.department) && u.role !== 'admin') members.add(u.id);
      }
      subs += submissions.filter(s => s.cycleId === c.id).length;
    }
    return { members: members.size, subs };
  }, [selectedCycles, users, submissions]);

  /* ── 모달 상태 ─────────────────────────────────────── */
  const [folderModal, setFolderModal] = useState(false);
  const [tagModal, setTagModal] = useState(false);
  const [singleDelete, setSingleDelete] = useState<{ id: string; title: string } | null>(null);
  const [confirmBulkClone, setConfirmBulkClone] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  /* ── 개별 행 액션 ──────────────────────────────────── */
  const handleDeleteCycle = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setSingleDelete({ id, title });
  };
  const confirmSingleDelete = () => {
    if (!singleDelete) return;
    deleteCycle(singleDelete.id);
    showToast('success', '리뷰가 삭제되었습니다.');
    setSingleDelete(null);
  };

  const handleArchiveCycle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = archiveCycle(id, currentUser?.id ?? 'system');
    showToast(res.ok ? 'success' : 'error', res.ok ? '보관함으로 이동했습니다.' : (res.error ?? '실패'));
  };

  const handleCloneCycle = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigate(`/cycles/new?from=${id}`);
  };

  /* ── 폴더 이동 (드래그 & 일괄) ───────────────────────── */
  const moveCyclesToFolder = (ids: string[], folderId: string | null) => {
    for (const id of ids) {
      updateCycle(id, { folderId: folderId ?? undefined });
    }
  };

  const onBulkMoveFolder = (folderId: string | null) => {
    moveCyclesToFolder(Array.from(selected), folderId);
    setFolderModal(false);
    showToast('success', `${selected.size}개 사이클을 이동했습니다.`);
    clearSelection();
  };

  /* ── 태그 추가 ──────────────────────────────────────── */
  const onBulkAddTag = (newTags: string[]) => {
    for (const id of selected) {
      const cycle = cycles.find(c => c.id === id);
      if (!cycle) continue;
      const merged = Array.from(new Set([...(cycle.tags ?? []), ...newTags]));
      updateCycle(id, { tags: merged });
    }
    setTagModal(false);
    showToast('success', `${selected.size}개 사이클에 태그를 추가했습니다.`);
    clearSelection();
  };

  /* ── 보관 ─────────────────────────────────────────── */
  const onBulkArchive = () => {
    const eligible = selectedCycles.filter(c => c.status === 'closed' && !c.archivedAt);
    const blocked = selectedCycles.length - eligible.length;
    let moved = 0;
    for (const c of eligible) {
      const res = archiveCycle(c.id, currentUser?.id ?? 'system');
      if (res.ok) moved += 1;
    }
    if (moved === 0) {
      showToast('error', '보관할 수 있는 사이클(종료 상태)이 선택되지 않았습니다.');
      return;
    }
    showToast('success', blocked > 0
      ? `${moved}개 보관 · ${blocked}개는 종료 상태가 아니라 건너뜀`
      : `${moved}개 보관 완료`);
    clearSelection();
  };

  /* ── 복제 (최초 1건만 진입) ────────────────────────── */
  const onBulkClone = () => {
    if (selected.size === 1) {
      const id = Array.from(selected)[0];
      navigate(`/cycles/new?from=${id}`);
      return;
    }
    setConfirmBulkClone(true);
  };
  const doBulkClone = () => {
    setConfirmBulkClone(false);
    const now = new Date().toISOString();
    let cloned = 0;
    for (const c of selectedCycles) {
      const newId = `cyc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      addCycle({
        ...c,
        id: newId,
        title: `${c.title} (복제)`,
        status: 'draft',
        createdAt: now,
        createdBy: currentUser?.id ?? c.createdBy,
        completionRate: 0,
        archivedAt: undefined,
        fromCycleId: c.id,
        templateSnapshot: undefined,
        templateSnapshotAt: undefined,
      });
      cloned += 1;
    }
    showToast('success', `${cloned}개 초안 복제됨`);
    clearSelection();
  };

  /* ── 삭제 ─────────────────────────────────────────── */
  const onBulkDelete = () => setConfirmBulkDelete(true);
  const doBulkDelete = () => {
    setConfirmBulkDelete(false);
    for (const id of selected) deleteCycle(id);
    showToast('success', `${selected.size}개 삭제됨`);
    clearSelection();
  };

  /* ── 필터 초기화 체크 ─────────────────────────────── */
  const filterActive =
    filters.query.trim().length > 0 ||
    filters.statuses.length > 0 ||
    filters.types.length > 0 ||
    filters.tags.length > 0 ||
    !!filters.dateFrom || !!filters.dateTo ||
    filters.folder.kind !== 'all';

  const allChecked = visible.length > 0 && visible.every(c => selected.has(c.id));
  const someChecked = visible.some(c => selected.has(c.id));

  const handleFolderSelect = (sel: FolderSelection) => update({ folder: sel });

  return (
    <div className="flex flex-col md:flex-row gap-5">
      <FolderSidebar
        selected={filters.folder}
        onSelect={handleFolderSelect}
        cycles={cycles}
        onMoveCycleToFolder={(cycleId, folderId) => moveCyclesToFolder([cycleId], folderId)}
      />

      <div className="flex-1 min-w-0 space-y-4">
        {/* 필터 바 */}
        <div className="rounded-xl border border-gray-010 bg-white shadow-card px-4 py-3 space-y-3">
          <ListToolbar
            segments={[
              {
                kind: 'pills',
                key: 'preset',
                ariaLabel: '상태 필터',
                value: preset,
                onChange: v => setPreset(v as StatusPreset),
                options: [
                  { value: 'all',         label: '전체' },
                  { value: 'draft',       label: '초안' },
                  { value: 'in_progress', label: '진행중' },
                  { value: 'closed',      label: '완료' },
                ],
              },
              {
                kind: 'select',
                key: 'type',
                ariaLabel: '유형',
                value: filters.types[0] ?? '',
                onChange: v => update({ types: v ? [v as ReviewType] : [] }),
                options: [
                  { value: '',          label: '모든 유형' },
                  { value: 'scheduled', label: '정기' },
                  { value: 'adhoc',     label: '수시' },
                ],
              },
              {
                kind: 'select',
                key: 'sort',
                ariaLabel: '정렬',
                value: filters.sort,
                onChange: v => update({ sort: v as CycleSort }),
                options: SORT_OPTIONS.map(o => ({ value: o.value, label: o.label })),
              },
            ]}
            search={{
              value: filters.query,
              onChange: v => update({ query: v }),
              placeholder: '제목·태그·생성자 검색',
            }}
            rightSlot={filterActive ? (
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                className="text-xs font-medium text-gray-050 hover:text-gray-080 underline-offset-2 hover:underline"
              >
                초기화
              </button>
            ) : undefined}
          />

          {(allTags.length > 0 || filters.tags.length > 0) && (
            <div className="flex items-start gap-2">
              <span className="pt-1 text-[11px] font-medium text-gray-050 shrink-0">태그</span>
              <div className="flex-1">
                <TagInput
                  value={filters.tags}
                  onChange={tags => update({ tags })}
                  suggestions={allTags}
                  placeholder="태그로 필터"
                />
              </div>
            </div>
          )}
        </div>

        {/* 리스트 */}
        {visible.length === 0 ? (
          cycles.length === 0 ? (
            <EmptyState
              icon={MsRefreshIcon}
              title="아직 생성된 리뷰가 없습니다."
              description="새 리뷰를 만들어 팀의 성장 돌아보기를 시작해보세요."
              action={{ label: '새 리뷰 만들기', onClick: () => navigate('/cycles/new') }}
            />
          ) : (
            <EmptyState
              icon={MsRefreshIcon}
              title="조건에 맞는 리뷰가 없습니다."
              description="필터를 완화하거나 초기화해 주세요."
            />
          )
        ) : (
          <div className="bg-white rounded-xl border border-gray-010 shadow-card overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-gray-010 bg-gray-005/50">
              <div className="w-5 shrink-0">
                <MsCheckbox
                  checked={allChecked}
                  indeterminate={!allChecked && someChecked}
                  onChange={toggleAllVisible}
                  aria-label="보이는 전체 선택"
                />
              </div>
              <div className="flex-1 text-xs font-semibold text-gray-040 uppercase tracking-wide">리뷰</div>
              <div className="w-28 text-xs font-semibold text-gray-040 uppercase tracking-wide">단계</div>
              <div className="w-28 text-xs font-semibold text-gray-040 uppercase tracking-wide">완료율</div>
              <div className="w-24 text-right text-xs font-semibold text-gray-040 uppercase tracking-wide">마감일</div>
              <div className="w-4" />
            </div>
            {visible.map(cycle => {
              const isSelected = selected.has(cycle.id);
              return (
                <div
                  key={cycle.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(CYCLE_DRAG_MIME, cycle.id);
                    e.dataTransfer.setData('text/plain', cycle.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-action]')) return;
                    navigate(`/cycles/${cycle.id}`);
                  }}
                  className={cn(
                    'group flex items-center gap-4 px-5 py-3.5 border-b border-gray-010 last:border-0 cursor-pointer transition-colors',
                    isSelected ? 'bg-pink-005/50' : 'hover:bg-gray-005/60',
                  )}
                >
                  <div className="w-5 shrink-0" data-action>
                    <MsCheckbox
                      checked={isSelected}
                      onChange={() => toggleOne(cycle.id)}
                      aria-label={`${cycle.title} 선택`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-099 group-hover:text-pink-060 truncate leading-snug">
                        {cycle.title}
                      </p>
                      {(cycle.tags ?? []).slice(0, 3).map(t => (
                        <span key={t} className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', tagColor(t))}>
                          #{t}
                        </span>
                      ))}
                      {(cycle.tags?.length ?? 0) > 3 && (
                        <span className="rounded-full bg-gray-005 px-1.5 py-0.5 text-[10px] text-gray-050">
                          +{(cycle.tags?.length ?? 0) - 3}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-040 mt-0.5">
                      {cycle.type === 'scheduled' ? '정기' : '수시'} · 생성 {formatDate(cycle.createdAt)}
                    </p>
                  </div>

                  <div className="w-28 flex-shrink-0">
                    <StatusChip status={cycle.status} />
                  </div>

                  <div className="w-28 flex-shrink-0">
                    {cycle.status !== 'draft' ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-gray-010 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cycle.completionRate === 100 ? 'bg-green-040' : 'bg-pink-040'}`}
                            style={{ width: `${cycle.completionRate ?? 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-050 tabular-nums w-7 text-right">{cycle.completionRate ?? 0}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-030">—</span>
                    )}
                  </div>

                  <div className="w-24 flex-shrink-0 text-right">
                    <p className="text-xs text-gray-060">{formatDate(cycle.selfReviewDeadline)}</p>
                    <p className="text-xs text-gray-040 mt-0.5">자기평가 마감</p>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all" data-action onClick={e => e.stopPropagation()}>
                    <MsButton
                      size="sm"
                      variant="ghost"
                      leftIcon={<MsArticleIcon size={12} />}
                      onClick={e => handleCloneCycle(e, cycle.id)}
                      title="이 리뷰를 복제하여 새 리뷰 생성"
                    >
                      복제
                    </MsButton>
                    <MsButton
                      size="sm"
                      variant="ghost"
                      leftIcon={<MsEditIcon size={12} />}
                      onClick={e => {
                        e.stopPropagation();
                        if (cycle.status === 'draft') {
                          navigate(`/cycles/new?draft=${cycle.id}`);
                        } else {
                          navigate(`/cycles/${cycle.id}?edit=1`);
                        }
                      }}
                    >
                      {cycle.status === 'draft' ? '이어 쓰기' : '편집'}
                    </MsButton>
                    {cycle.status === 'closed' && (
                      <MsButton
                        size="sm"
                        variant="outline-default"
                        leftIcon={<MsCancelIcon size={12} />}
                        onClick={e => handleArchiveCycle(e, cycle.id)}
                      >
                        보관
                      </MsButton>
                    )}
                    <MsButton
                      size="sm"
                      variant="outline-red"
                      leftIcon={<MsDeleteIcon size={12} />}
                      onClick={e => handleDeleteCycle(e, cycle.id, cycle.title)}
                    >
                      삭제
                    </MsButton>
                  </div>
                  <MsChevronRightLineIcon size={16} className="text-gray-030 group-hover:text-pink-040 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        <CycleBulkBar
          selectedCount={selected.size}
          totalMembers={selectedStats.members}
          totalSubmissions={selectedStats.subs}
          onClear={clearSelection}
          onMoveFolder={() => setFolderModal(true)}
          onAddTag={() => setTagModal(true)}
          onArchive={onBulkArchive}
          onClone={onBulkClone}
          onDelete={onBulkDelete}
        />
      </div>

      <BulkMoveFolderModal
        open={folderModal}
        onClose={() => setFolderModal(false)}
        count={selected.size}
        onConfirm={onBulkMoveFolder}
      />
      <BulkAddTagModal
        open={tagModal}
        onClose={() => setTagModal(false)}
        count={selected.size}
        suggestions={allTags}
        onConfirm={onBulkAddTag}
      />
      <ConfirmDialog
        open={singleDelete !== null}
        onClose={() => setSingleDelete(null)}
        onConfirm={confirmSingleDelete}
        title="리뷰 삭제"
        description={singleDelete ? <>"<strong>{singleDelete.title}</strong>" 리뷰와 모든 제출 데이터를 영구 삭제합니다. 되돌릴 수 없습니다.</> : null}
        confirmLabel="삭제"
        tone="danger"
      />
      <ConfirmDialog
        open={confirmBulkClone}
        onClose={() => setConfirmBulkClone(false)}
        onConfirm={doBulkClone}
        title="사이클 복제"
        description={`${selected.size}개 사이클을 초안으로 복제합니다.`}
        confirmLabel="복제"
      />
      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={doBulkDelete}
        title="선택 사이클 삭제"
        description={`${selected.size}개 사이클과 모든 제출 데이터를 영구 삭제합니다. 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        tone="danger"
      />
    </div>
  );
}

export { DEFAULT_CYCLE_FILTERS };
