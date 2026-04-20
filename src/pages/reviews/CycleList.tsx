import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '../../stores/reviewStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/dateUtils';
import { RefreshCw, Plus, ChevronRight, Pencil, FileText, Star, Trash2 } from 'lucide-react';
import { useShowToast } from '../../components/ui/Toast';
import type { ReviewStatus } from '../../types';

const STATUS_CONFIG: Record<ReviewStatus, { label: string; dot: string; text: string }> = {
  draft:          { label: '초안',        dot: 'bg-neutral-300',  text: 'text-neutral-500' },
  active:         { label: '진행 중',     dot: 'bg-primary-500',  text: 'text-primary-700' },
  self_review:    { label: '자기평가 중', dot: 'bg-primary-500',  text: 'text-primary-700' },
  manager_review: { label: '매니저 리뷰', dot: 'bg-primary-400',  text: 'text-primary-600' },
  calibration:    { label: '조율 중',     dot: 'bg-primary-400',  text: 'text-primary-600' },
  closed:         { label: '완료',        dot: 'bg-success-500',  text: 'text-success-700' },
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

export function CycleList() {
  const { cycles, templates, deleteTemplate } = useReviewStore();
  const navigate = useNavigate();
  const showToast = useShowToast();
  const [tab, setTab] = useState<'cycles' | 'templates'>('cycles');

  const handleDeleteTemplate = (id: string, name: string) => {
    if (confirm(`"${name}" 템플릿을 삭제하시겠습니까?`)) {
      deleteTemplate(id);
      showToast('success', '템플릿이 삭제되었습니다.');
    }
  };

  const active = cycles.filter(c => c.status !== 'closed' && c.status !== 'draft');
  const closed = cycles.filter(c => c.status === 'closed');

  const Row = ({ cycle }: { cycle: typeof cycles[0] }) => (
    <div
      onClick={() => navigate(`/cycles/${cycle.id}`)}
      className="group flex items-center gap-4 px-5 py-3.5 border-b border-zinc-950/5 last:border-0 hover:bg-neutral-50/60 cursor-pointer transition-colors"
    >
      {/* 이름 + 유형 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 group-hover:text-primary-700 truncate leading-snug">
          {cycle.title}
        </p>
        <p className="text-xs text-neutral-400 mt-0.5">
          {cycle.type === 'scheduled' ? '정기' : '수시'} · 생성 {formatDate(cycle.createdAt)}
        </p>
      </div>

      {/* 단계 */}
      <div className="w-28 flex-shrink-0">
        <StatusChip status={cycle.status} />
      </div>

      {/* 완료율 */}
      <div className="w-28 flex-shrink-0">
        {cycle.status !== 'draft' ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${cycle.completionRate === 100 ? 'bg-success-400' : 'bg-primary-400'}`}
                style={{ width: `${cycle.completionRate ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-neutral-500 tabular-nums w-7 text-right">{cycle.completionRate ?? 0}%</span>
          </div>
        ) : (
          <span className="text-xs text-neutral-300">—</span>
        )}
      </div>

      {/* 마감일 */}
      <div className="w-24 flex-shrink-0 text-right">
        <p className="text-xs text-neutral-600">{formatDate(cycle.selfReviewDeadline)}</p>
        <p className="text-xs text-neutral-400 mt-0.5">자기평가 마감</p>
      </div>

      {cycle.status !== 'closed' && (
        <button
          onClick={e => { e.stopPropagation(); navigate(`/cycles/${cycle.id}?edit=1`); }}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-500 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-all"
        >
          <Pencil className="w-3 h-3" /> 편집
        </button>
      )}
      <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-primary-400 flex-shrink-0" />
    </div>
  );

  const ColHeader = () => (
    <div className="flex items-center gap-4 px-5 py-2.5 border-b border-zinc-950/5 bg-neutral-50/50">
      <div className="flex-1 text-xs font-semibold text-neutral-400 uppercase tracking-wide">리뷰</div>
      <div className="w-28 text-xs font-semibold text-neutral-400 uppercase tracking-wide">단계</div>
      <div className="w-28 text-xs font-semibold text-neutral-400 uppercase tracking-wide">완료율</div>
      <div className="w-24 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wide">마감일</div>
      <div className="w-4" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">리뷰 운영</h1>
        {tab === 'cycles' ? (
          <button
            onClick={() => navigate('/cycles/new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 새 리뷰
          </button>
        ) : (
          <button
            onClick={() => navigate('/templates/new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 새 템플릿
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 bg-neutral-100 rounded-lg w-fit">
        {(['cycles', 'templates'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t === 'cycles' ? '리뷰 사이클' : '평가 템플릿'}
          </button>
        ))}
      </div>

      {/* 리뷰 사이클 탭 */}
      {tab === 'cycles' && (
        cycles.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="아직 생성된 리뷰가 없습니다."
            description="새 리뷰를 만들어 팀의 성장 돌아보기를 시작해보세요."
            actionLabel="새 리뷰 만들기"
            onAction={() => navigate('/cycles/new')}
          />
        ) : (
          <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card overflow-hidden">
            <ColHeader />
            {active.length > 0 && (
              <>
                <div className="px-5 py-2 bg-white border-b border-zinc-950/5">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">진행 중 {active.length}</span>
                </div>
                {active.map(c => <Row key={c.id} cycle={c} />)}
              </>
            )}
            {closed.length > 0 && (
              <>
                <div className="px-5 py-2 bg-neutral-50/40 border-b border-zinc-950/5">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">완료 {closed.length}</span>
                </div>
                {closed.map(c => <Row key={c.id} cycle={c} />)}
              </>
            )}
          </div>
        )
      )}

      {/* 평가 템플릿 탭 */}
      {tab === 'templates' && (
        templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="아직 생성된 템플릿이 없습니다."
            description="평가 템플릿을 만들어 리뷰에 활용해보세요."
            actionLabel="새 템플릿 만들기"
            onAction={() => navigate('/templates/new')}
          />
        ) : (
          <div className="space-y-3">
            {templates.map(tmpl => (
              <div key={tmpl.id} className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5 hover:shadow-card-hover transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-neutral-900">{tmpl.name}</h3>
                        {tmpl.isDefault && (
                          <span className="flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                            <Star className="w-3 h-3" /> 기본
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{tmpl.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <button
                      onClick={() => navigate(`/cycles/new?templateId=${tmpl.id}`)}
                      className="px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-3 h-3 inline mr-1" />리뷰 생성
                    </button>
                    <button
                      onClick={() => navigate(`/templates/${tmpl.id}`)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                    >
                      편집
                    </button>
                    {!tmpl.isDefault && (
                      <button
                        onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                        className="p-1.5 text-neutral-400 hover:text-danger-500 hover:bg-danger-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-950/5">
                  <div className="flex items-center gap-4 text-xs text-neutral-400 mb-2">
                    <span>{tmpl.questions.length}개 문항</span>
                    <span>생성 {formatDate(tmpl.createdAt)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tmpl.questions.slice(0, 4).map(q => (
                      <span key={q.id} className={`text-xs px-2 py-0.5 rounded ${
                        q.isPrivate ? 'bg-neutral-100 text-neutral-500' : 'bg-primary-50 text-primary-600'
                      }`}>
                        {q.type === 'text' ? '주관식' : q.type === 'rating' ? '평점' : '역량'} · {q.text.slice(0, 14)}…
                      </span>
                    ))}
                    {tmpl.questions.length > 4 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-400">+{tmpl.questions.length - 4}개</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
