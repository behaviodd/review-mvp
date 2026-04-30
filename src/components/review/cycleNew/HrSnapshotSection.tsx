import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

interface SnapshotFormSlice {
  hrSnapshotMode?: 'live' | 'snapshot';
}

interface Props<F extends SnapshotFormSlice> {
  form: F;
  setForm: Dispatch<SetStateAction<F>>;
}

const OPTIONS: { value: 'snapshot' | 'live'; title: string; desc: string; recommended?: boolean }[] = [
  {
    value: 'snapshot',
    title: '스냅샷 적용',
    desc: '발행 시점의 인사정보(구성원·조직·평가권)를 동결합니다. 사이클 진행 중 조직 개편이 일어나도 평가자가 바뀌지 않아 안정적입니다.',
    recommended: true,
  },
  {
    value: 'live',
    title: '실시간 적용',
    desc: '항상 최신 인사정보를 반영합니다. 구성원이 팀을 옮기면 즉시 새 평가자가 매핑됩니다. 조직 개편이 없는 짧은 사이클에 적합합니다.',
  },
];

/**
 * R4: 사이클 발행 시 인사정보 적용 방식 선택.
 * 기본 'snapshot'. live 는 명시 선택.
 */
export function HrSnapshotSection<F extends SnapshotFormSlice>({ form, setForm }: Props<F>) {
  const current = form.hrSnapshotMode ?? 'snapshot';

  const select = (mode: 'live' | 'snapshot') => {
    setForm(f => ({ ...f, hrSnapshotMode: mode }));
  };

  return (
    <div className="rounded-xl border border-gray-010 bg-white p-4 space-y-3">
      <header>
        <h3 className="text-sm font-semibold text-gray-080">인사정보 적용 방식</h3>
        <p className="text-[11px] text-fg-subtlest">
          이 사이클이 어느 시점의 조직·평가권을 사용할지 결정합니다.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {OPTIONS.map(opt => {
          const active = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              className={cn(
                'flex flex-col gap-1.5 rounded-lg border px-4 py-3 text-left transition-colors',
                active ? 'border-pink-040 bg-pink-005' : 'border-gray-010 bg-white hover:bg-gray-005',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex size-4 rounded-full border-2 items-center justify-center flex-shrink-0',
                    active ? 'border-pink-040' : 'border-gray-020',
                  )}
                >
                  {active && <span className="size-2 rounded-full bg-pink-040" />}
                </span>
                <span className={cn('text-sm font-semibold', active ? 'text-pink-060' : 'text-gray-080')}>
                  {opt.title}
                </span>
                {opt.recommended && (
                  <span className="ml-auto inline-flex items-center rounded-full border border-blue-020 bg-blue-005 px-1.5 py-0.5 text-[10px] font-semibold text-blue-070">
                    권장
                  </span>
                )}
              </div>
              <p className="text-[11px] text-fg-subtle leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
