# 권한 매트릭스 (R2 적용)

리뷰 운영의 모든 액션 권한은 `src/utils/permissions.ts` 에 단일 소스로 정의됩니다. UI 가시성(`src/hooks/usePermission.ts`)은 동일 어휘를 사용합니다.

## 1. 액션 주체 (3축)

| 주체 | 정의 | 식별 방법 |
|---|---|---|
| **admin** | `user.role === 'admin'` 인 사용자 | `isAdmin()` |
| **평가권자** (Reviewer) | 활성 `ReviewerAssignment` 를 1개 이상 보유 | `isAssignedReviewer(actor, submission, assignments)` |
| **조직 리더** (Org Head) | `OrgUnit.headId === actor.id` 인 조직을 1개 이상 보유 | `usePermission().isOrgHead` |

> 한 사람이 여러 주체를 동시에 가질 수 있음. admin > 평가권자 > 조직 리더 순으로 권한 우선순위.

## 2. 권한 매트릭스

| 액션 | admin | 평가권자(자기 reviewee) | 조직 리더(자조직) | member |
|---|---|---|---|---|
| 사이클 생성/삭제/편집 | ✅ | ❌ | ❌ | ❌ |
| 템플릿 관리 | ✅ | ❌ | ❌ | ❌ |
| 자기평가 작성/수정 | ✅(대리) | ✅(자신) | ✅(자신) | ✅(자신) |
| 하향(downward) 작성 | ✅(대리) | ✅(배정된 reviewee) | ❌ | ❌ |
| 마감 연장 | ✅(전체) | ✅(자기 reviewee) | ❌ | ❌ |
| 평가자 변경 | ✅ | ❌ | ❌ | ❌ |
| 대리 작성 | ✅ | ❌ | ❌ | ❌ |
| 제출 재오픈 | ✅(전체) | ✅(자기 reviewee) | ❌ | ❌ |
| 동료 제안 승인/반려 | ✅ | ✅(자기 reviewee) | ❌ | ❌ |
| 결과 열람(타인) | ✅(전체) | ✅(자기 reviewee) | ❌ | ❌ |
| 감사 로그 열람 | ✅ | ❌ | ❌ | ❌ |
| 일괄 개입 | ✅ | ❌ | ❌ | ❌ |

> 피평가자 본인의 자기 결과 열람은 별도 `cycle.visibility` 정책으로 처리되며 위 매트릭스 범위 외.

## 3. 핵심 함수

### `canExtendDeadline(ctx)`
- admin: 모든 사이클·submission
- 평가권자: `assignments` 에 `reviewerId === actor.id && revieweeId === submission.revieweeId && !endDate` 이면 허용
- 사이클이 closed 또는 editLockedAt 인 경우 모두 거부

### `canReopenSubmission(ctx)`
- admin: 모든 제출된 submission
- 평가권자: 자기 reviewee 의 제출된 submission

### `canReassignReviewer(ctx)` / `canProxyWrite(ctx)` / `canViewAuditLog(actor)` / `canBulkIntervene(ctx)` / `canUnlockEdit(actor)`
- **admin only**

### `canDecidePeerProposal(ctx)` / `canViewSubmissionResult(ctx)`
- admin + 평가권자(자기 reviewee 한정)

## 4. UI 가시성 (`usePermission()`)

| 반환값 | 정의 |
|---|---|
| `isAdmin` | `role === 'admin'` |
| `isLeader` | admin OR leader OR isOrgHead OR isReviewer (= 활성 평가권 보유) |
| `isReviewer` | 활성 `ReviewerAssignment` 보유 |
| `isOrgHead` | `OrgUnit.headId === currentUser.id` 인 조직 보유 |
| `can.viewTeamReviews` | `isLeader` 와 동치 |
| `can.writeDownwardReview` | `isLeader` 와 동치 |
| `can.manageCycles` / `manageTemplates` / `viewAllReports` / `manageOrg` | admin only |

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

## 6. 변경 이력

- **R1**: 평가권 모델(`ReviewerAssignment`) 도입
- **R2**: 권한 매트릭스 일원화. 평가권자가 자기 reviewee 액션 가능
- **R3** (현재): 사이클 매핑 재설계
  - `downward = manager` 하드코딩 제거
  - `cycle.downwardReviewerRanks: number[]` 도입 (기본 `[1]`, 1~5 차수 UI 노출)
  - `ReviewSubmission.reviewerRank` 추가 — downward 의 차수
  - `createCycleSubmissions` 가 차수별로 1건씩 생성 (1차/2차 동일인이면 1건)
  - `cyclePreflight` 가 차수별 평가권자 누락을 별도 block 으로 감지
  - rank ≥ 2 는 명시적 `ReviewerAssignment` 만 인정 (legacy fallback 없음)
  - 운영자 작업: Apps Script 새 버전 배포 + `migrate_addMissingColumns()` 1회 실행 (CYCLE/SUBMISSION 컬럼 보강)
