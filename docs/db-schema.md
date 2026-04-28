# DB 스키마 (R7) — 단일 진실 문서

R7 개편의 합의된 스키마와 마이그레이션 매핑을 정의합니다. 모든 Apps Script 헤더 / TypeScript 타입 / 마이그레이션 스크립트는 이 문서를 단일 진실로 삼습니다.

R7 의 목표:
1. 운영자가 스프레드시트만으로 회원·조직·사이클을 관리할 수 있도록 시트 헤더를 최소화.
2. Google SSO 도입 + "신규 회원 관리자 승인" 흐름.
3. 조직 위계를 4종 타입(`mainOrg/subOrg/team/squad`) 대신 부모 체인만으로 균일 5단계까지 표현.
4. `_계정` 시트 폐기 — `_구성원` 이 단일 진실.

---

## 0. Phase 0 합의 사항 (확정)

| # | 결정 | 적용 |
|---|---|---|
| Q1 | **워크북은 1개 유지** | 시트만 그룹핑(시각 분리), Apps Script URL 1개 |
| Q2 | **`User.role` 제거** | 권한그룹 멤버십 단일 진실. `pg_owner` 멤버 = admin |
| Q3 | **사이클 1시트 유지** | 컬럼 그룹핑(스페이서 컬럼)으로 시각 분리. 별도 `사이클설정` 시트 없음 |
| Q4 | **병행 마이그레이션** | 새 시트는 `구성원_v2` / `조직_v2` 등 `_v2` 접미. 1주일 안전망 후 원본 삭제 |
| Q5 | **승인 대기는 빈 페이지** | `/pending-approval` 만 통과, 그 외 모든 라우트 차단 |
| Q6 | **사번은 승인 시 발번** | 신규 로그인 시 `대기승인` 시트에만 적재. `_구성원` 에는 미발생 |

---

## 1. 시트 구조 (1 워크북, 4 그룹)

운영자 관점에서 시트를 4 그룹으로 시각 분리. 그룹 간에는 빈 시트(spacer)를 1개 끼워 구분.

### Group A — People & Org (HR/시스템 관리자)
- `구성원_v2`
- `조직_v2`
- `대기승인`
- `겸임_v2`

### Group B — Permissions (시스템 관리자)
- `권한그룹` (헤더 변경 없음, 데이터 호환)
- `시스템설정` (신규 — Apps Script Properties 의 시트 미러링은 하지 않음, 향후 운영용 메타만)

### Group C — Cycles (리뷰 관리자)
- `사이클_v2`
- `템플릿` (헤더 변경 없음)
- `평가권` (헤더 변경 없음)
- `제출` (헤더 변경 없음)
- `인사스냅샷` (헤더 변경 없음)

### Group D — Logs (자동)
- `감사로그` (헤더 변경 없음)
- `마스터로그인` (헤더 변경 없음)
- `피드백` (기존 유지)

> Phase 1 에서 변경되는 시트는 A 그룹과 `사이클` 입니다. 나머지(권한그룹, 템플릿, 평가권, 제출 등)는 R7 범위 밖이며 헤더 그대로 유지.

---

## 2. 시트 헤더 정의

### 2.1 `구성원_v2` (10컬럼)

| 컬럼 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `사번` | string | ✅ | PK. 승인 시 발번. 형식 자유(예: `M0123`) |
| `이메일` | string | ✅ | makestar.com 도메인. lowercase 정규화 |
| `이름` | string | ✅ |  |
| `직책` | string |  | 예: "데이터팀장", "선임 엔지니어" — 권한과 무관 |
| `역할` | enum | ✅ | `admin` \| `member`. **권한이 아님** — 평가 참여 분류용. `admin` 은 사이클 자동 제외 (시스템 운영자) |
| `소속조직ID` | string |  | `조직_v2.조직ID` 참조. 비어있으면 무소속 |
| `보조조직IDs` | string |  | 콤마 구분. 예: `org_data,org_review` |
| `입사일` | date(YYYY-MM-DD) |  |  |
| `퇴사일` | date(YYYY-MM-DD) |  | 비어있으면 재직 중 |
| `비고` | string |  | 운영 메모 자유 입력 |

> **R7-corrected**: Phase 0 합의에서 `역할` 컬럼 제거를 권장했으나, Phase 5 검토 중 코드베이스 86 군데에서 `role !== 'admin'` 으로 *사이클 참여 대상에서 시스템 운영자 제외* 의미로 사용 중인 것을 발견. 권한(`pg_owner`/`pg_review_admin` 등) 과 평가 참여 분류(`admin`/`member`) 는 분리된 개념이므로 컬럼 보존. `leader` 값은 사용되더라도 `member` 와 동일하게 처리.

**제거된 컬럼** (구버전 `_구성원`):
- `주조직 / 부조직 / 팀 / 스쿼드` → `소속조직ID` 단일 컬럼으로
- `직무` → `직책` 통합
- `재직 여부 / 보고대상(사번)` → 별도 테이블(평가권) 또는 퇴사일로 표현
- `상태분류 / 상태변경일시 / 상태사유` → 휴직 분류는 R7 범위 밖, 추후 별도 시트로 분리 예정
- `영문이름 / 연락처` → 운영 시트 단순화 위해 일단 제거. 필요 시 R8 에서 별도 `구성원프로필` 시트로

### 2.2 `조직_v2` (6컬럼)

| 컬럼 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `조직ID` | string | ✅ | PK. 형식: `org_<slug>` 권장 |
| `조직명` | string | ✅ |  |
| `부모조직ID` | string |  | 비어있으면 루트(주조직). depth=0 |
| `표시순서` | number |  | 형제 노드 정렬 키. 기본 0 |
| `조직장사번` | string |  | `구성원_v2.사번` 참조 |
| `비고` | string |  |  |

**제거된 컬럼**:
- `조직유형` (`mainOrg/subOrg/team/squad`) → 부모 체인 depth 로 계산

**제약**:
- 부모 체인 depth 는 최대 4 (즉 5단계: `0=주조직, 1~4=하위조직`)
- 자기 자신을 부모로 둘 수 없음 (cycle 검출)
- 부모가 존재하지 않는 ID 면 검증 실패

### 2.3 `대기승인` (7컬럼) — 신규

| 컬럼 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `이메일` | string | ✅ | PK. lowercase |
| `이름` | string |  | Google JWT `name` 클레임 |
| `Google_sub` | string |  | Google 영구 식별자(JWT `sub`) |
| `최초로그인일시` | datetime | ✅ | ISO 8601 |
| `상태` | enum | ✅ | `pending` / `approved` / `rejected` |
| `처리자` | string |  | 승인/반려한 admin 사번 |
| `처리일시` | datetime |  | 처리 시점 |

**라이프사이클**:
- 신규 로그인 → `pending` row 생성
- 관리자 승인 → `approved` 로 변경 + 같은 트랜잭션에서 `구성원_v2` 에 사번 발번 + 권한그룹 배정
- 관리자 반려 → `rejected` 로 변경. 같은 이메일은 다음 로그인 시 차단(403)
- 한 이메일당 row 1건만(upsert). 이미 `approved` 인데 다시 로그인하면 `구성원_v2` 의 사번으로 정상 진입.

### 2.4 `겸임_v2` (8컬럼)

기존 `_겸임` 시트와 컬럼은 동일하지만, 보조조직IDs 가 `구성원_v2` 에 콤마 컬럼으로 들어가는 것과 *별개로* — 시작/종료/비율/직책 같은 메타가 필요한 케이스만 이 시트에 행 생성. 단순 다중 소속만 표현하면 `구성원_v2.보조조직IDs` 로 충분.

### 2.5 `사이클_v2` (컬럼 그룹핑 적용)

운영자가 자주 만지는 핵심 9컬럼 → 빈 컬럼(`_`) → 부가 설정 컬럼.

```
[핵심 9]
사이클ID | 이름 | 상태 | 자기평가시작 | 자기평가종료 | 하향평가시작 | 하향평가종료 | 템플릿ID | 비고

[스페이서] _

[부가]
유형 | 리뷰유형들 | 대상모드 | 대상매니저ID | 대상사용자IDS | 폴더ID | 태그
| 인사적용방식 | 인사스냅샷ID | 평가차수배열
| 자기평가마감 | 매니저평가마감 | 예약발행일시 | 편집잠금일시 | 종료일시 | 보관일시
| 익명정책JSON | 공개정책JSON | 참고정보JSON | 동료선택정책JSON | 자동전환JSON | 알림정책JSON
| 템플릿스냅샷JSON | 템플릿스냅샷일시 | 복제원본ID
| 생성자ID | 생성일시 | 완료율 | 자동보관플래그
```

> 핵심 9컬럼은 시트에서 굵은 헤더로, 부가 컬럼은 옅은 회색 배경. Apps Script `applyHeaderStyle_(sheet)` 로 자동 적용.

**컬럼 의미는 기존 `CYCLE_HEADERS` 와 동일**. 변경은 *시각적 그룹핑만*.

---

## 3. TypeScript 타입 변경

### 3.1 `User`
```ts
// AS-IS (R6)
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;          // ← 제거
  position: string;
  avatarColor: string;
  orgUnitId?: string;
  activityStatus?: ActivityStatus;
  // ... 다수의 deprecated 필드 (department/subOrg/team/squad/...)
}

// TO-BE (R7)
export interface User {
  id: string;
  name: string;
  email: string;
  position: string;        // 직책 (권한과 무관)
  avatarColor: string;
  orgUnitId?: string;
  secondaryOrgIds?: string[]; // 보조조직IDs 콤마 → 배열
  joinDate?: string;
  leaveDate?: string;
  status: 'active' | 'pending' | 'inactive'; // 신규
  note?: string;
}
```

### 3.2 `OrgUnit`
```ts
// AS-IS
export interface OrgUnit {
  id: string;
  name: string;
  type: OrgUnitType;       // ← 제거
  parentId?: string;
  headId?: string;
  order: number;
}

// TO-BE
export interface OrgUnit {
  id: string;
  name: string;
  parentId?: string;
  headId?: string;
  order: number;
  note?: string;
}
```

### 3.3 신규 타입
```ts
export interface PendingApproval {
  email: string;
  name?: string;
  googleSub?: string;
  firstLoginAt: string;
  status: 'pending' | 'approved' | 'rejected';
  processedBy?: string;
  processedAt?: string;
}
```

### 3.4 `usePermission` 영향
`isAdmin` 의 정의가 `role === 'admin'` 에서 **`pg_owner` 그룹 멤버십** 으로 단일화. 그 외 `can.*` 헬퍼는 변동 없음 (이미 권한 코드 기반).

---

## 4. 로그인 + 승인 흐름 (Q5/Q6 합의 반영)

```
[사용자가 Google 버튼 클릭]
  ↓ ID Token 획득
[클라이언트가 /api/org-sync → verifyGoogleLogin POST]
  ↓
[Apps Script verifyGoogleIdToken_]
  ↓ aud/iss/exp/email_verified/hd 검증 통과
[이메일이 구성원_v2 에 존재?]
  ├─ Yes → { userId, email, status: 'active' } 반환
  │        클라이언트: useAuthStore.login(user) → 정상 진입
  │
  └─ No → 대기승인 시트에 upsert (Google sub / 이름 / 시각 / status='pending')
          기존 행이 'rejected' 면 { error: '승인이 거절된 계정입니다.' } 반환
          기존 행이 'approved' 인데 구성원_v2 에 없으면 → 데이터 정합성 오류로 처리(관리자 알림)
          그 외에는 { userId: null, email, name, status: 'pending' } 반환
          클라이언트:
            useAuthStore.login({
              id: 'pending_<email>', name, email, status: 'pending', ...
            })
            navigate('/pending-approval')
```

### 4.1 라우트 가드
- `RequireAuth` (기존): currentUser 존재 여부만
- `RequireApproval` **(신규)**: `currentUser.status === 'active'` 만 통과. 미달 시 `/pending-approval` 로 강제 이동
- 가드 적용 위치: `AppLayout` 자식 라우트 전체. 단 `/pending-approval`, `/logout` 은 예외.

### 4.2 `/pending-approval` 페이지 (Q5: a)
- 표시: "관리자 승인 대기 중입니다. 승인 후 이용 가능합니다."
- 표시: 본인 이름 / 이메일 / 최초로그인일시
- 버튼: "로그아웃" 만 노출. 그 외 사이드바/헤더/페이지 콘텐츠 비표시.
- Polling: 10분 간격으로 `verifyGoogleLogin` 재호출하여 승인 여부 자동 확인 (또는 사용자가 페이지 새로고침)

### 4.3 관리자 승인 화면
- 위치: `/team` 페이지에 새 탭 **"승인 대기"** 추가
- 사이드바 "구성원" 메뉴에 빨간 카운트 배지 (대기 row 수)
- 다이얼로그 (개별/일괄):
  - 사번 입력 (자동 발번 옵션 — 다음 번호 추천)
  - 소속조직 선택 (드롭다운)
  - 권한그룹 다중 선택 (기본: `pg_review_admin`/`pg_org_admin` 미선택 — 가장 안전한 멤버부터 시작)
  - 직책 입력 (선택)
  - "승인" 클릭 시:
    1. `구성원_v2` upsert (사번/이메일/이름/직책/소속조직ID)
    2. 선택된 권한그룹의 `멤버사번JSON` 에 사번 추가
    3. `대기승인.상태` = `approved` + 처리자/처리일시 기록
- 반려 버튼: 사유 입력 → `대기승인.상태` = `rejected`

---

## 5. Apps Script 액션 변경

### 5.1 변경되는 액션
| 액션 | 변경 내용 |
|---|---|
| `verifyGoogleLogin` | 미등록 이메일 시 `_대기승인` upsert + `status: 'pending'` 반환 추가 |
| `bulkPullAll` (신규) | 풀 동기화 응답에 `pendingApprovals` 시트 데이터 포함 |
| `approveMember` (신규) | 사번 발번 + `구성원_v2` upsert + 권한그룹 멤버 추가 + `_대기승인.상태` = `approved` (트랜잭션) |
| `rejectMember` (신규) | `_대기승인.상태` = `rejected`, 사유 기록 |

### 5.2 폐기되는 액션
- `syncAccounts` / `initAccount` — `_계정` 시트 폐기에 따라 제거
- (이미 폐기된) `verifyLogin` / `setPassword` / `resetAccount`

### 5.3 헬퍼 추가
```js
// 5단계 제한 검증
function validateOrgDepth_(orgId, parentId, allOrgs) { ... }

// 다음 사번 추천 (M0001, M0002, ...)
function suggestNextUserId_() { ... }
```

---

## 6. 마이그레이션 (Q4 합의: 병행 운영)

### 6.1 운영자 1회 작업 (R7 배포 직후)
1. 스프레드시트 백업: 파일 → 사본 만들기 → `백업_R7_YYYYMMDD`
2. Apps Script 편집기에서 새 코드 배포 (`Migrate.gs` 포함)
3. 함수 드롭다운 → `migrateR7()` 실행 (예상 30초~2분)

### 6.2 `migrateR7()` 동작 (비파괴)
1. `구성원_v2` 시트 신규 생성 + 헤더 (없으면)
   - 기존 `_구성원` 의 row 들을 *읽기*해서 매핑 후 append
   - 매핑 규칙:
     - `역할` → 무시 (대신 권한그룹 처리)
     - `주조직ID` → `소속조직ID`
     - 다중 소속 → 보조조직IDs 합치기
     - 미존재 컬럼은 빈 값
2. `조직_v2` 시트 신규 생성 + 헤더
   - 기존 `_조직구조` 의 `조직유형` 컬럼 무시
   - 부모 체인 검증 (5단계 초과 시 콘솔 경고, row 는 그대로 복사)
3. `대기승인` 시트 신규 생성 + 헤더 (빈 시트)
4. `사이클_v2` 시트 신규 생성 + 헤더
   - 기존 `_리뷰` 의 모든 컬럼 보존하고 *순서만 재배치* (핵심 9 → 스페이서 → 부가)
5. **권한그룹 마이그레이션**: 기존 `_구성원` 에서 `역할 == 'admin'` 인 사번을 모두 `pg_owner.멤버사번JSON` 에 병합 (이미 있으면 중복 제거)
6. 콘솔 로그: `R7 마이그레이션 완료 — 구성원 N명, 조직 M개, admin 사용자 K명을 pg_owner 에 병합`

### 6.3 검증 절차
1. `/team` 페이지 진입 → 구성원이 모두 보이는지
2. `/permissions` 페이지 진입 → `pg_owner` 멤버가 기존 admin 들로 채워졌는지
3. `/cycles` 페이지 진입 → 기존 사이클이 모두 보이는지
4. 새 admin 으로 로그인 → 정상 진입
5. 미등록 이메일로 로그인 → `/pending-approval` 진입 + `대기승인` 시트에 row 생성

### 6.4 1주일 안전망 후 정리 (R7.1)
- 새 시트로 1주일 운영 + 이슈 없으면:
  - `_구성원` / `_조직구조` / `_리뷰` / `_계정` 시트 삭제
  - 또는 시트명 뒤에 `_archived_YYYYMMDD` 접미

### 6.5 롤백 절차
- Apps Script 이전 버전으로 되돌리기 + 새 버전 배포
- 새 시트(`_v2` 접미)는 그대로 두면 무영향 (옛 코드는 `_v2` 시트를 무시)
- 클라이언트: `localStorage` 의 `team-data-v1` 키 삭제 후 새로고침

---

## 7. 성능 개선 (R7 + 후속)

R7 본 단계에서 적용할 항목:
- ✅ **SWR 패턴**: localStorage 캐시 즉시 표시 + 백그라운드 델타 fetch
- ✅ **Apps Script `CacheService` 5분 TTL** (구성원/조직/권한그룹 한정)

후속(R7.2) 으로 미루는 항목:
- 델타 동기화 (`?since=`) — 시트에 `수정일시` 컬럼 추가 필요
- IndexedDB 쓰기 큐 + 낙관적 UI
- `_인덱스` 시트

---

## 8. UX 추가 (Phase 2 이후)

- **승인 대기 사이드바 배지**: `/team` 메뉴 옆 빨간 카운트
- **일괄 승인**: 다중 선택 + 권한그룹 일괄 적용
- **이메일 패턴 → 조직 자동 추정**: 후보만 제시, 확정은 사람이
- **시트 Data Validation**: `소속조직ID` 컬럼에 `조직_v2!A:A` 드롭다운 자동 적용
- **시트 자동 백업**: 매일 새벽 시간 트리거로 사본 생성
- **명령 팔레트 (⌘K)**: 회원/조직/사이클 검색 점프
- **승인 시 환영 이메일**: `MailApp.sendEmail` 자동 발송

---

## 9. Phase 별 작업 분해 (R7 전체)

### Phase 1 — 마이그레이션 기반 ✅ (2026-04-28 완료)
1. ✅ `apps-script/Migrate_R7.gs` 신규 — `migrateR7_run/cleanupDeadSheets/archiveOldSheets/rollback`
2. ✅ `src/types/index.ts` — `User.status` / `secondaryOrgIds` / `PendingApproval` 추가. `User.role` / `OrgUnit.type` 은 deprecated 표시만(호환 보존)
3. ✅ `apps-script/ReviewFlow.gs` SHEET 상수 추가 (`SHEET_USERS_V2` 등)
4. ✅ 사용 중단 Apps Script 파일 6개 삭제 (`Code.gs` / `Code_v2.gs` / `OrgSync.gs` / `ReviewSync.gs` / 구 마이그레이션 2종)

### Phase 2 — 신규 회원 승인 흐름 ✅ (완료)
1. ✅ `verifyGoogleLogin` 동작 변경 — 미등록 이메일이면 `_대기승인` upsert + `status: 'pending'` 응답
2. ✅ `approveMember` / `rejectMember` / `getPendingApprovals` 액션 + 감사 로그
3. ✅ `RequireAuth` 가 pending 사용자를 `/pending-approval` 로 강제. `RequirePending` 신규
4. ✅ `/team/pending-approvals` 페이지 + 사이드바 배지(5분 폴링) + Team 상단 배너

### Phase 3 — 조직 균일 5단계 ✅ (완료)
1. ✅ `getOrgLevelLabel/getOrgLevelPlaceholder/getOrgDepth/validateOrgDepth/inferTypeByDepth` 헬퍼
2. ✅ `OrgUnitDialog`/`QuickAddMemberDialog`/`SecondaryOrgSection`/`Team.tsx` 라벨 일원화
3. ✅ `OrgTreeNode '+' 버튼` / `OrgUnitDialog 저장` / `DnD into 드롭` 모두 5단계 제한
4. ✅ `ORG_TYPE_LABEL/PLACEHOLDER/NEXT` 는 `@deprecated` 마킹만 (호환 보존)

### Phase 4 — 성능 ✅ (완료)
1. ✅ Apps Script `bulkGetAll` 단일 액션 — 6 시트 한 번에. HTTP 라운드트립 6→1
2. ✅ Apps Script `ScriptCache` 5분 TTL — 100KB 한도, graceful skip. 14개 쓰기 액션 진입 시 자동 invalidate
3. ✅ `useOrgSync` 가 `bulkGetAll` 우선 + 미지원 시 6개 병렬 폴백

### Phase 5 — 정리 ✅ (이번 단계, 일부 완료)
1. ✅ `docs/db-schema.md` 보정 — `구성원_v2` 에 `역할` 컬럼 보존 (사이클 참여 분류용)
2. ✅ `Migrate_R7.gs` — `역할` 컬럼 매핑 추가 (admin/member 정규화)
3. ✅ `isSystemOperator(user)` 헬퍼 + 비즈니스 로직 4개 파일 정리 (resolveTargets/exportUtils/createCycleSubmissions/cyclePreflight)
4. ✅ `docs/permissions.md` 에 R7 변경 이력 추가
5. ⏳ 1주일 안정 운영 검증 — 운영자 진행
6. ⏳ `migrateR7_archiveOldSheets()` 실행 — 검증 후 운영자 진행

### Phase 6 — 잔여 정리 (후속, 우선순위 낮음)
- `User.role` 나머지 ~80 군데 참조 정리 (Dashboard / Settings / MemberProfile 등 표시 로직, RequireRole 라우트 가드)
- `OrgUnit.type` 데이터 필드 제거 + `userCompat.legacyDepartment/SubOrg/Team/Squad` 정리
- `OrgSel` 데이터 구조를 4-tier 에서 N-level 부모 체인으로 리팩토링 (MemberNew/MemberEdit/OrgSelector)
- 4단계 컬럼(`주조직/부조직/팀/스쿼드`) 마이그 후 시트에서 완전 제거

---

## 10. 운영자 검증 + Archive 가이드 (Phase 5 후반)

### 10.1 사전 점검 (배포 직후)
- [ ] Apps Script 편집기에서 `ReviewFlow.gs` + `Migrate_R7.gs` 새 버전 배포
- [ ] Script Properties 확인: `GOOGLE_CLIENT_ID` 설정됨
- [ ] 기존 admin 계정으로 로그인 — 정상 진입 확인
- [ ] 미등록 이메일로 시도 — `/pending-approval` 페이지 노출 + `_대기승인` row 생성 확인
- [ ] admin 이 `/team/pending-approvals` 진입 — 승인 다이얼로그 동작 확인
- [ ] 사이드바 "구성원" 배지 카운트 일치 확인

### 10.2 마이그레이션 (한 번만)
- [ ] 시트 백업: 파일 → 사본 만들기 → `백업_R7_YYYYMMDD`
- [ ] Apps Script 함수 드롭다운 → `migrateR7_run` 선택 → ▶ 실행
- [ ] `구성원_v2` / `조직_v2` / `대기승인` / `사이클_v2` 4개 시트 생성 확인
- [ ] `_권한그룹.pg_owner.멤버사번JSON` 에 admin 사번 자동 병합 확인
- [ ] (즉시 가능) `migrateR7_cleanupDeadSheets()` 실행 → `_계정` 삭제

### 10.3 1주일 검증 (D ~ D+7)
- [ ] 매일 `_대기승인` 시트 확인 — 비정상 row 누적 없는지
- [ ] 구성원 추가/편집/조직 이동/사이클 발행 등 일상 운영 정상
- [ ] Apps Script 로그(`보기 → 실행`) 에서 에러 없는지
- [ ] 클라이언트 console 에 `[OrgSync] bulk fresh/unchanged Xms (cached)` 로그 — 캐시 적중 확인
- [ ] 1주 누적 에러 없으면 다음 단계로

### 10.4 Archive (D+7 이후)
- [ ] Apps Script → `migrateR7_archiveOldSheets()` 실행
- [ ] `_구성원` → `_구성원_archived_YYYYMMDD` 등 3개 archive 확인
- [ ] 클라이언트 동작 영향 없음 확인 (구버전 시트 archive 후에도 v2 만 사용)
- [ ] 추가 1주일 운영 후 archived 시트들도 삭제(선택)

### 10.5 롤백 절차 (문제 발생 시)
- Apps Script: 이전 버전으로 되돌리기 + 새 버전 재배포
- `migrateR7_rollback()` 실행 → `_v2` 시트들이 `_rollback_*` 로 옮겨짐
- 클라이언트 `localStorage.removeItem('team-data-v1')` + 새로고침
- archive 된 시트는 이름만 복구하면 즉시 운영 복귀

---

## 11. 변경 이력

- **R7** (2026-04-28~, Phase 1~5 완료): Google SSO + 신규 회원 승인 + 조직 균일 5단계 + bulkGetAll/ScriptCache 성능 + isSystemOperator 헬퍼 도입
- R6: 권한 그룹 + 마스터 로그인 권한 분리
- R5-b: 마스터 로그인 (impersonation) UI
- R5-a: 자유 재귀 조직 트리 (squad 자기재귀)
- R4: 인사 스냅샷 사용자 UI
- R3: 사이클 매핑 재설계 (downward 차수)
- R1: 권한 모델 + ActivityStatus
