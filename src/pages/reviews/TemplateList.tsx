import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { MsArticleIcon, MsPlusIcon, MsStarIcon, MsDeleteIcon } from '../../components/ui/MsIcons';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';

export function TemplateList() {
  const { templates, deleteTemplate } = useReviewStore();
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const headerActions = useMemo(() => (
    <MsButton onClick={() => navigate('/templates/new')} leftIcon={<MsPlusIcon size={16} />}>
      새 템플릿
    </MsButton>
  ), [navigate]);
  // Phase D-3.E: subtitle 제거 (다른 페이지 패턴 일관)
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
      {/* Phase D-3.E-fix: 질문 미리보기 캡슐 제거 + 메타정보 인라인으로 더 컴팩트
         (사용자 명시 — 질문 캡슐 삭제 + 컴팩트) */}
      <div className="border-y border-bd-default divide-y divide-bd-default">
        {templates.map(tmpl => (
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
