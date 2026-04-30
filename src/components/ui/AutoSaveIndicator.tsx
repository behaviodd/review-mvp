import { Loader2 } from 'lucide-react';
import { MsCheckIcon, MsAlertIcon } from './MsIcons';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function AutoSaveIndicator({ state, savedTime }: { state: SaveState; savedTime: string }) {
  if (state === 'idle') return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
      {state === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 저장 중...</>}
      {state === 'saved' && <><MsCheckIcon size={12} className="text-green-040" /> 자동 저장됨 · {savedTime}</>}
      {state === 'error' && <><MsAlertIcon size={12} className="text-red-040" /> 저장 실패</>}
    </span>
  );
}
