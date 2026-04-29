import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { MsArticleIcon, MsPlusIcon, MsStarIcon, MsDeleteIcon, MsSearchIcon, MsCancelIcon } from '../../components/ui/MsIcons';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput } from '../../components/ui/MsControl';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';

export function TemplateList() {
  const { templates, deleteTemplate } = useReviewStore();
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');

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
  useSetPageHeader('리뷰 템플릿', headerActions);

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

  /* Phase D-3.E: 카드 컨테이너 제거 — 평면 + 행 사이 divide-y border-bd-default
     "이전 컴포넌트 재사용" — 시트형 row 패턴 (§ 7.6) 정합 */
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
      <div className="border-y border-bd-default divide-y divide-bd-default">
        {visiblePage.map(tmpl => (
          <div key={tmpl.id} className="flex items-start justify-between gap-3 px-2 py-3 hover:bg-interaction-hovered transition-colors">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className="size-8 bg-bg-token-brand1-subtlest rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                <MsArticleIcon size={16} className="text-fg-brand1" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-fg-default">{tmpl.name}</h3>
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
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <MsButton
                size="sm"
                variant="outline-default"
                onClick={() => navigate(`/templates/${tmpl.id}`)}
              >
                편집
              </MsButton>
              {!tmpl.isDefault && (
                <button
                  onClick={() => handleDelete(tmpl.id, tmpl.name)}
                  className="p-1.5 text-fg-subtlest hover:text-red-050 hover:bg-red-005 rounded-md transition-colors"
                >
                  <MsDeleteIcon size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
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
