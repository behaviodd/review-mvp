import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { useAuthStore } from '../../stores/authStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { MsRefreshIcon, MsChevronRightLineIcon, MsDeleteIcon } from '../../components/ui/MsIcons';
import { MsButton } from '../../components/ui/MsButton';
import { ListToolbar } from '../../components/ui/ListToolbar';
import { useShowToast } from '../../components/ui/Toast';
import { tagColor } from '../../components/review/TagInput';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { cn } from '../../utils/cn';

export function CycleArchive() {
  const { cycles, unarchiveCycle, deleteCycle } = useReviewStore();
  const currentUser = useAuthStore(s => s.currentUser);
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [query, setQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const archived = useMemo(
    () => cycles
      .filter(c => !!c.archivedAt)
      .filter(c => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return c.title.toLowerCase().includes(q) || (c.tags ?? []).some(t => t.toLowerCase().includes(q));
      })
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [cycles, query],
  );

  const totalArchived = cycles.filter(c => c.archivedAt).length;
  useSetPageHeader('보관함', undefined, {
    subtitle: `보관된 리뷰 ${totalArchived}개`,
  });

  if (totalArchived === 0) {
    return (
      <EmptyState
        icon={MsRefreshIcon}
        title="보관된 리뷰가 없습니다."
        description="종료된 리뷰를 목록에서 정리하려면 '보관'을 사용하세요."
        action={{ label: '리뷰 목록으로', onClick: () => navigate('/cycles') }}
      />
    );
  }

  const handleRestore = (id: string) => {
    const res = unarchiveCycle(id, currentUser?.id ?? 'system');
    showToast(res.ok ? 'success' : 'error', res.ok ? '보관을 해제했습니다.' : (res.error ?? '실패'));
  };

  const handleDelete = (id: string, title: string) => setDeleteTarget({ id, title });
  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteCycle(deleteTarget.id);
    showToast('success', '리뷰가 삭제되었습니다.');
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <ListToolbar
        search={{
          value: query,
          onChange: setQuery,
          placeholder: '제목·태그 검색',
          width: 'md',
        }}
      />

      {archived.length === 0 ? (
        <EmptyState
          icon={MsRefreshIcon}
          title="검색 결과가 없습니다."
          description="다른 검색어를 입력해 보세요."
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-010 shadow-card overflow-hidden">
          {archived.map(cycle => (
            <div
              key={cycle.id}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-005 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-080 truncate">{cycle.title}</p>
                  {(cycle.tags ?? []).map(t => (
                    <span key={t} className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', tagColor(t))}>
                      #{t}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-040 mt-0.5">
                  종료 {formatDate(cycle.managerReviewDeadline)} · 보관 {formatDate(cycle.archivedAt ?? cycle.createdAt)}
                </p>
              </div>
              <MsButton
                size="sm"
                variant="outline-default"
                onClick={() => handleRestore(cycle.id)}
                leftIcon={<MsRefreshIcon size={12} />}
              >
                복원
              </MsButton>
              <MsButton
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/cycles/${cycle.id}`)}
                rightIcon={<MsChevronRightLineIcon size={12} />}
              >
                열기
              </MsButton>
              <MsButton
                size="sm"
                variant="outline-red"
                onClick={() => handleDelete(cycle.id, cycle.title)}
                leftIcon={<MsDeleteIcon size={12} />}
              >
                삭제
              </MsButton>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="리뷰 영구 삭제"
        description={deleteTarget ? <>"<strong>{deleteTarget.title}</strong>" 리뷰와 모든 제출 데이터를 영구 삭제합니다. 복구할 수 없습니다.</> : null}
        confirmLabel="삭제"
        tone="danger"
      />
    </div>
  );
}
