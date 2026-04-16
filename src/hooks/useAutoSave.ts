import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function useAutoSave(onSave: () => Promise<void> | void, delay = 3000) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedTime, setSavedTime] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState('saving');
    timerRef.current = setTimeout(async () => {
      try {
        await onSave();
        setSaveState('saved');
        setSavedTime(format(new Date(), 'a h:mm'));
      } catch {
        setSaveState('error');
      }
    }, delay);
  }, [onSave, delay]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { saveState, savedTime, triggerSave };
}
