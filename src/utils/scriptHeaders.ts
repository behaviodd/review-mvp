import { useAuthStore } from '../stores/authStore';

/** API 요청에 포함할 인증 헤더 반환. 토큰 만료 시 빈 객체. */
export function getScriptHeaders(): Record<string, string> {
  const token = useAuthStore.getState().getValidIdToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}
