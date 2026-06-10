/**
 * 조직/구성원 이름 정규화 — Sheets DB 의 한글 입력 경로 차이를 흡수한다.
 *
 * 배경(2026-06-10): `_조직구조` 조직명과 `_구성원` 주조직/부조직/팀/스쿼드 값이
 * macOS NFD(자모 분리) vs NFC(완성형) 또는 중간 띄어쓰기('B2B 사업팀' vs 'B2B사업팀')
 * 차이로 `===` 비교에서 어긋나 구성원이 트리에서 누락되던 사고가 있었다.
 */

/** 표시/저장용 정규화: NFC + 양끝 trim + 중간 공백 1칸으로 축약. */
export function normalizeOrgName(s: string | undefined | null): string {
  return String(s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

/**
 * 동치 판정용 매칭 키: NFC + 소문자 + 모든 공백 제거.
 * 이름 비교(=== 대체)는 반드시 이 키로 한다. 공백 유무·대소문자·NFD 차이를 모두 흡수.
 * 예) 'B2B 사업팀' / 'B2B사업팀' / 'b2b 사업팀' → 모두 'b2b사업팀'
 */
export function orgNameKey(s: string | undefined | null): string {
  return String(s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, '');
}

/** 두 이름이 정규화 기준 동일한가. */
export function orgNameEquals(a: string | undefined | null, b: string | undefined | null): boolean {
  const ka = orgNameKey(a);
  return ka.length > 0 && ka === orgNameKey(b);
}
