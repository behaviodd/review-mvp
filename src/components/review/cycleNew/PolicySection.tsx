import type { Dispatch, SetStateAction } from 'react';
import { MsCheckbox } from '../../ui/MsControl';
import { cn } from '../../../utils/cn';
import type { AnonymityPolicy, DistributionPolicy, ReferenceInfoPolicy, VisibilityPolicy, VisibilityWhen as _VisibilityWhen } from '../../../types';
import { DistributionSection } from './DistributionSection';
type VisibilityWhen = _VisibilityWhen;

interface PolicyFormSlice {
  anonymity?: AnonymityPolicy;
  visibility?: VisibilityPolicy;
  referenceInfo?: ReferenceInfoPolicy;
  distribution?: DistributionPolicy;
}

interface Props<F extends PolicyFormSlice> {
  form: F;
  setForm: Dispatch<SetStateAction<F>>;
}

export function PolicySection<F extends PolicyFormSlice>({ form, setForm }: Props<F>) {
  const updateAnonymity = (patch: Partial<AnonymityPolicy>) =>
    setForm(f => ({ ...f, anonymity: { ...(f.anonymity ?? {}), ...patch } }));
  const updateVisibility = (patch: Partial<VisibilityPolicy>) =>
    setForm(f => ({ ...f, visibility: { ...(f.visibility ?? {}), ...patch } }));
  const updateReference = (patch: Partial<ReferenceInfoPolicy>) =>
    setForm(f => ({ ...f, referenceInfo: { ...(f.referenceInfo ?? {}), ...patch } }));


  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-fg-default">리뷰 운영 정책</h2>
        <p className="text-xs text-fg-subtlest mt-0.5">
          익명·공개·참고 정보는 발행 후에도 <strong>리뷰 설정</strong> 드로어에서 다시 조정할 수 있습니다.
        </p>
      </div>

      {/* ── 익명 ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-010 bg-white p-4 space-y-2">
        <header>
          <h3 className="text-sm font-semibold text-gray-080">익명 설정</h3>
          <p className="text-[11px] text-fg-subtlest">피평가자가 결과를 볼 때 작성자 이름이 가려집니다. 관리자 뷰·감사 로그에는 항상 실명이 남습니다.</p>
        </header>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <MsCheckbox
            checked={!!form.anonymity?.downward}
            onChange={e => updateAnonymity({ downward: e.target.checked })}
            label={<span className="text-sm">조직장 리뷰 익명</span>}
          />
          <MsCheckbox
            checked={!!form.anonymity?.peer}
            onChange={e => updateAnonymity({ peer: e.target.checked })}
            label={<span className="text-sm">동료 리뷰 익명</span>}
          />
          <MsCheckbox
            checked={!!form.anonymity?.upward}
            onChange={e => updateAnonymity({ upward: e.target.checked })}
            label={<span className="text-sm">상향 리뷰 익명</span>}
          />
          <MsCheckbox
            checked={!!form.anonymity?.self}
            onChange={e => updateAnonymity({ self: e.target.checked })}
            label={<span className="text-sm">자기평가 익명 <span className="text-[10px] text-fg-subtlest">(거의 사용 X)</span></span>}
          />
        </div>
      </section>

      {/* ── 공개 범위 ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-010 bg-white p-4 space-y-3">
        <header>
          <h3 className="text-sm font-semibold text-gray-080">결과 공개 범위 (→ 피평가자)</h3>
          <p className="text-[11px] text-fg-subtlest">피평가자가 자신에 대한 리뷰를 언제 볼 수 있는지 유형별로 결정합니다.</p>
        </header>
        {([
          { key: 'downwardToReviewee', label: '조직장 리뷰' },
          { key: 'peerToReviewee',     label: '동료 리뷰' },
          { key: 'upwardToReviewee',   label: '상향 리뷰' },
        ] as const).map(row => {
          const current: VisibilityWhen = form.visibility?.[row.key] ?? 'cycle_close';
          return (
            <div key={row.key} className="space-y-1">
              <p className="text-xs font-medium text-gray-070">{row.label}</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {([
                  { value: 'submission',   label: '제출 즉시',    hint: '제출하는 순간 공개' },
                  { value: 'cycle_close',  label: '사이클 종료 후', hint: '관리자가 사이클을 종료하면 일괄 공개' },
                ] as const).map(opt => {
                  const active = current === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateVisibility({ [row.key]: opt.value } as Partial<VisibilityPolicy>)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-pink-040 bg-pink-005 text-pink-060'
                          : 'border-gray-010 bg-white text-gray-070 hover:bg-gray-005',
                      )}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-[11px] text-fg-subtlest mt-0.5">{opt.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* ── 참고 정보 ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-010 bg-white p-4 space-y-2">
        <header>
          <h3 className="text-sm font-semibold text-gray-080">작성 시 참고 정보</h3>
          <p className="text-[11px] text-fg-subtlest">리뷰 작성 화면 상단에 자동 첨부됩니다. 필요한 항목만 선택하세요.</p>
        </header>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <MsCheckbox
            checked={!!form.referenceInfo?.includeGoals}
            onChange={e => updateReference({ includeGoals: e.target.checked })}
            label={<span className="text-sm">피평가자의 목표(Goals)</span>}
          />
          <MsCheckbox
            checked={!!form.referenceInfo?.includePreviousReview}
            onChange={e => updateReference({ includePreviousReview: e.target.checked })}
            label={<span className="text-sm">직전 사이클 요약</span>}
          />
        </div>
      </section>

      {/* ── 등급 분포 ───────────────────────────────────────────── */}
      <DistributionSection form={form} setForm={setForm} />
    </div>
  );
}
