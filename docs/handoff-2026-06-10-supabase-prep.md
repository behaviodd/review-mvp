# 인수인계 — 2026-06-10 (orgUnitId 백필 + 안정성 보강 + Supabase 이전 준비)

> **세션 범위**: 구성원 미표시 버그 근본해결(orgUnitId 백필) + 재발방지 코드 보강(A·B·C) + Supabase 이전 검토·데이터 정합 준비 + 미사용 탭 정리
> **총 commit**: 1건 — `8e0d966` (main push 완료, Vercel 배포됨)
> **검증**: build(tsc+vite) / test 51 / lint(새 에러 0) / dev 5173 200 ✅, `migration_readiness` 진단 전부 0
> **시트 변경**: GAS 일회성 스크립트로 시트 데이터 직접 수정(코드 배포와 무관). Apps Script 영구 변경 없음
> **같은 날 다른 세션**: `handoff-2026-06-10.md`(팀 관리 UX) 별도

---

## 1. 프로젝트 현재 상태

- 위치: `/Users/makestar/review-mvp` (Vite + React 19 + TS + Tailwind, Google Sheets DB + Apps Script, Vercel)
- 브랜치 `main`, 최신 `8e0d966`. 작업트리 깨끗.
- SPREADSHEET_ID = `138NMXPcwrG_lOIkC27BGtTZLN-3Ql3mVOttvM5xD-mg`
- Apps Script 소스: `~/Desktop/apps-script/ReviewFlow.gs` + `Migrate_R7.gs` (clasp 미설정 — 수동 배포)

---

## 2. 이번 세션 작업

### 2-1. 구성원 미표시 버그 — 근본해결 (데이터)
- **증상**: Team 페이지(하위 조직 선택)·평가자 자동배정에서 구성원 누락.
- **근본원인**: `_구성원.주조직ID`(orgUnitId)가 **121명 전원 비어 있었음** → R7 `구성원_v2` 마이그레이션이 8/121행만 하다 중단된 잔재. ID 기반 트리탐색(`getMembersInOrgTree`)이 0명 반환 → 거친 이름 폴백만 남았던 것. **조직명 싱크 불일치는 원인 아님**(이름 바이트 단위 일치 확인).
- **데이터 수정(GAS `backfill_orgUnitId`)**: 이름경로(주조직>부조직>팀>스쿼드)로 가장 깊은 노드 해석해 121명 `주조직ID` 백필. 부수: 트리명 `B2B 사업팀`→`B2B사업팀` 정정, `해외사업전략팀` 1명 → `해외커머스 Unit` 매핑.

### 2-2. 재발방지 코드 보강 — commit `8e0d966` (push 완료)
- **A. 런타임 자동해석** `src/utils/resolveOrgUnitIds.ts` — 빈/무효 orgUnitId를 이름경로로 해석해 채움. `teamStore.syncFromSheet`에서 호출 → 신규 구성원이 ID 없이 시트 추가돼도 자가복구.
- **B. 조직명 정규화** `src/utils/normalizeOrgName.ts` — `orgNameKey`(NFC+전체공백제거+소문자)/`orgNameEquals`. NFD·`B2B 사업팀`류 띄어쓰기 흡수. 레거시 매쳐 전반 적용(cyclePreflight, createCycleSubmissions, autoAssignReviewers, resolveTargets, teamUtils, Team.tsx, teamStore derive).
- **C. 관측성** — 미배치 구성원 `teamStore.unplacedMemberIds` + `console.warn`.
- 회귀테스트 `resolveOrgUnitIds.test.ts` 6건 신설(총 51).

### 2-3. Supabase 이전 검토 + 데이터 정합 준비
- **방향(권장)**: Supabase를 **관리형 Postgres(+Realtime) 전용**으로, **Auth 미사용**(기존 Google SSO + 서버세션 유지). **B안**: 클라 → `/api/*`(Vercel Edge) → Supabase **service_role**(브라우저/깃 노출 0), RLS는 2차 방어선. 서울 리전. 운영 Pro(~$25/월) / 개발 무료.
- **단계**: Phase0 스키마+RLS → Phase1 dual-write(Sheets 정본) → Phase2 읽기전환(+Realtime) → Phase3 Sheets 제거(+OAuth rotate).
- **데이터 정합(GAS `migration_readiness`)**: PK중복/빈셀/FK/JSON/NFC/이메일 **전부 0**. 처리: 고아 10건(평가권 8 + 권한그룹 2, 전부 `auto_YYYYMMDD_xxxx` 테스트 잔재) `cleanup_orphans`로 삭제.
- **ETL 규칙/주의(메모에 상세)**: `_제출`에 `자동제외JSON` 동일헤더 3컬럼(값 동일=중복) → **첫 컬럼만 읽고 나머지 무시**(라이브 삭제 금지). 구성원 이름 컬럼 = **`성명`**. `보고대상(사번)`=manager FK, `주조직ID`=orgUnitId FK.

### 2-4. 미사용 탭 정리 (진행)
- 대상 10개 = `구성원_v2`/`조직_v2`/`사이클_v2`(R7 중단) + `*_backup_20260520_*`(2) + `_신규회원`(빈) + `_회원DB`/`_조직DB`/`_사이클DB`/`_사이클`(2026-04-28 잔재).
- 안전절차 = `삭제예정_20260610_` rename(GAS `trash_unused`/`trash_legacy`) → 2주 무이상 후 `trash_purge` 영구삭제. 복원 = `trash_restore`.
- **⚠️ 실제 rename 실행 여부는 운영자 확인 필요**(스크립트·안내 제공 완료 시점에 인수인계 작성).
- **참고**: `_회원DB`/`_조직DB`/`_사이클DB`는 **이전 영문 정규화 스키마 초안**(legacy_* 매핑 + *_policy_json) — Phase 0 Postgres 스키마 참조용. 컬럼 목록은 메모에 기록(purge 전 보존).

---

## 3. 내일 할 일 (우선순위)

1. ⛔ **컴플라이언스 게이트** — 사내/법무에 "HR 데이터 국외 SaaS 저장 정책" 확인. → **Supabase(서울) vs 국내 자체호스팅 Postgres** 결정. 이게 Phase 0 타깃을 가름.
2. **미사용 탭** — rename 실행했는지 확인. 미실행 시 `trash_unused`+`trash_legacy`. (purge는 2026-06-24경)
3. (1번 결정 후) **Phase 0** — Postgres 스키마 DDL(13테이블) + RLS 작성. 참조: `docs/db-schema.md`(R7 목표) + `_회원DB`류 영문 초안.
4. 선택: 조직 유형 `B2B Unit`/`해외커머스 Unit`(subOrg) 의도 점검.

---

## 4. 주의사항 / 배포

- **코드**: `8e0d966` 이미 main push → Vercel 배포 완료. 추가 미커밋 변경 없음.
- **시트 데이터**: 백필·고아정리는 GAS로 이미 적용됨. 미사용 탭 rename은 운영자 실행 여부 확인.
- **OAuth Client ID rotate (P0, 보류 지속)** — git history 노출분. Sheets 제거 Phase에서 함께 처리 예정. 외부 시연 전 필수.
- **GAS 작성 시**: 터미널 복사→붙여넣기에서 긴 줄(특히 한글) 깨짐 → 짧은 줄·주석 없이·ASCII 위주 (메모 `feedback_gas_paste_workflow`).

---

## 5. 참조 (문서·메모 위치)

- **메모**: `project_review_mvp_supabase_migration.md`(이전 준비 단일 진실) / `project_review_mvp.md`(갱신) / `feedback_gas_paste_workflow.md`
- **스키마 소스**: `docs/db-schema.md` (R7 목표 스키마)
- **GAS 진단/정리 스크립트**(일회성, 저장 불필요): `backfill_orgUnitId` / `migration_readiness` / `cleanup_orphans` / `trash_unused`·`trash_legacy`·`trash_restore`·`trash_purge` / `list_orphans` / `peek_legacyDB`
