import { Fragment, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import {
  MsArticleIcon, MsPlusIcon, MsStarIcon, MsDeleteIcon, MsSearchIcon,
  MsCancelIcon, MsEditIcon, MsChevronRightLineIcon,
} from '../../components/ui/MsIcons';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput } from '../../components/ui/MsControl';
import { MsActionMenu } from '../../components/ui/MsActionMenu';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';

export function TemplateList() {
  const { templates, deleteTemplate } = useReviewStore();
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  // D-3.E-2: 더보기 메뉴 열린 row id — 해당 row 만 z-20 부여하여 메뉴가 다음 row hover/구분선 위로 레이어
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  /* 정렬: 기본 템플릿은 항상 최상단, 그 다음 최신 생성 순.
     (사용자 명시 — 최신이 위에 + 기본 템플릿이 정렬에서 밀려 사라지는 문제 fix) */
  const sorted = useMemo(
    () => [...templates].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [templates],
  );

  /* 검색 필터 — name + description */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q)
    );
  }, [sorted, search]);

  /* 페이지네이션 — 15개 (사용자 명시) */
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  const visiblePage = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  const headerActions = useMemo(() => (
    <>
      {/* 검색 input + 새 템플릿 버튼 (Team / Cycle 헤더 패턴 재사용) */}
      <MsInput
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="이름·설명 검색"
        leftSlot={<MsSearchIcon size={14} />}
        rightSlot={search ? (
          <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-default" aria-label="검색 지우기">
            <MsCancelIcon size={14} />
          </button>
        ) : undefined}
        className="w-56 h-10"
      />
      <MsButton size="lg" onClick={() => navigate('/templates/new')} leftIcon={<MsPlusIcon size={16} />}>
        새 템플릿
      </MsButton>
    </>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [navigate, search]);
  useSetPageHeader('템플릿', headerActions);

  const handleDelete = (id: string, name: string) => setDeleteTarget({ id, name });
  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteTemplate(deleteTarget.id);
    showToast('success', '템플릿이 삭제되었습니다.');
    setDeleteTarget(null);
  };

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={MsArticleIcon}
        title="아직 생성된 템플릿이 없습니다."
        description="리뷰 템플릿을 만들어 리뷰에 활용해보세요."
        actionLabel="새 템플릿 만들기"
        onAction={() => navigate('/templates/new')}
      />
    );
  }

  /* Phase D-3.E-2: CycleList row 패턴과 통일 (사용자 요청 — 디자인 일관성)
     - sibling divider (직선) + my-1.5 (위아래 6px = row 간 12px gap)
     - rounded-lg row + hover:bg-interaction-hovered
     - hover 액션 (편집 / 삭제) → MsActionMenu 더보기 메뉴
     - chevron 우측 (row 클릭 시 편집 페이지로) */
  return (
    <div>
      {/* 검색 결과 0건 처리 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={MsArticleIcon}
          title={`'${search}' 검색 결과가 없습니다.`}
          description="이름 또는 설명에 키워드가 일치하는 템플릿을 찾지 못했습니다."
          variant="inline"
        />
      ) : (
      <div className="flex flex-col">
        {visiblePage.map((tmpl, idx) => {
          const isMenuOpen = openMenuId === tmpl.id;
          return (
            <Fragment key={tmpl.id}>
              {idx > 0 && <div className="border-t border-bd-default" />}
              <div
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('[data-action]')) return;
                  navigate(`/templates/${tmpl.id}`);
                }}
                className={`relative group flex items-center gap-4 px-2 py-3 my-1.5 rounded-lg cursor-pointer transition-colors hover:bg-interaction-hovered ${isMenuOpen ? 'z-20' : ''}`}
              >
                <div className="size-8 bg-bg-token-brand1-subtlest rounded-md flex items-center justify-center flex-shrink-0">
                  <MsArticleIcon size={16} className="text-fg-brand1" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-fg-default group-hover:text-pink-060 truncate leading-snug">{tmpl.name}</h3>
                    {tmpl.isDefault && (
                      <span className="flex items-center gap-1 text-xs font-medium text-fg-brand1 bg-bg-token-brand1-subtlest px-2 py-0.5 rounded">
                        <MsStarIcon size={12} /> 기본
                      </span>
                    )}
                  </div>
                  {tmpl.description && (
                    <p className="text-xs text-fg-subtle mt-0.5 truncate">{tmpl.description}</p>
                  )}
                  <p className="text-[11px] text-fg-subtlest mt-0.5">
                    {tmpl.questions.length}개 문항 · 생성 {formatDate(tmpl.createdAt)}
                  </p>
                </div>
                <MsActionMenu
                  className="flex-shrink-0"
                  triggerVisibility="hover"
                  onOpenChange={open => setOpenMenuId(open ? tmpl.id : null)}
                  items={[
                    { label: '편집', icon: <MsEditIcon size={12} />, onClick: () => navigate(`/templates/${tmpl.id}`) },
                    { label: '삭제', icon: <MsDeleteIcon size={12} />, onClick: () => handleDelete(tmpl.id, tmpl.name), variant: 'danger', hidden: tmpl.isDefault },
                  ]}
                />
                <MsChevronRightLineIcon size={16} className="text-gray-030 group-hover:text-pink-040 flex-shrink-0" />
              </div>
            </Fragment>
          );
        })}
      </div>
      )}

      {/* 페이지네이션 (filtered.length > PAGE_SIZE 시만, CycleList 패턴 재사용) */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-fg-subtle tracking-[-0.3px]">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} / 총 {filtered.length}개
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="템플릿 삭제"
        description={deleteTarget ? <>"<strong>{deleteTarget.name}</strong>" 템플릿을 삭제합니다.</> : null}
        confirmLabel="삭제"
        tone="danger"
      />
    </div>
  );
}
