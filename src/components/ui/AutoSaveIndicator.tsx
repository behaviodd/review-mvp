import { Loader2, Check, AlertCircle } from 'lucide-react';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function AutoSaveIndicator({ state, savedTime }: { state: SaveState; savedTime: string }) {
  if (state === 'idle') return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
      {state === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 저장 중...</>}
      {state === 'saved' && <><Check className="w-3.5 h-3.5 text-success-500" /> 자동 저장됨 · {savedTime}</>}
      {state === 'error' && <><AlertCircle className="w-3.5 h-3.5 text-danger-500" /> 저장 실패</>}
    </span>
  );
}
