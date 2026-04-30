import { Fragment, useMemo, useState, useEffect } from 'react';
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
import { MsActionMenu } from '../../components/ui/MsActionMenu';
import { MsCheckbox } from '../../components/ui/MsControl';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { useShowToast } from '../../components/ui/Toast';
import { TagInput, tagColor } from '../../components/review/TagInput';
import { CycleBulkBar } from '../../components/review/CycleBulkBar';
import { BulkAddTagModal } from '../../components/review/modals/BulkAddTagModal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { HeaderTab } from '../../components/layout/HeaderTab';
import {
  DEFAULT_CYCLE_FILTERS, applyCycleFilters, filtersToParams, paramsToFilters,
  type CycleFilters, type CycleSort,
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

  /* Phase D-3.C-2: subtitle 제거 (사용자 명시 — 헤더 탭 count 와 중복).
     좌측 빠른 필터 4개 (전체/지연/이번분기/폴더미지정) → 헤더 탭. */
  const headerActions = useMemo(() => (
    <MsButton onClick={() => navigate('/cycles/new')} leftIcon={<MsPlusIcon size={16} />}>
      새 리뷰
    </MsButton>
  ), [navigate]);

  // 빠른 필터 카운트 (FolderSidebar 의 countFor 와 동일 로직 인라인)
  const quickCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const allActive = cycles.filter(c => !c.archivedAt);
    const overdue = allActive.filter(c => {
      if (c.status === 'closed') return false;
      if ((c.completionRate ?? 0) >= 100) return false;
      return c.selfReviewDeadline.slice(0, 10) < today || c.managerReviewDeadline.slice(0, 10) < today;
    }).length;
    const thisQuarter = allActive.filter(c => {
      const d = new Date();
      const q = Math.floor(d.getMonth() / 3);
      const qFrom = new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
      const qTo = new Date(d.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
      const created = c.createdAt.slice(0, 10);
      return created >= qFrom && created <= qTo;
    }).length;
    return { all: allActive.length, overdue, thisQuarter };
  }, [cycles]);

  const headerTabs = useMemo(() => (
    <>
      <HeaderTab
        active={filters.folder.kind === 'all'}
        onClick={() => update({ folder: { kind: 'all' } })}
      >
        전체 {quickCounts.all}
      </HeaderTab>
      <HeaderTab
        active={filters.folder.kind === 'overdue'}
        onClick={() => update({ folder: { kind: 'overdue' } })}
      >
        지연 {quickCounts.overdue}
      </HeaderTab>
      <HeaderTab
        active={filters.folder.kind === 'this_quarter'}
        onClick={() => update({ folder: { kind: 'this_quarter' } })}
      >
        이번 분기 {quickCounts.thisQuarter}
      </HeaderTab>
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [filters.folder.kind, quickCounts]);

  useSetPageHeader('리뷰 운영', headerActions, { tabs: headerTabs });

  /* Phase D-3.C-3: 페이지네이션 — 15개씩 (사용자 명시) */
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // 필터/검색 변경 시 page 1 로 reset (visible 길이 변화 감지)
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  const visiblePage = useMemo(
    () => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visible, page],
  );

  /* ── 선택 상태 ─────────────────────────────────────── */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // D-3.C-6: 더보기 메뉴 열린 row id — 해당 row 만 z-20 부여하여 메뉴가 다음 row hover/구분선 위로 레이어
  const [openMenuCycleId, setOpenMenuCycleId] = useState<string | null>(null);
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // Phase D-3.C-3: 현재 페이지(visiblePage) 만 토글 — 다른 페이지 영향 없음
  const toggleAllVisible = () => {
    const allSelected = visiblePage.every(c => selected.has(c.id));
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) {
        for (const c of visiblePage) next.delete(c.id);
      } else {
        for (const c of visiblePage) next.add(c.id);
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
  // Phase D-3.C-2: folderModal 제거 (폴더 기능 삭제)
  const [tagModal, setTagModal] = useState(false);
  const [singleDelete, setSingleDelete] = useState<{ id: string; title: string } | null>(null);
  const [confirmBulkClone, setConfirmBulkClone] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  /* ── 개별 행 액션 ──────────────────────────────────── */
  const handleDeleteCycle = (id: string, title: string) => {
    setSingleDelete({ id, title });
  };
  const confirmSingleDelete = () => {
    if (!singleDelete) return;
    deleteCycle(singleDelete.id);
    showToast('success', '리뷰가 삭제되었습니다.');
    setSingleDelete(null);
  };

  const handleArchiveCycle = (id: string) => {
    const res = archiveCycle(id, currentUser?.id ?? 'system');
    showToast(res.ok ? 'success' : 'error', res.ok ? '보관함으로 이동했습니다.' : (res.error ?? '실패'));
  };

  const handleCloneCycle = (id: string) => {
    navigate(`/cycles/new?from=${id}`);
  };

  /* Phase D-3.C-2: 폴더 기능 삭제 — moveCyclesToFolder, onBulkMoveFolder 제거.
     filters.folder.kind 는 빠른 필터 (all/overdue/this_quarter/none) 만 사용,
     'folder' kind 옵션은 UI 에서 더 이상 노출되지 않음. */

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

  // Phase D-3.C-3: 페이지네이션 후 — "보이는 전체 선택" 은 현재 페이지(visiblePage) 기준
  const allChecked = visiblePage.length > 0 && visiblePage.every(c => selected.has(c.id));
  const someChecked = visiblePage.some(c => selected.has(c.id));

  /* Phase D-3.C-2: FolderSidebar 제거. 빠른 필터는 헤더 탭으로 (위 useSetPageHeader).
     ListToolbar 의 카드 컨테이너 (rounded-xl border bg-white shadow-card) 제거 — 평면.
     리스트 컨테이너도 평면 + 시트형 row. */
  return (
    <div className="space-y-4">
      {/* 필터 바 — 컨테이너 카드 제거, 평면 */}
      <div className="space-y-3">
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
          /* Phase D-3.C-3: wrapper 에 border-b 추가 — 리스트 하단 라인 (사용자 명시) */
          <div className="border-b border-bd-default">
            {/* 컬럼 헤더 — 카드 컨테이너 제거, 평면 + border-b */}
            <div className="flex items-center gap-4 px-2 py-2 border-b border-bd-default">
              <div className="w-5 shrink-0">
                <MsCheckbox
                  checked={allChecked}
                  indeterminate={!allChecked && someChecked}
                  onChange={toggleAllVisible}
                  aria-label="보이는 전체 선택"
                />
              </div>
              <div className="flex-1 text-xs font-semibold text-fg-subtlest uppercase tracking-wide">리뷰</div>
              <div className="w-28 text-xs font-semibold text-fg-subtlest uppercase tracking-wide">단계</div>
              <div className="w-28 text-xs font-semibold text-fg-subtlest uppercase tracking-wide">완료율</div>
              <div className="w-24 text-right text-xs font-semibold text-fg-subtlest uppercase tracking-wide">마감일</div>
              <div className="w-4" />
            </div>
            {/* Phase D-3.C-2: row 평면화 — 행간 border 제거, hover 효과만. drag 도 제거 (폴더 기능 폐기)
               Phase D-3.C-3: visiblePage 만 렌더 (15개씩 페이지네이션)
               Phase D-3.C-4: 행간 12px 여백 (사용자 요청) — rows 만 별도 wrapper 로 묶고 gap-3
               Phase D-3.C-5: 행간 구분선 + hover 액션 더보기 메뉴 통합 (사용자 요청)
               Phase D-3.C-6: 구분선을 row 의 rounded 와 무관한 직선으로 (sibling divider) +
                              메뉴 열린 row 에 z-20 (다음 row hover/구분선 위로 레이어) */}
            <div className="flex flex-col">
            {visiblePage.map((cycle, idx) => {
              const isSelected = selected.has(cycle.id);
              const isMenuOpen = openMenuCycleId === cycle.id;
              return (
                <Fragment key={cycle.id}>
                  {/* 구분선 — 첫 row 위엔 없음. wrapper 너비 전체에 직선 (row rounded 와 무관) */}
                  {idx > 0 && <div className="border-t border-bd-default" />}
                  <div
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('[data-action]')) return;
                      navigate(`/cycles/${cycle.id}`);
                    }}
                    className={cn(
                      'relative group flex items-center gap-4 px-2 py-3 my-1.5 rounded-lg cursor-pointer transition-colors',
                      isMenuOpen && 'z-20',
                      isSelected ? 'bg-bg-token-brand1-subtlest' : 'hover:bg-interaction-hovered',
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

                  {/* Phase D-3.C-5: hover 액션 4개 → 더보기 메뉴 1개로 통합 (사용자 요청)
                     trigger 자체는 group-hover 시에만 노출 + 메뉴 열림 동안 강제 visible */}
                  <MsActionMenu
                    className="flex-shrink-0"
                    triggerVisibility="hover"
                    onOpenChange={open => setOpenMenuCycleId(open ? cycle.id : null)}
                    items={[
                      { label: '복제', icon: <MsArticleIcon size={12} />, onClick: () => handleCloneCycle(cycle.id) },
                      {
                        label: cycle.status === 'draft' ? '이어 쓰기' : '편집',
                        icon: <MsEditIcon size={12} />,
                        onClick: () => navigate(cycle.status === 'draft' ? `/cycles/new?draft=${cycle.id}` : `/cycles/${cycle.id}?edit=1`),
                      },
                      { label: '보관', icon: <MsCancelIcon size={12} />, onClick: () => handleArchiveCycle(cycle.id), hidden: cycle.status !== 'closed' },
                      { label: '삭제', icon: <MsDeleteIcon size={12} />, onClick: () => handleDeleteCycle(cycle.id, cycle.title), variant: 'danger' },
                    ]}
                  />
                  <MsChevronRightLineIcon size={16} className="text-gray-030 group-hover:text-pink-040 flex-shrink-0" />
                  </div>
                </Fragment>
              );
            })}
            </div>
          </div>
        )}

      {/* Phase D-3.C-3: 페이지네이션 UI (visible.length > PAGE_SIZE 시만 노출) */}
      {visible.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-fg-subtle tracking-[-0.3px]">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} / 총 {visible.length}건
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-8 px-3 text-xs font-semibold rounded-md border border-bd-default text-fg-default hover:bg-interaction-hovered disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              이전
            </button>
            <span className="px-3 text-xs text-fg-default tabular-nums">
              <strong className="font-bold">{page}</strong> <span className="text-fg-subtlest">/ {totalPages}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-8 px-3 text-xs font-semibold rounded-md border border-bd-default text-fg-default hover:bg-interaction-hovered disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}

      <CycleBulkBar
        selectedCount={selected.size}
        totalMembers={selectedStats.members}
        totalSubmissions={selectedStats.subs}
        onClear={clearSelection}
        onAddTag={() => setTagModal(true)}
        onArchive={onBulkArchive}
        onClone={onBulkClone}
        onDelete={onBulkDelete}
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
