import type { Dispatch, SetStateAction } from 'react';
import { MsSwitch, MsInput } from '../../ui/MsControl';
import { cn } from '../../../utils/cn';
import type { AutoAdvanceRule, ReminderRule } from '../../../types';
import { presetByKey, detectPreset, type PresetKey, PRESET_STANDARD, PRESET_STRONG } from '../../../utils/scheduler/presets';

interface AutomationFormSlice {
  scheduledPublishAt?: string;
  autoAdvance?: AutoAdvanceRule;
  reminderPolicy?: ReminderRule[];
}

interface Props<F extends AutomationFormSlice> {
  form: F;
  setForm: Dispatch<SetStateAction<F>>;
}

function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // input[type=datetime-local] 포맷 YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AutomationSection<F extends AutomationFormSlice>({ form, setForm }: Props<F>) {
  const preset: PresetKey = detectPreset(form.reminderPolicy);

  const toggleScheduledPublish = (on: boolean) => {
    if (on) {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      setForm(f => ({ ...f, scheduledPublishAt: next.toISOString() }));
    } else {
      setForm(f => ({ ...f, scheduledPublishAt: undefined }));
    }
  };

  const toggleAutoAdvance = (on: boolean) => {
    setForm(f => ({
      ...f,
      autoAdvance: on
        ? { stage: 'self_to_manager', graceHours: 24, threshold: 80 }
        : undefined,
    }));
  };

  const updateAutoAdvance = (patch: Partial<AutoAdvanceRule>) => {
    setForm(f => ({
      ...f,
      autoAdvance: f.autoAdvance ? { ...f.autoAdvance, ...patch } : undefined,
    }));
  };

  const selectPreset = (key: PresetKey) => {
    if (key === 'custom') {
      // custom은 표준 프리셋을 시드로 제공, 이후 사용자가 편집
      setForm(f => ({ ...f, reminderPolicy: f.reminderPolicy?.length ? f.reminderPolicy : [...PRESET_STANDARD] }));
      return;
    }
    const rules = presetByKey(key);
    setForm(f => ({ ...f, reminderPolicy: rules }));
  };

  return (
    <div className="rounded-xl border border-gray-010 bg-gray-001 p-4 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-080">자동화 (선택)</h3>
        <p className="text-[11px] text-fg-subtlest">관리자 개입 없이 자동 실행될 규칙을 설정합니다. 모든 스위치는 OFF가 기본이고, 감사 로그에 실행 이력이 남습니다.</p>
      </div>

      {/* ── 예약 발행 ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base text-gray-080">예약 발행</p>
          <p className="text-[11px] text-fg-subtlest mt-0.5">지정한 시각에 사이클이 자동으로 발행됩니다.</p>
        </div>
        <MsSwitch checked={!!form.scheduledPublishAt} onChange={toggleScheduledPublish} />
      </div>
      {form.scheduledPublishAt && (
        <div className="pl-1">
          <MsInput
            label="발행 일시"
            type="datetime-local"
            value={toLocalInput(form.scheduledPublishAt)}
            onChange={e => {
              const iso = e.target.value ? new Date(e.target.value).toISOString() : undefined;
              setForm(f => ({ ...f, scheduledPublishAt: iso }));
            }}
          />
        </div>
      )}

      <div className="h-px bg-gray-010" />

      {/* ── 자동 단계 전환 ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base text-gray-080">자동 단계 전환</p>
          <p className="text-[11px] text-fg-subtlest mt-0.5">자기평가 마감 후 일정 시간과 제출율 조건이 만족되면 조직장 리뷰 단계로 자동 전환합니다.</p>
        </div>
        <MsSwitch checked={!!form.autoAdvance} onChange={toggleAutoAdvance} />
      </div>
      {form.autoAdvance && (
        <div className="grid grid-cols-2 gap-3 pl-1">
          <MsInput
            label="Grace (시간)"
            type="number"
            min={0}
            value={String(form.autoAdvance.graceHours)}
            onChange={e => updateAutoAdvance({ graceHours: Math.max(0, Number(e.target.value) || 0) })}
          />
          <MsInput
            label="최소 제출율 (%)"
            type="number"
            min={0}
            max={100}
            value={String(form.autoAdvance.threshold ?? 80)}
            onChange={e => {
              const v = Number(e.target.value);
              updateAutoAdvance({ threshold: Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : undefined });
            }}
          />
        </div>
      )}

      <div className="h-px bg-gray-010" />

      {/* ── 알림 정책 ── */}
      <div className="space-y-2">
        <p className="text-base text-gray-080">알림 정책 프리셋</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {([
            { key: 'none',     label: '없음',   hint: '자동 리마인드 없음' },
            { key: 'standard', label: '표준',   hint: 'D-3 · D-0' },
            { key: 'strong',   label: '강화',   hint: 'D-3 · D-0 · D+1' },
            { key: 'custom',   label: '커스텀', hint: '규칙 직접 편집 (현재는 표준 시드)' },
          ] as const).map(opt => {
            const active = preset === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => selectPreset(opt.key)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  active ? 'border-pink-040 bg-pink-005 text-pink-060' : 'border-gray-010 bg-white text-gray-070 hover:bg-gray-005',
                )}
              >
                <p className="text-xs font-semibold">{opt.label}</p>
                <p className="text-[10px] text-fg-subtlest mt-0.5">{opt.hint}</p>
              </button>
            );
          })}
        </div>
        {(preset === 'standard' || preset === 'strong' || preset === 'custom') && form.reminderPolicy && form.reminderPolicy.length > 0 && (
          <ul className="mt-1 space-y-1">
            {form.reminderPolicy.map(r => (
              <li key={r.id} className="text-[11px] text-fg-subtle">
                • {r.trigger === 'before_deadline' ? `마감 ${r.offsetHours}시간 전` : `마감 후 ${r.offsetHours}시간`}
                {' · '}
                {r.stage === 'self' ? '자기평가' : r.stage === 'manager' ? '조직장 리뷰' : '양 단계'}
                {' · '}
                {r.audience === 'not_started' ? '미시작' : r.audience === 'in_progress' ? '작성 중' : '미제출 전체'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export { PRESET_STANDARD, PRESET_STRONG };
