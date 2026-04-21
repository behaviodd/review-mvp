# Apps Script 업데이트 — `권한` 컬럼 추가

## 변경 목적

관리자 지정/해제가 앱에서만 유지되고 Google Sheets에 반영되지 않는 문제를 수정합니다.  
기존에는 `역할` 컬럼이 자유 텍스트 직책명으로 사용되어 앱 권한(`admin`/`member`)을 쓸 수 없었습니다.  
`권한` 전용 컬럼을 추가하여 두 값을 분리합니다.

---

## 스프레드시트 작업 (1회)

### `_구성원` 시트에 `권한` 컬럼 삽입

1. `_구성원` 시트를 엽니다.
2. G열(현재 `직무`)의 열 헤더를 클릭하여 열 전체 선택 → 마우스 오른쪽 → **왼쪽에 열 삽입**
3. 새로 생긴 G열 1행에 `권한` 입력
4. 기존 admin 사용자 행의 G열에 `admin` 입력 (일반 구성원은 비워 두거나 `member` 입력)

> **컬럼 순서 (변경 후)**  
> 사번 · 주조직 · 부조직 · 팀 · 스쿼드 · 역할 · **권한** · 직무 · 성명 · 영문이름 · 입사일 · 연락처 · 이메일 · 재직 여부 · 보고대상(사번)

---

## Apps Script 코드 변경 (`Code_v2.gs`)

`HEADERS[SHEET.USERS]` 배열에 `'권한'` 항목이 추가되었습니다.

```js
// 변경 전
HEADERS[SHEET.USERS] = [
  '사번','주조직','부조직','팀','스쿼드','역할','직무',
  '성명','영문이름','입사일','연락처','이메일','재직 여부','보고대상(사번)'
];

// 변경 후
HEADERS[SHEET.USERS] = [
  '사번','주조직','부조직','팀','스쿼드','역할','권한','직무',
  '성명','영문이름','입사일','연락처','이메일','재직 여부','보고대상(사번)'
];
```

---

## 재배포 절차

1. Google Sheets → 확장 프로그램 → Apps Script
2. `Code_v2.gs`의 `HEADERS[SHEET.USERS]` 줄을 위 내용으로 수정 (또는 파일 전체 교체)
3. **배포 → 기존 배포 관리 → 수정(연필 아이콘) → 버전: 새 버전 → 배포**
4. URL은 변경되지 않으므로 Vercel 환경변수 수정 불필요

---

## 앱 코드 변경 요약 (참고용)

| 파일 | 변경 내용 |
|------|-----------|
| `src/utils/sheetWriter.ts` | `toSheetRow`에 `'권한': user.role` 추가 — 구성원 저장 시 시트에 권한값 기록 |
| `src/utils/sheetParser.ts` | `parseSheetUser`에서 `권한` 컬럼 우선 읽기 → 없으면 레거시 `역할` 컬럼 → 없으면 키워드 파생 |
| `apps-script/Code_v2.gs` | `HEADERS[SHEET.USERS]`에 `'권한'` 추가 |

---

## 동작 방식

```
관리자 지정 버튼 클릭
  → updateMember(id, { role: 'admin' })
  → sheetWriter.update(user)
  → toSheetRow → '권한': 'admin' 포함
  → Apps Script updateUser → _구성원 시트 권한 컬럼에 'admin' 저장

시트 재동기화 시
  → parseSheetUser → row['권한'] === 'admin' → role: 'admin' 반환
  → admin 권한 유지 ✓
```
