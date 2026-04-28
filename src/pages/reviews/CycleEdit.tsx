import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput } from '../../components/ui/MsControl';
import { MsCheckIcon } from '../../components/ui/MsIcons';
import { EmptyState } from '../../components/ui/EmptyState';
import { getDescendantOrgUnitIds } from '../../utils/userCompat';
import { isSystemOperator } from '../../utils/permissions';

export function CycleEdit() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const showToast = useShowToast();
  const { cycles, templates, updateCycle } = useReviewStore();
  const { users, orgUnits } = useTeamStore();

  const cycle = cycles.find(c => c.id === cycleId);

  const handleBack = useCallback(() => {
    if (cycleId) navigate(`/cycles/${cycleId}`);
    else navigate('/cycles');
  }, [navigate, cycleId]);

  useSetPageHeader('리뷰 편집', undefined, { onBack: handleBack });

  const toDateInput = (iso: string) => iso.slice(0, 10);

  const [form, setForm] = useState(() =>
    cycle
      ? {
          title: cycle.title,
          type: cycle.type,
          templateId: cycle.templateId,
          targetDepartments: [...cycle.targetDepartments],
          selfReviewDeadline: toDateInput(cycle.selfReviewDeadline),
          managerReviewDeadline: toDateInput(cycle.managerReviewDeadline),
        }
      : null,
  );

  if (!cycle) {
    return (
      <EmptyState
        illustration="empty-cycle"
        title="리뷰를 찾을 수 없어요"
        description="삭제되었거나 접근 권한이 없는 사이클입니다."
        action={{ label: '리뷰 목록으로', onClick: () => navigate('/cycles') }}
      />
    );
  }

  if (cycle.editLockedAt) {
    return (
      <EmptyState
        illustration="empty-cycle"
        title="편집이 잠긴 리뷰예요"
        description="잠금 해제 후 편집할 수 있습니다. 상세 화면에서 잠금 해제를 진행해 주세요."
        action={{ label: '상세 화면으로', onClick: () => navigate(`/cycles/${cycle.id}`) }}
      />
    );
  }

  if (!form) return null;

  // R7: 부서 목록을 orgUnits.mainOrg 에서 직접 — legacy department 가 비어있어도 표시.
  const departments = orgUnits
    .filter(o => o.type === 'mainOrg')
    .map(o => o.name)
    .sort();

  // R7: 대상 인원 카운트 — orgUnitId 트리 매칭 우선, legacy 이름 매칭 폴백.
  const selectedSubtreeIds = new Set<string>();
  for (const dept of form.targetDepartments) {
    const main = orgUnits.find(o => o.type === 'mainOrg' && o.name === dept);
    if (main) {
      for (const id of getDescendantOrgUnitIds(main.id, orgUnits)) {
        selectedSubtreeIds.add(id);
      }
    }
  }
  const targetMembers = users.filter(u => {
    if (isSystemOperator(u)) return false;
    if (u.orgUnitId && selectedSubtreeIds.has(u.orgUnitId)) return true;
    return form.targetDepartments.includes(u.department);
  });

  const isValid = !!form.title.trim() && form.targetDepartments.length > 0;

  const toggleDept = (dept: string) =>
    setForm(f =>
      f
        ? {
            ...f,
            targetDepartments: f.targetDepartments.includes(dept)
              ? f.targetDepartments.filter(d => d !== dept)
              : [...f.targetDepartments, dept],
          }
        : f,
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    updateCycle(cycle.id, {
      title: form.title,
      type: form.type,
      templateId: form.templateId,
      targetDepartments: form.targetDepartments,
      selfReviewDeadline: new Date(form.selfReviewDeadline).toISOString(),
      managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
    });
    showToast('success', '리뷰가 수정되었습니다.');
    navigate(`/cycles/${cycle.id}`);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white rounded-xl border border-gray-020 shadow-card p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <section>
            <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">기본 정보</p>
            <MsInput
              label="리뷰 이름 *"
              type="text"
              value={form.title}
              onChange={e => setForm(f => (f ? { ...f, title: e.target.value } : f))}
            />
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-060 mb-1.5">리뷰 유형</label>
              <div className="flex gap-2">
                {([['scheduled', '정기 리뷰'], ['adhoc', '수시 리뷰']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm(f => (f ? { ...f, type: val } : f))}
                    className={`flex-1 py-2 rounded border-2 text-sm font-medium transition-all ${
                      form.type === val
                        ? 'border-pink-040 bg-pink-005 text-pink-060'
                        : 'border-gray-020 text-gray-060 hover:border-gray-030'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">리뷰 템플릿</p>
            <div className="space-y-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm(f => (f ? { ...f, templateId: t.id } : f))}
                  className={`w-full flex items-center justify-between p-3 rounded border-2 text-left transition-all ${
                    form.templateId === t.id
                      ? 'border-pink-040 bg-pink-005'
                      : 'border-gray-020 hover:border-gray-030'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${form.templateId === t.id ? 'text-pink-060' : 'text-gray-070'}`}>
                      {t.name}
                    </p>
                    <p className="text-xs text-gray-040 mt-0.5">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-xs text-gray-040 bg-gray-010 px-1.5 py-0.5 rounded">
                      {t.questions.length}문항
                    </span>
                    {form.templateId === t.id && <MsCheckIcon size={16} className="text-pink-050" />}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">대상 부서</p>
            <div className="flex flex-wrap gap-2">
              {departments.map(dept => {
                const selected = form.targetDepartments.includes(dept);
                const main = orgUnits.find(o => o.type === 'mainOrg' && o.name === dept);
                const subtree = main ? getDescendantOrgUnitIds(main.id, orgUnits) : new Set<string>();
                const count = users.filter(u => {
                  if (isSystemOperator(u)) return false;
                  if (u.orgUnitId && subtree.has(u.orgUnitId)) return true;
                  return u.department === dept;
                }).length;
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-all ${
                      selected
                        ? 'border-pink-040 bg-pink-005 text-pink-060'
                        : 'border-gray-020 text-gray-060 hover:border-gray-030'
                    }`}
                  >
                    {selected && <MsCheckIcon size={12} />}
                    {dept}
                    <span className="text-gray-040">{count}명</span>
                  </button>
                );
              })}
            </div>
            {form.targetDepartments.length > 0 && (
              <p className="text-xs text-gray-040 mt-2">
                총 <strong className="text-gray-070">{targetMembers.length}명</strong> 포함
              </p>
            )}
          </section>

          <section>
            <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">일정</p>
            <div className="grid grid-cols-2 gap-3">
              <MsInput
                label="자기평가 마감일 *"
                type="date"
                value={form.selfReviewDeadline}
                onChange={e =>
                  setForm(f => (f ? { ...f, selfReviewDeadline: e.target.value } : f))
                }
              />
              <MsInput
                label="조직장 리뷰 마감일 *"
                type="date"
                value={form.managerReviewDeadline}
                onChange={e =>
                  setForm(f => (f ? { ...f, managerReviewDeadline: e.target.value } : f))
                }
              />
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-010">
            <MsButton variant="ghost" type="button" onClick={handleBack}>
              취소
            </MsButton>
            <MsButton type="submit" disabled={!isValid}>
              저장하기
            </MsButton>
          </div>
        </form>
      </div>
    </div>
  );
}
