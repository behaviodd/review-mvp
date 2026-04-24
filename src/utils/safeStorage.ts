/**
 * localStorage quota 안전 래퍼.
 *
 * - 쓰기 실패(QuotaExceededError 등) 시 console.error + window 이벤트 한 번 발행.
 * - 읽기 실패(JSON 파싱 불가, 접근 거부 등) 시 null 반환하여 zustand persist가 초기 상태로 폴백하도록 한다.
 * - 한 세션당 한 번만 알림 이벤트를 발행 (스팸 방지).
 */

const QUOTA_EVENT = 'app:storage-quota-exceeded';
let notified = false;

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // DOMException name
  if ('name' in err && typeof err.name === 'string') {
    const name = err.name;
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  }
  return /quota/i.test(err.message);
}

function notifyQuota(key: string, err: unknown) {
  console.error('[safeStorage] quota exceeded on key', key, err);
  if (!notified && typeof window !== 'undefined') {
    notified = true;
    window.dispatchEvent(new CustomEvent(QUOTA_EVENT, { detail: { key } }));
  }
}

export const safeStorage: Storage = {
  get length() {
    try {
      return window.localStorage.length;
    } catch {
      return 0;
    }
  },
  clear() {
    try { window.localStorage.clear(); } catch (err) { console.warn('[safeStorage] clear failed', err); }
  },
  key(index: number) {
    try { return window.localStorage.key(index); } catch { return null; }
  },
  getItem(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      console.warn('[safeStorage] getItem failed', key, err);
      return null;
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch (err) {
      if (isQuotaError(err)) {
        notifyQuota(key, err);
      } else {
        console.warn('[safeStorage] setItem failed', key, err);
      }
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      console.warn('[safeStorage] removeItem failed', key, err);
    }
  },
};

export { QUOTA_EVENT };
