# 인수인계 문서 — 2026-04-29 (보안 + 릴리즈 준비)

> 본 세션의 **세 번째 영역** — 디자인 마무리 후 다수의 버그 fix + 릴리즈 readiness 평가 + 보안 강화.
> 같은 날 다른 영역 인수인계:
> - 안정성 audit B 그룹: `docs/handoff-2026-04-29.md`
> - UI 디자인 정합: `docs/handoff-2026-04-29-design.md`
> 세 문서를 함께 읽으면 본 세션 전체 흐름 파악 가능.

---

## 1. 프로젝트 현재 상태

- **위치**: `/Users/makestar/review-mvp` · 브랜치 `main` · origin 동기화 완료 (`cee2e02` push)
- **단계**: **버그 fix 라운드 + 릴리즈 readiness 평가 + 보안 P0 일부 해소**
- **Apps Script 폴더**: ⚠️ **`~/Desktop/apps-script/` 로 이동됨** — git tracking 종료. 향후 backend 수정은 Apps Script 편집기가 canonical.
- **마지막 검증**: typecheck (`npx tsc --noEmit`) 통과 · pre-commit 훅 동작 확인 (가짜 시크릿 차단 / placeholder 통과)

### 본 세션 commit 흐름 (최신 → 과거)

```
cee2e02 chore: apps-script 폴더를 ~/Desktop/apps-script 로 이동
f464ecc chore(security): SSO 우회 버튼·시크릿 fallback 제거 + pre-commit 시크릿 스캐너
20fc309 fix(template): 섹션 이름이 임의로 설정되는 문제 해결
08620f2 fix(reviewer): admin 도 조직장/평가권자 가능 (isSystemOperator 거부 룰 제거)
00f7330 feat(preflight): 차단·경고 항목에 affected 멤버 이름 표시
657b4d6 fix(approve): 구성원 초대 수락 시 직무·보고대상 저장 누락 fix
8140b98 fix(team): 조직도 DnD 안정화 — 깜빡임 + sticky indicator 제거
95b2376 fix(design): Team 조직도 헤더 — 활성 시 분홍 bg 제거
f0c33e3 fix(template): 기본 템플릿이 항상 최상단 + 그 다음 최신순
f5cfb7c feat(template): 정렬 (최신 먼저) + 검색 + 페이지네이션 (15)
...
```

---

## 2. Phase 별 변경 요약

### Phase X-1 — 디자인 마무리 + 다수 버그 fix (`f5cfb7c` ~ `20fc309`)

#### 2-1. 템플릿 UX 흐름 정비 (`f5cfb7c`, `f0c33e3`, `20fc309`)

- 템플릿 목록: 정렬 (isDefault 먼저 → createdAt desc), 검색, 페이지네이션 15
- 템플릿 빌더: 생성 후 `/templates` 로 복귀 (이전 `/cycles`)
- 템플릿 빌더 섹션 추가: `max(order)+1`, 기본 이름 빈 문자열, 자동 편집 모드 진입
- 영향 파일: `src/pages/reviews/TemplateList.tsx`, `src/pages/reviews/TemplateBuilder.tsx`

#### 2-2. Team 조직도 안정화 (`95b2376`, `8140b98`)

- 활성 시 분홍 bg 제거 (Figma 정합)
- DnD 깜빡임 fix: `setDndState` 가 매 dragover 마다 새 객체 생성하던 문제 해결
  - `(id, pos)` 비교 후 변경 시에만 update
  - `onDragLeave: (id: string) => void` 콜백 추가
- 영향 파일: `src/pages/Team.tsx`

#### 2-3. 구성원 초대 승인 누락 필드 (`657b4d6`)

- '직무'(jobFunction), '보고대상'(managerId) 가 PendingApprovals UI 에 없었고 Apps Script 에서도 미수신
- `src/pages/team/PendingApprovals.tsx` — 두 필드 추가, manager 선택 셀렉트 (admin/inactive 제외)
- `src/utils/authApi.ts` — `ApproveMemberInput` 확장
- Apps Script: `approveMember` 의 `jobFunctionA`, `managerIdA` 추가 (이미 `~/Desktop/apps-script/ReviewFlow.gs` 에 반영됨)

#### 2-4. Preflight 차단 멤버 표시 (`00f7330`)

- PreflightModal 이 `affectedIds` → 멤버 이름 list 변환 (최대 5명 + "외 N명")
- 영향: `src/components/review/modals/PreflightModal.tsx`

#### 2-5. admin 도 평가권자 가능 (`08620f2`) ⚠️

**핵심 정책 변경**: `isSystemOperator(reviewer)` 의 reviewer 측 거부 룰 제거.
- `src/utils/cyclePreflight.ts` 에서 4곳, `src/utils/createCycleSubmissions.ts` 에서 5곳 제거
- 이유: 사용자 명시 — "조직장은 admin 도 될 수 있습니다"
- **유지**: reviewee 측 `isSystemOperator(member) → continue` 는 그대로 (admin 본인은 평가 대상에서 제외)
- 부수 효과: Preflight 의 "1차(직속) 평가권자가 없는 대상자" 차단이 admin manager 인 경우에도 정상 통과

### Phase X-2 — 릴리즈 readiness 평가 (commit 없음)

대상: `~/Desktop/바이브코딩 제품 출시 가이드 350c0f4dd8c8807a8d87c418a8698d49.md` 가이드 대비 평가.

**결과 요약**:
- **릴리즈 레벨**: L1~L2 경계 (개인정보 접근 + "판단 모호" 룰 → L2 권장)
- **릴리즈 가능 여부**: ❌ **BLOCKED** (P0 6건)

**P0 항목** (외부 시연/도입 차단):
1. ✅ **SSO 우회 버튼** (해소됨, X-3.1)
2. ✅ **시크릿 하드코딩 fallback** (해소됨, X-3.2)
3. ⚠️ **OAuth Client ID rotate** — git history (`a52d65b`) 에 박힌 ID 가 여전히 노출 상태. **남은 P0**
4. ⚠️ **Owner 3명 지정** (release/operations/maintenance) — 가이드 § 1
5. ⚠️ **Sentry / Vercel Analytics 통합** — 가이드 § 5 (가이드는 P1 이지만 운영 시작 전 필수)
6. ⚠️ **Vercel cost quota 알람** — 무한 결제 가드

**P1 항목** (운영 시작 후 1주 내):
- 운영 룬북 (변경 communication + sunset policy)
- DR 룬북 (F 그룹) — 핸드오프 § 4-3 의 잔여 항목

### Phase X-3 — 보안 P0 부분 해소 + 예방 메커니즘 (`f464ecc`)

#### 3-1. SSO 우회 버튼 제거

- `src/pages/Login.tsx` — `handleDevAdminLogin` 함수 + `[TEST] admin 즉시 로그인 (SSO 우회)` 버튼 모두 제거
- 이전 핸드오프 § 4-6 의 A-2 (TEMP admin SSO 우회) **해소**
- 이제 production 진입 경로는 Google SSO + 부트스트랩 모드뿐

#### 3-2. GOOGLE_CLIENT_ID fallback 제거

- `~/Desktop/apps-script/ReviewFlow.gs` (당시 `apps-script/ReviewFlow.gs`):
  - `var GOOGLE_CLIENT_ID_DEFAULT_ = '...'` 삭제
  - `props.getProperty('GOOGLE_CLIENT_ID')` 만 사용 — 없으면 즉시 에러 + 룬북 경로 안내
- 배경: 재배포 후 Script Properties 가 비었다고 판단해 사용자가 commit `a52d65b` 에 fallback 추가 → 시크릿이 git history 에 영구 노출 → 노출된 ID 는 rotate 필요

#### 3-3. pre-commit 시크릿 스캐너

- `scripts/check-secrets.sh` — bash 기반 grep 패턴 매칭
  - 차단: Google Client ID, Google API key, AWS Access Key, Slack token, Private key block
  - allowlist: 같은 라인에 `example` / `placeholder` / `<...>` 가 있으면 통과
- `.husky/pre-commit` — `bash scripts/check-secrets.sh` 호출
- husky devDependency 설치 (`prepare: husky` 자동 실행)
- 검증: 가짜 ID 차단 (exit 1) / placeholder 통과 (exit 0)

#### 3-4. 룬북 — `docs/runbooks/script-properties.md`

- 필수 키 목록 (`GOOGLE_CLIENT_ID`, `ALLOWED_HD`)
- Apps Script 편집기 등록 절차
- "Script Properties 비었음" 에러 대응 (코드 fallback 금지)
- OAuth Client ID 노출 시 rotate 절차 (Cloud Console → Credentials → 새 ID → Script Properties + `VITE_GOOGLE_CLIENT_ID` 동시 갱신)

### Phase X-4 — apps-script 폴더 이동 (`cee2e02`)

- `apps-script/` → `~/Desktop/apps-script/` 이동
- git tracking 종료 (2개 파일, 78KB 삭제)
- `docs/runbooks/script-properties.md` 의 코드 위치 참조 업데이트
- 기존 handoff/audit 문서의 `apps-script/ReviewFlow.gs` 언급은 **시점 기록**이므로 그대로 유지

**의의**: Apps Script 편집기가 사실상 canonical 이고, git 의 사본은 참조용이었음을 명시. 향후 backend 수정은 Apps Script 편집기에서 진행하고 필요 시 `~/Desktop/apps-script/` 에 백업.

---

## 3. 다음 남은 작업 — 우선순위별

### 3-1. P0 — 외부 시연/도입 차단 ⚠️

| ID | 항목 | 현재 상태 | 다음 액션 |
|---|---|---|---|
| P0-1 | SSO 우회 제거 | ✅ 완료 (`f464ecc`) | — |
| P0-2 | 시크릿 fallback 제거 + 예방 | ✅ 완료 (`f464ecc`) | — |
| **P0-3** | **OAuth Client ID rotate** | ❌ **미완료** | Cloud Console → 새 ID 발급 → Script Properties + `VITE_GOOGLE_CLIENT_ID` 갱신 → Apps Script 재배포 |
| P0-4 | Owner 3명 지정 | ❌ 미진행 | 사용자가 release/operations/maintenance 책임자 지정 |
| P0-5 | Sentry + Vercel Analytics | ❌ 미진행 | E 그룹 (관측성) 의 일부 |
| P0-6 | Vercel cost quota 알람 | ❌ 미진행 | Vercel dashboard → Spend Management |

### 3-2. P1 / P2 — 운영 시작 후

- **P1**: Sentry + Vercel Analytics, 운영 룬북 (변경 communication + sunset policy)
- **P2**: DR 룬북 (F 그룹), B-3 잔여 (P2 부채), audit-B § 8 미해결 조사 4건

### 3-3. 미배포 Apps Script 변경

- `~/Desktop/apps-script/ReviewFlow.gs` 의 다음 변경이 **미배포** 상태일 가능성:
  - X-2.3 의 `approveMember` jobFunctionA/managerIdA 추가
  - X-3.2 의 `GOOGLE_CLIENT_ID_DEFAULT_` 제거
  - 핸드오프 § 4-2 의 B-2.4 audit dedupe (이전부터 미배포)
- **권장**: 다음 세션에서 사용자 확인 후 일괄 배포

---

## 4. 새로운 컨벤션 / 예방 메커니즘

### 4-1. 시크릿 = Script Properties / 환경변수만 (코드 fallback 금지)

- Apps Script: `PropertiesService.getScriptProperties().getProperty(...)` 만 사용. 없으면 throw.
- 프론트엔드: `import.meta.env.VITE_*` 만 사용. `||` fallback 금지.
- pre-commit 훅이 자동 차단. 우회는 `git commit --no-verify` (PR 사유 필수) — 정말 필요할 때만.

### 4-2. OAuth Client ID 노출 시 rotate 절차

`docs/runbooks/script-properties.md` § 3 참조. 핵심:
1. Cloud Console → Credentials → 새 ID 발급 (기존 ID 즉시 비활성)
2. **두 곳 동시** 갱신: Apps Script Properties + `VITE_GOOGLE_CLIENT_ID`
3. Apps Script 재배포 + 프론트엔드 재빌드/배포

### 4-3. Apps Script 위치

- **canonical**: Apps Script 편집기 (Google 서버)
- **로컬 사본**: `~/Desktop/apps-script/` (git 비추적)
- 변경 절차: 편집기에서 직접 수정 → V1 등 sanity → 새 버전 배포 → 필요 시 `~/Desktop/apps-script/` 동기화
- git 안에서 `apps-script/` 경로를 만들지 말 것 (시크릿 노출 위험 + canonical 혼동)

---

## 5. 검증 명령어

```bash
# 빌드 + 타입 체크
npm run build

# 단위 + 통합 테스트
npm test

# 타입체크만 (빠름)
npx tsc --noEmit

# pre-commit 훅 동작 확인 (실제 테스트 시 example 단어 없이 fake ID 가 들어간 파일 stage 후 실행)
# 패턴: '<projectNumber>-<32자hash>.apps.googleusercontent.com'
# allowlist 통과 조건: 같은 라인에 example/placeholder/<...> 포함

# Dev 서버 (5174)
npm run dev -- --port 5174
```

---

## 6. 체크리스트 — 새 에이전트 첫 행동

- [ ] `git log --oneline -15` 으로 본 세션 commit 흐름 파악
- [ ] **세 핸드오프 모두 읽기**: `handoff-2026-04-29.md` (안정성) + `handoff-2026-04-29-design.md` (디자인) + 본 문서 (보안)
- [ ] `docs/runbooks/script-properties.md` 정독 — 시크릿 운영 규칙
- [ ] `docs/ui-tokens.md` 정독 — 디자인 시스템
- [ ] `npm run build && npm test && npx tsc --noEmit` baseline 확인
- [ ] `~/Desktop/apps-script/ReviewFlow.gs` 위치 확인 (git 에는 없음)
- [ ] 다음 작업 사용자와 합의 — § 3-1 의 P0-3 (OAuth rotate) / P0-4 (owner 지정) / P0-5,6 (관측성) 중 선택

---

## 7. 알려진 함정·주의사항

1. **apps-script 폴더 만들지 말 것** — git 안에서 backend 코드 두는 패턴은 폐기. canonical 은 Apps Script 편집기.
2. **`GOOGLE_CLIENT_ID` 가 노출된 채 rotate 안 됨** — git history (`a52d65b`) 에 ID 박혀 있음. P0-3 완료 전엔 외부 시연 금지.
3. **SSO 우회 버튼 복구 금지** — production 노출 위험. 개발자 테스트는 다른 방법으로 (Cloud Console 에서 본인 계정에 admin role 부여 등).
4. **admin 도 평가권자 가능** — `isSystemOperator` 의 reviewer 측 거부 룰은 영구 폐기. reviewee 측 (`continue`) 만 유지.
5. **pre-commit 우회 (`--no-verify`)** — 시크릿이 정말 아닌 경우만 (allowlist 우선 검토). PR 사유 필수.
6. **release readiness L1~L2 경계** — 가이드 "판단 모호" 룰에 따라 L2 적용 권장. 외부 시연 시 P0 6건 모두 해소 필수.
7. **다음 Apps Script 배포 전** — 미배포 변경 (§ 3-3) 일괄 검토.

---

작성: 2026-04-29 · 본 세션의 세 번째 핸드오프. 새 에이전트는 § 6 체크리스트로 시작 권장.
