import { useSheetsSyncStore } from '../stores/sheetsSyncStore';

/** 저장된 Apps Script URL을 X-Script-Url 헤더로 반환 */
export function getScriptHeaders(): Record<string, string> {
  const { scriptUrl } = useSheetsSyncStore.getState();
  return scriptUrl ? { 'X-Script-Url': scriptUrl } : {};
}
