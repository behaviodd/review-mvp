# 권한 매트릭스 (R6 기준)

리뷰 운영의 모든 액션 권한은 `src/utils/permissions.ts` 에 단일 소스로 정의됩니다. UI 가시성(`src/hooks/usePermission.ts`)은 동일 어휘를 사용합니다.

## 1. 액션 주체 (4축, R6 기준)

| 주체 | 정의 | 식별 방법 |
|---|---|---|
| **소유자(admin)** | `user.role === 'admin'` 인 사용자. 자동으로 모든 권한 보유. | `isAdmin()` / `pg_owner` 그룹 자동 가입 |
| **권한 그룹 멤버** | `PermissionGroup.memberIds` 에 포함되어 그룹의 권한 코드 누적 보유 | `hasPermission(actor, code, groups)` |
| **평가권자** (Reviewer) | 활성 `ReviewerAssignment` 를 1개 이상 보유 | `isAssignedReviewer(actor, submission, assignments)` |
| **조직 리더** (Org Head) | `OrgUnit.headId === actor.id` 인 조직을 1개 이상 보유 | `usePermission().isOrgHead` |

> 한 사람이 여러 주체를 동시에 가질 수 있음. 권한은 합집합으로 누적.

## 2. 권한 매트릭스

R6 이후 운영 액션은 role 단독이 아니라 **권한 코드 보유 여부**가 기준입니다. admin role 사용자는 자동으로 모든 권한을 보유하며, non-admin 사용자도 `PermissionGroup` 멤버십으로 같은 권한 코드를 보유하면 해당 라우트와 액션을 사용할 수 있습니다.

| 액션 | 필요한 권한/조건 | 평가권자(자기 reviewee) | 조직 리더(자조직) | 일반 member |
|---|---|---|---|---|
| 사이클 생성/삭제/편집 | `cycles.manage` | ❌ | ❌ | ❌ |
| 템플릿 관리 | `templates.manage` | ❌ | ❌ | ❌ |
| 자기평가 작성/수정 | 본인 제출물 | ✅(자신) | ✅(자신) | ✅(자신) |
| 하향(downward) 작성 | 활성 평가권 또는 `cycles.manage` 대리 | ✅(배정된 reviewee) | ❌ | ❌ |
| 마감 연장 | `cycles.manage` 또는 활성 평가권 | ✅(자기 reviewee) | ❌ | ❌ |
| 평가자 변경 | `cycles.manage` 또는 `reviewer_assignments.manage` | ❌ | ❌ | ❌ |
| 대리 작성 | `cycles.manage` | ❌ | ❌ | ❌ |
| 제출 재오픈 | `cycles.manage` 또는 활성 평가권 | ✅(자기 reviewee) | ❌ | ❌ |
| 동료 제안 승인/반려 | `cycles.manage` 또는 활성 평가권 | ✅(자기 reviewee) | ❌ | ❌ |
| 결과 열람(타인) | `reports.view_all` 또는 `cycles.manage` 또는 활성 평가권 | ✅(자기 reviewee) | ❌ | ❌ |
| 감사 로그 열람 | `audit.view` | ❌ | ❌ | ❌ |
| 일괄 개입 | `cycles.manage` | ❌ | ❌ | ❌ |

> 피평가자 본인의 자기 결과 열람은 별도 `cycle.visibility` 정책으로 처리되며 위 매트릭스 범위 외.

## 3. 핵심 함수

### `canExtendDeadline(ctx)`
- `cycles.manage` 보유자: 모든 사이클·submission
- 평가권자: `assignments` 에 `reviewerId === actor.id && revieweeId === submission.revieweeId && !endDate` 이면 허용
- 사이클이 closed 또는 editLockedAt 인 경우 모두 거부

### `canReopenSubmission(ctx)`
- `cycles.manage` 보유자: 모든 제출된 submission
- 평가권자: 자기 reviewee 의 제출된 submission

### `canUnlockEdit(actor)`
- `cycles.manage` 보유자

### `canReassignReviewer(ctx)`
- `cycles.manage` 또는 `reviewer_assignments.manage` 보유자
- downward 제출물만 허용

### `canProxyWrite(ctx)` / `canBulkIntervene(ctx)`
- `cycles.manage` 보유자

### `canViewAuditLog(actor)`
- `audit.view` 보유자

### `canDecidePeerProposal(ctx)`
- `cycles.manage` 보유자 + 평가권자(자기 reviewee 한정)

### `canViewSubmissionResult(ctx)`
- `reports.view_all` 또는 `cycles.manage` 보유자 + 평가권자(자기 reviewee 한정)

## 4. UI 가시성 (`usePermission()`)

| 반환값 | 정의 |
|---|---|
| `isAdmin` | `role === 'admin'` |
| `isLeader` | admin OR leader OR isOrgHead OR isReviewer (= 활성 평가권 보유) |
| `isReviewer` | 활성 `ReviewerAssignment` 보유 |
| `isOrgHead` | `OrgUnit.headId === currentUser.id` 인 조직 보유 |
| `can.viewTeamReviews` | `isLeader` 와 동치 |
| `can.writeDownwardReview` | `isLeader` 와 동치 |
| `can.manageCycles` | `cycles.manage` 보유 |
| `can.manageTemplates` | `templates.manage` 보유 |
| `can.viewAllReports` | `reports.view_all` 보유 |
| `can.manageOrg` | `org.manage` 보유 |
| `can.managePermissionGroups` | `permission_groups.manage` 보유 |
| `can.impersonate` | `auth.impersonate` 보유 |
| `can.viewAuditLog` | `audit.view` 보유 |
| `can.manageSettings` | `settings.manage` 보유 |
| `can.manageReviewerAssignments` | `reviewer_assignments.manage` 보유 |

## 5. 호출 시 주의사항

권한 체크 함수에 **`assignments` 인자를 전달**해야 평가권자 권한이 인정됩니다. 누락 시 admin only 로 fallback:

```ts
// ❌ 잘못된 호출 — 평가권자 권한 무시됨
canExtendDeadline({ actor, cycle, submission })

// ✅ 올바른 호출
const assignments = useTeamStore(s => s.reviewerAssignments);
canExtendDeadline({ actor, cycle, submission, assignments })
```

호출처:
- `src/components/review/SubmissionActionRail.tsx`
- `src/pages/reviews/CycleDetail.tsx` (preflight 등)
- `src/pages/reviews/PeerApprovalPage.tsx`
- `src/pages/reviews/MyReviewWrite.tsx`
- `src/components/review/modals/DryRunModal.tsx`
- `src/pages/reviews/CycleNew.tsx`

## R6: 권한 그룹 (PermissionGroup)

R6 부터 admin role 단일 게이트 외에 **권한 그룹** 으로 액션을 분리. 9종 권한 코드 + 4개 시스템 그룹.

### 권한 코드

| 카테고리 | 코드 | 의미 |
|---|---|---|
| 리뷰 운영 | `cycles.manage` | 사이클 생성/편집/발행/삭제, 마감 연장, 대리 작성 |
| 리뷰 운영 | `templates.manage` | 템플릿 관리 |
| 리뷰 운영 | `reports.view_all` | 전사 리포트 열람 |
| 구성원 | `org.manage` | 조직 구조/구성원/퇴사 처리 |
| 구성원 | `reviewer_assignments.manage` | 평가권자 배정 |
| 보안 | `auth.impersonate` | 마스터 로그인 |
| 보안 | `audit.view` | 감사 로그 열람 |
| 시스템 | `permission_groups.manage` | 권한 그룹 관리 |
| 시스템 | `settings.manage` | 시스템 설정 |

### 시스템 기본 그룹 (자동 시드)

| 그룹 ID | 이름 | 권한 | 멤버 |
|---|---|---|---|
| `pg_owner` | 소유자 | 모든 권한 | admin role 사용자 자동 가입 |
| `pg_review_admin` | 리뷰 관리자 | cycles.manage, templates.manage, reports.view_all | 비어있음 |
| `pg_org_admin` | 구성원 관리자 | org.manage, reviewer_assignments.manage | 비어있음 |
| `pg_master_login` | 마스터 로그인 | auth.impersonate, audit.view | 비어있음 |

시스템 그룹은 `isSystem=true` — 멤버만 변경 가능, 이름/설명/권한/삭제 잠금.

### 권한 부여 흐름

1. admin이 `/permissions` 진입 → 권한 관리 페이지
2. 시스템 그룹 카드 클릭 → SideDrawer 에서 멤버 추가
3. 또는 "새 그룹" 버튼으로 사용자 정의 그룹 생성
4. 멤버는 자동으로 그룹의 권한 코드 누적 보유
5. 시트(`_권한그룹`) 양방향 동기화

### 마스터 로그인 (R5-b → R6 통합)

- 권한: `auth.impersonate` (시스템 그룹 또는 admin role)
- 흐름: Team 페이지 행 → 마스터 로그인 버튼 → ConfirmDialog (사유 미요구) → 즉시 접속
- 활성 중:
  - admin Sidebar 섹션 (구성원 관리/리뷰 운영/보안 관리) 자동 숨김
  - admin 라우트 (`/permissions`, `/cycles` 등) 직접 URL 입력 차단
  - MyReviewWrite/TeamReviewWrite 의 isReadOnly 강제 (작성·저장·제출 차단)
  - 빨간 sticky `ImpersonationBanner` 표시 + "원래대로" 버튼
- 종료: `endImpersonation()` → originalUser 자동 복원
- 감사 로그: `_마스터로그인` 시트 + `/security/audit` 페이지

## 7. R6 운영자 작업 가이드 (Apps Script)

R6 코드 배포 후 운영자가 1회 수행해야 할 작업입니다 (약 5분).

### 1. 사전 백업
- 스프레드시트 → 파일 → 사본 만들기 → "백업_R6_YYYYMMDD"

### 2. ReviewFlow.gs 새 버전 배포
- Apps Script 편집기에서 `ReviewFlow.gs` 전체 코드 → 삭제
- GitHub `apps-script/ReviewFlow.gs` 최신본 붙여넣기
- ⌘S 저장 → 배포 → 배포 관리 → 새 버전 (Web App URL 유지)

### 3. `migrate_addMissingColumns()` 실행
- 함수 드롭다운 → 선택 → ▶ 실행
- 콘솔 로그: `"마이그레이션 완료 — 12개 시트 헤더 점검됨 (R1+R6)."`
- 신규 시트 자동 생성: `_권한그룹`

### 4. 클라이언트 부팅 시 자동 시드
- 사용자가 사이트 첫 방문 시 `seedSystemGroups()` 자동 실행
- `_권한그룹` 시트에 시스템 그룹 4종 자동 push
- admin role 사용자가 `pg_owner` 그룹에 자동 가입됨

### 5. 검증
- `_권한그룹` 시트에 4행 (소유자/리뷰관리자/구성원관리자/마스터로그인)
- 소유자 그룹의 `멤버사번JSON` 에 admin 사용자 사번 포함
- admin 이 `/permissions` 페이지 진입 가능
- admin 이 `/security/audit` 페이지 진입 가능

### 롤백 (문제 발생 시)
- ReviewFlow.gs 백업 버전으로 되돌리기 + 새 버전 배포
- `_권한그룹` 시트는 그대로 두면 무영향 (옛 코드는 무시)
- 클라이언트 측: localStorage 의 `team-data-v1` 키 삭제 후 새로고침 → 시트에서 재 fetch

## 8. 변경 이력

- **R7** (2026-04-28~, 진행): Google SSO + 신규 회원 승인 + DB 단순화 + 성능 개선
  - **Phase 0~2 (인증/승인)**: makestar.com 도메인 제한 Google SSO 도입.
    이메일/비밀번호 인증 일괄 제거. 미등록 사용자는 `_대기승인` 시트에 자동 upsert
    되고 관리자가 `/team/pending-approvals` 에서 사번/조직/권한그룹 지정 후 승인.
    `RequireAuth` 가드가 pending 사용자를 `/pending-approval` 빈 페이지로 강제.
    Sidebar 구성원 메뉴 옆 빨간 카운트 배지(5분 폴링).
  - **Phase 3 (조직 균일 5단계)**: 4종 타입(`mainOrg/subOrg/team/squad`) 별
    라벨을 부모 체인 depth 기반으로 일원화. "주조직 / 하위 조직 1~4" 표기.
    `MAX_ORG_DEPTH=4`(=5단계) 검증 — 트리 "+" 버튼·OrgUnitDialog·DnD drop
    모두 제한. `OrgUnit.type` 데이터 필드는 호환 보존.
  - **Phase 4 (성능)**: `bulkGetAll` 단일 액션으로 6개 시트 일괄 조회
    (HTTP 라운드트립 6→1). Apps Script 측 `ScriptCache` 5분 TTL — 캐시
    적중 시 시트 read 0회. 14개 쓰기 액션 진입 시 자동 invalidate.
    예상: 폴링 시 캐시 적중 케이스 ~1000ms → ~50-150ms.
  - **Phase 5 (정리)**: `User.role` 의 의미를 *권한* 이 아닌
    *평가 참여 분류* 로 명확화. `isSystemOperator(user)` 헬퍼 도입,
    `resolveTargets`/`exportUtils`/`createCycleSubmissions`/`cyclePreflight`
    의 `role !== 'admin'` 비교를 헬퍼로 교체. 권한 판단은 항상
    `hasPermission(actor, code, groups)` / `usePermission()` 사용.
  - **시트 마이그레이션**: `Migrate_R7.gs` 의 `migrateR7_run()` 으로
    `구성원_v2` / `조직_v2` / `대기승인` / `사이클_v2` 비파괴 생성.
    1주일 검증 후 `migrateR7_archiveOldSheets()` 로 구버전 archive.

- **R6**: 권한 그룹 + 마스터 로그인 권한 분리
  - Phase A: PermissionCode 9종 + PermissionGroup 모델 + 시스템 그룹 4종 시드
  - Phase B: hasPermission 헬퍼 + permissions.ts/usePermission.ts 일원화
  - Phase C: /permissions 페이지 (그룹 카드 + SideDrawer 편집)
  - Phase D: 마스터 로그인 권한을 auth.impersonate 로 분리, 사유 입력 제거,
    Sidebar admin 메뉴 자동 숨김, RequireRole 가드 강화
  - Phase E: /security/audit 통합 감사 로그 페이지 + Sidebar 메뉴 트리 재구성
    (구성원 관리 / 리뷰 운영 / 보안 관리 3개 admin 섹션)
  - Phase F: AuditLog 탭 segments[pills] 통일, 5종 시나리오 검증, docs 통합, 운영자 가이드

- **R5-b**: 마스터 로그인 (impersonation) UI
  - Team.tsx 구성원 행에 admin only "마스터 로그인" 버튼 추가
  - ConfirmDialog 시작 다이얼로그 (사유 필수 입력)
  - AppLayout 상단 빨간 sticky 배너 — "현재 [홍길동]으로 보기 중 · [원래대로]"
  - authStore: originalUser 스냅샷 저장 → endImpersonation 시 자동 복원
  - MyReviewWrite/TeamReviewWrite: isReadOnly 에 isImpersonating 추가 → 작성·저장·제출 차단
  - impersonationLogWriter.start/end 로 시트 자동 동기화
  - 호환: 일반 사용자 미영향, R1 데이터 모델 그대로 사용

- **R5-a**: 자유 재귀 조직 트리
  - `ORG_TYPE_NEXT['squad'] = 'squad'`, `ALLOWED_CHILD['squad'] = 'squad'` — squad 자기재귀로 5단계 이상 깊이 무제한
  - OrgTreeNode 들여쓰기는 이미 depth 기반, depth ≥ 4 부터 `Lv.N` 배지 표시
  - 멤버 카운트: `getMembersInOrgTree(orgUnitId)` 로 트리 전체 룩업 + legacy 4단계 텍스트 매칭 fallback
  - DnD 재배치: squad → squad 이동도 ALLOWED_CHILD 자동 적용
  - 타입(`OrgUnitType`) 보존 — R3 까지 호환을 위해 squad 라벨 유지, 향후 R6 에서 type 필드 제거 예정
  - 영향 없는 영역: 기존 4단계 사이클(mainOrg/subOrg/team/squad), 기존 시트 데이터

- **R4**: 인사 스냅샷 사용자 UI
  - 사이클 발행 시 `hrSnapshotMode` 라디오 (snapshot 권장 / live)
  - snapshot 모드 즉시 발행 시 `OrgSnapshot` 자동 생성 + `cycle.hrSnapshotId` 연결
  - `resolveEffectiveOrgData(cycle, live, snapshots)` 헬퍼로 평가자/대상자 룩업이 snapshot 데이터 사용
  - DryRunModal, runPreflight, createCycleSubmissions 호출처에서 resolver 적용
  - CycleDetail headerSubtitle 에 `📷 스냅샷 YYYY-MM-DD` / `⚡ 실시간` pill (호버 시 스냅샷 메타 정보)
  - 예약 발행은 R5 에서 발행 시점 자동 스냅샷 생성으로 보강 예정
  - 호환: 기존 사이클(`hrSnapshotMode` 미설정) → live 폴백, 동작 변경 없음

- **R3**: 사이클 매핑 재설계
  - `downward = manager` 하드코딩 제거
  - `cycle.downwardReviewerRanks: number[]` 도입 (기본 `[1]`, 1~5 차수 UI 노출)
  - `ReviewSubmission.reviewerRank` 추가 — downward 의 차수
  - `createCycleSubmissions` 가 차수별로 1건씩 생성 (1차/2차 동일인이면 1건)
  - `cyclePreflight` 가 차수별 평가권자 누락을 별도 block 으로 감지
  - rank ≥ 2 는 명시적 `ReviewerAssignment` 만 인정 (legacy fallback 없음)
  - 운영자 작업: Apps Script 새 버전 배포 + `migrate_addMissingColumns()` 1회 실행 (CYCLE/SUBMISSION 컬럼 보강)
