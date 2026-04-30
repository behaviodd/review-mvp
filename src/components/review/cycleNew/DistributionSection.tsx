import type { Dispatch, SetStateAction } from 'react';
import { MsInput, MsSelect } from '../../ui/MsControl';
import { MsButton } from '../../ui/MsButton';
import { MsDeleteIcon, MsPlusIcon } from '../../ui/MsIcons';
import type { DistributionBand, DistributionPolicy } from '../../../types';

interface DistributionFormSlice {
  distribution?: DistributionPolicy;
}

interface Props<F extends DistributionFormSlice> {
  form: F;
  setForm: Dispatch<SetStateAction<F>>;
}

const DEFAULT_BANDS: DistributionBand[] = [
  { label: 'S', ratio: 10 },
  { label: 'A', ratio: 30 },
  { label: 'B', ratio: 40 },
  { label: 'C', ratio: 15 },
  { label: 'D', ratio: 5 },
];

export function DistributionSection<F extends DistributionFormSlice>({ form, setForm }: Props<F>) {
  const policy = form.distribution;
  const enabled = !!policy;

  const toggle = (on: boolean) => {
    setForm(f => ({
      ...f,
      distribution: on ? { method: 'guide', bands: DEFAULT_BANDS } : undefined,
    }));
  };

  const updateMethod = (method: DistributionPolicy['method']) => {
    setForm(f => ({
      ...f,
      distribution: f.distribution ? { ...f.distribution, method } : undefined,
    }));
  };

  const updateBand = (idx: number, patch: Partial<DistributionBand>) => {
    setForm(f => ({
      ...f,
      distribution: f.distribution
        ? { ...f.distribution, bands: f.distribution.bands.map((b, i) => i === idx ? { ...b, ...patch } : b) }
        : undefined,
    }));
  };

  const removeBand = (idx: number) => {
    setForm(f => ({
      ...f,
      distribution: f.distribution
        ? { ...f.distribution, bands: f.distribution.bands.filter((_, i) => i !== idx) }
        : undefined,
    }));
  };

  const addBand = () => {
    setForm(f => ({
      ...f,
      distribution: f.distribution
        ? { ...f.distribution, bands: [...f.distribution.bands, { label: `등급${f.distribution.bands.length + 1}`, ratio: 0 }] }
        : undefined,
    }));
  };

  const totalRatio = policy ? policy.bands.reduce((sum, b) => sum + b.ratio, 0) : 0;

  return (
    <section className="rounded-xl border border-gray-010 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-080">등급 분포</h3>
          <p className="text-[11px] text-fg-subtlest">조직장 리뷰 제출 시 등급 비율을 가이드(참고용) 또는 강제(제출 제한) 합니다.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-060">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => toggle(e.target.checked)}
          />
          사용
        </label>
      </div>

      {enabled && policy && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-fg-subtle">방식</span>
            <MsSelect
              value={policy.method}
              onChange={e => updateMethod(e.target.value as DistributionPolicy['method'])}
              className="min-w-[120px]"
            >
              <option value="guide">가이드 (초과 시 경고)</option>
              <option value="hard">강제 (초과 시 제출 차단)</option>
            </MsSelect>
            <span className={`ml-auto text-[11px] ${totalRatio === 100 ? 'text-green-060' : 'text-orange-060'}`}>
              합계 {totalRatio}% {totalRatio !== 100 && '(100% 권장)'}
            </span>
          </div>

          <div className="space-y-1.5">
            {policy.bands.map((band, idx) => (
              <div key={idx} className="grid grid-cols-[80px_1fr_100px_auto] gap-2 items-center">
                <MsInput
                  value={band.label}
                  onChange={e => updateBand(idx, { label: e.target.value })}
                  placeholder="라벨"
                />
                <div className="h-2 rounded-full bg-gray-010 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-pink-040"
                    style={{ width: `${Math.min(100, band.ratio)}%` }}
                  />
                </div>
                <MsInput
                  type="number"
                  min={0}
                  max={100}
                  value={String(band.ratio)}
                  onChange={e => updateBand(idx, { ratio: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                  rightSlot={<span className="text-[11px] text-fg-subtlest">%</span>}
                />
                <button
                  type="button"
                  onClick={() => removeBand(idx)}
                  className="p-1.5 rounded text-fg-subtlest hover:text-red-050 hover:bg-red-005"
                  aria-label="삭제"
                >
                  <MsDeleteIcon size={12} />
                </button>
              </div>
            ))}
          </div>

          <MsButton variant="ghost" size="sm" leftIcon={<MsPlusIcon size={12} />} onClick={addBand}>
            등급 추가
          </MsButton>
        </div>
      )}
    </section>
  );
}
