import type { ReminderRule } from '../../types';

export const PRESET_STANDARD: ReminderRule[] = [
  { id: 'p-d3', trigger: 'before_deadline', offsetHours: 72, audience: 'not_started', stage: 'both', channel: 'inapp' },
  { id: 'p-d0', trigger: 'before_deadline', offsetHours: 0,  audience: 'all_pending', stage: 'both', channel: 'inapp' },
];

export const PRESET_STRONG: ReminderRule[] = [
  ...PRESET_STANDARD,
  { id: 'p-dplus1', trigger: 'overdue', offsetHours: 24, audience: 'all_pending', stage: 'both', channel: 'inapp' },
];

export type PresetKey = 'none' | 'standard' | 'strong' | 'custom';

export function presetByKey(key: PresetKey): ReminderRule[] | undefined {
  if (key === 'none') return [];
  if (key === 'standard') return PRESET_STANDARD;
  if (key === 'strong') return PRESET_STRONG;
  return undefined;
}

export function detectPreset(rules?: ReminderRule[]): PresetKey {
  if (!rules || rules.length === 0) return 'none';
  const ids = rules.map(r => r.id).sort().join(',');
  if (ids === [...PRESET_STANDARD].map(r => r.id).sort().join(',')) return 'standard';
  if (ids === [...PRESET_STRONG].map(r => r.id).sort().join(',')) return 'strong';
  return 'custom';
}
