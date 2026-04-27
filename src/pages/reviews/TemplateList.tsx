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

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {templates.map(tmpl => (
          <div key={tmpl.id} className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5 hover:shadow-card-hover transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-pink-010 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MsArticleIcon size={16} className="text-pink-050" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-099">{tmpl.name}</h3>
                    {tmpl.isDefault && (
                      <span className="flex items-center gap-1 text-xs font-medium text-pink-050 bg-pink-005 px-2 py-0.5 rounded">
                        <MsStarIcon size={12} /> 기본
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-040 mt-0.5">{tmpl.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
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
                    className="p-1.5 text-gray-040 hover:text-red-040 hover:bg-red-005 rounded-xl transition-colors"
                  >
                    <MsDeleteIcon size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-950/5">
              <div className="flex items-center gap-4 text-xs text-gray-040 mb-2">
                <span>{tmpl.questions.length}개 문항</span>
                <span>생성 {formatDate(tmpl.createdAt)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tmpl.questions.slice(0, 4).map(q => (
                  <span key={q.id} className={`text-xs px-2 py-0.5 rounded ${
                    q.isPrivate ? 'bg-gray-010 text-gray-050' : 'bg-pink-005 text-pink-050'
                  }`}>
                    {q.type === 'text' ? '주관식' : q.type === 'rating' ? '평점' : '역량'} · {q.text.slice(0, 14)}…
                  </span>
                ))}
                {tmpl.questions.length > 4 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-010 text-gray-040">+{tmpl.questions.length - 4}개</span>
                )}
              </div>
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
