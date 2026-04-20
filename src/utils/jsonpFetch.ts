/**
 * JSONP fetch 유틸리티
 *
 * Apps Script ContentService는 CORS 헤더를 설정할 수 없어서
 * 일반 fetch()로는 브라우저가 차단함.
 * <script> 태그 방식은 CORS 제한 없이 외부 URL을 호출할 수 있음.
 */
export function jsonpFetch<T>(baseUrl: string, params: Record<string, string> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    // 충돌 없는 콜백 이름 생성
    const callbackName = `__jsonp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const script = document.createElement('script');

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP 요청 타임아웃 (10초)'));
    }, 10_000);

    function cleanup() {
      clearTimeout(timeout);
      delete (window as Record<string, unknown>)[callbackName];
      script.parentNode?.removeChild(script);
    }

    // 전역에 콜백 등록 → Apps Script가 이 함수를 호출함
    (window as Record<string, unknown>)[callbackName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    const qs = new URLSearchParams({ ...params, callback: callbackName }).toString();
    script.src = `${baseUrl}?${qs}`;
    script.onerror = () => {
      cleanup();
      reject(new Error('스크립트 로드 실패. URL을 확인해주세요.'));
    };

    document.head.appendChild(script);
  });
}
