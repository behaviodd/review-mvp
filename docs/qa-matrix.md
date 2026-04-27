# QA 매트릭스 — review-mvp 안정성 체크리스트

> 목적: 역할 × 페이지 × 데이터 상태 조합에서 **화면이 정상 렌더되고**, **dead-end가 없고**, **데이터 유실/비일관성이 없음**을 수기로 검증한다.
> 대상 브랜치/환경: main · 운영 스프레드시트 연동 상태.
> 작성일: 2026-04-27 (R6 권한 그룹 + 신규 페이지 전환 반영).

---

## 0. 사전 준비

- [ ] 로컬 개발서버(`npm run dev`) 로 진입 가능
- [ ] `Settings > Google Sheets 연동` 에 운영 Apps Script URL 이 등록되어 있음
- [ ] `users` 시트에 admin / leader / member 역할 각 1명 이상 존재
- [ ] `_권한그룹` 시트가 비어 있거나 일부 시스템 그룹이 누락되어도 앱 부팅 후 소유자/리뷰 관리자/구성원 관리자/마스터 로그인 시스템 그룹이 복구됨
- [ ] 진행 중(`self_review`) + 관리자 평가(`manager_review`) + 종료(`closed`) + 보관(`archivedAt`) 사이클 각 1개 이상 존재
- [ ] DevTools 콘솔을 열어 두고 **빨간 에러가 새로 뜨지 않는지** 관찰

---

## 1. 라우트 × 가드 매트릭스

R6 이후 관리자성 라우트는 role보다 `PermissionGroup` 권한 코드가 우선입니다. admin role은 모든 권한을 자동 보유하며, non-admin도 권한 그룹 멤버라면 해당 라우트를 통과해야 합니다.

| 경로 | 가드 | 기대 결과 |
|---|---|---|
| `/login` | `RedirectIfAuthed` | 로그인 상태면 `/`, 로그아웃 상태면 로그인 화면 |
| `/` | `RequireAuth` | 인증 사용자 전체 접근 |
| `/reviews/me` | role `leader/member/admin` | admin은 EmptyState 안내, leader/member는 자기평가 목록 |
| `/reviews/me/:submissionId` | role `leader/member/admin` | 본인 또는 대리 작성 조건 충족 시 작성/열람, 아니면 EmptyState |
| `/reviews/me/peers/:cycleId` | role `leader/member/admin` | 피어 지명 가능 정책이면 정상, 아니면 자동 복귀 |
| `/reviews/received` | role `leader/member/admin` | 받은 리뷰 목록 |
| `/reviews/team` | role `leader` 또는 조직장 보정 | 리더/조직장만 팀 리뷰 목록 |
| `/reviews/team/:cycleId/:userId` | role `leader/admin` 또는 조직장 보정 | 권한 범위의 하향 평가 작성 |
| `/reviews/team/peer-approvals` | role `leader/admin` 또는 조직장 보정 | 승인 대기 데이터가 있으면 정상 |
| `/reviews/proxy/:submissionId` | role `admin` | self는 대리 작성 redirect, downward는 안내 |
| `/cycles` | `cycles.manage` | 권한 보유자만 접근 |
| `/cycles/archive` | `cycles.manage` | 권한 보유자만 접근 |
| `/cycles/new` | `cycles.manage` | 권한 보유자만 접근 |
| `/cycles/:cycleId` | `cycles.manage` | 권한 보유자만 접근, 잘못된 id는 EmptyState |
| `/cycles/:cycleId/edit` | `cycles.manage` | 권한 보유자만 접근, 잠김 사이클은 EmptyState |
| `/templates` | `templates.manage` | 권한 보유자만 접근 |
| `/templates/:templateId` | `templates.manage` | 권한 보유자만 접근 |
| `/team` | `RequireAuth` | 인증 사용자 전체 접근 |
| `/team/profile-fields` | `org.manage` | 구성원 관리자 접근 |
| `/team/new` | `org.manage` | 구성원 관리자 접근 |
| `/team/bulk-move` | `org.manage` | 구성원 관리자 접근 |
| `/team/:id` | `RequireAuth` | 인증 사용자 전체 접근, 필드는 프로필 설정에 따라 표시 |
| `/team/:id/edit` | `org.manage` | 구성원 관리자 접근 |
| `/settings` | `RequireAuth` | 인증 사용자 전체 접근 |
| `/permissions` | `permission_groups.manage` | 권한 그룹 관리자 접근 |
| `/security/audit` | `audit.view` | 감사 로그 권한 보유자 접근 |
| `/존재하지않는경로` | catch-all | NotFound |

범례: 권한 없음은 `/` 또는 `/login` 으로 자동 복귀, 데이터 없음은 EmptyState 표시.

---

## 2. 데이터 상태 매트릭스

각 페이지에 대해 다음 상태에서 화면이 **흰 화면/무한 로딩/JS 에러 없이** 렌더되는지 확인.

| 상태 | 정의 |
|---|---|
| 정상 | 목록에 항목 3개 이상, 현재 사용자 기준 정상 데이터 |
| 빈 | 목록 0건 (필터 결과 0 포함) |
| 로딩 중 | 앱 부팅 직후 (스프레드시트 동기화 전) |
| 네트워크 에러 | Apps Script 응답 실패 (DevTools Network 차단으로 재현) |
| 권한 없음 | 로그인 역할이 해당 페이지 roles에 포함되지 않음 |
| 라우트 파라미터 깨짐 | 존재하지 않는 `:id` / `:cycleId` / `:submissionId` / `:templateId` |

---

## 3. 핵심 수기 시나리오 (43건)

### A. 인증/라우트 안전망 (1–5)
- [ ] **A1.** 로그아웃 상태에서 `/cycles` 직접 접근 → `/login` 으로 자동 이동.
- [ ] **A2.** 로그인 상태에서 `/login` 직접 접근 → `/` 으로 자동 이동.
- [ ] **A3.** 로그인 후 `/존재하지않는경로` 접근 → NotFound 화면 + "대시보드로" 버튼 동작.
- [ ] **A4.** member 역할로 `/cycles` 접근 → `/` 로 자동 복귀.
- [ ] **A5.** DevTools에서 임의 페이지에 `throw new Error('test')` 주입 → 해당 라우트만 ErrorBoundary fallback 표시, 사이드바/헤더는 유지.

### B. Dead-end 제거 (6–12)
- [ ] **B1.** 사이클 상세 `/cycles/존재안함` → EmptyState + "리뷰 목록으로" 버튼.
- [ ] **B2.** `/reviews/me/잘못된id` (member) → EmptyState + "내 리뷰 목록으로".
- [ ] **B3.** admin이 `/reviews/me/:id` 에 `proxy=1` 없이 진입 → "대리 작성 모드로 진입이 필요" 안내.
- [ ] **B4.** 남의 submission id를 URL에 입력 → "접근 권한이 없어요" 안내.
- [ ] **B5.** `/reviews/me/peers/:cycleId` 에서 admin_assigns 정책 사이클 접근 → 즉시 `/reviews/me` 로 복귀 + 토스트.
- [ ] **B6.** `/reviews/proxy/잘못된id` → "제출물을 찾을 수 없어요" 안내 + 사이클 목록으로.
- [ ] **B7.** admin이 `/reviews/me` 접근 → "관리자 계정에는 자기평가 대상이 없어요" 안내.

### C. 사이클 라이프사이클 (13–17)
- [ ] **C1.** admin 으로 사이클 새로 생성 → `/cycles/:id` 진입 + draft 상태 확인.
- [ ] **C2.** draft → self_review 단계 전환 → 대상 구성원에게 self 제출물 생성됨.
- [ ] **C3.** member 가 자기평가 작성 → 저장 / 제출 / 제출완료 플래그 반영.
- [ ] **C4.** leader 가 `/reviews/team` 에서 팀원 평가 진입 → TeamReviewWrite 정상 렌더.
- [ ] **C5.** 사이클 보관(archive) → `/cycles` 에서 사라지고 `/cycles/archive` 에 나타남. 보관 해제 → 원복.

### D. 피어 지명/승인 (18–21)
- [ ] **D1.** reviewee_picks 사이클에서 member 가 피어 3명 선택 → 해당 3명에게 peer 제출물 생성.
- [ ] **D2.** leader_approves 사이클에서 member 가 피어 제안 → leader 에게 approval 대기 카운트 +N.
- [ ] **D3.** leader 가 `/reviews/team/peer-approvals` 에서 승인 → 승인된 피어만 제출물 생성.
- [ ] **D4.** 동일 제안 재승인/반려 → 중복 제출물 생성되지 않음.

### E. 대리 작성 (22–24)
- [ ] **E1.** admin 이 사이클 상세에서 특정 member 의 self 에 대해 대리 작성 진입 → `/reviews/me/:id?proxy=1` 리다이렉트, 상단 proxy 배너 표시.
- [ ] **E2.** 대리 작성 저장/제출 → 해당 제출물의 status 업데이트, 감사로그 기록.
- [ ] **E3.** downward 제출물에 대해 `/reviews/proxy/:id` 진입 → "조직장 리뷰 대리 작성은 아직 지원되지 않아요" 안내 + 사이클 상세로 돌아가기 버튼.

### F. 동기화/복구 (25–28)
- [ ] **F1.** 네트워크 차단 후 사이클 저장 → pendingOps 큐에 적재, 네트워크 복구 후 재시도 성공.
- [ ] **F2.** 새로고침 후 persist 상태 복원 (cycles, submissions, auth) 확인.
- [ ] **F3.** 부팅 5초 뒤 pendingOps 가 있으면 자동 1회 재시도.
- [ ] **F4.** 다중 탭 동시 실행 → SchedulerTick 이 tickLock 에 의해 단일 리더만 실행 (중복 리마인드 없음).

### G. 기타 UX (29–30)
- [ ] **G1.** ⌘K / Ctrl+K 로 GlobalSearch 열기 → 사이클/템플릿/구성원 검색 후 이동 동작.
- [ ] **G2.** Dashboard "오늘 할 일" 카드 클릭 → 각 카드별 목적 페이지로 이동 (리마인드→cycles, 승인대기→peer-approvals 등).

### H. 페이지 헤더 / 안정성 (31–34)
- [ ] **H1.** `/team/new` 진입 후 헤더 뒤로가기 클릭 → `/team` 으로 이동.
- [ ] **H2.** `/team/:id/edit` 에서 사이드바의 다른 메뉴 클릭 → 즉시 이동, 클릭이 무시되지 않음.
- [ ] **H3.** `/cycles/:cycleId/edit` 에서 헤더 뒤로가기 → `/cycles/:cycleId` 로 복귀, 사이클 상세가 정상 렌더.
- [ ] **H4.** `/team/:id/edit` 진입 후 5초 동안 화면 깜빡임/무한 리렌더/콘솔 에러가 없고 헤더 액션이 계속 클릭 가능.

### I. 라우트 우선순위 / 동적 세그먼트 (35–37)
- [ ] **I1.** `/team/profile-fields` URL 직접 입력 → ProfileFieldSettings 페이지가 열림 (`/team/:id` 가 아님).
- [ ] **I2.** `/team/new` URL 직접 입력 → MemberNew 페이지가 열림 (`/team/:id` 가 아님).
- [ ] **I3.** `/team/bulk-move?ids=u1,u2,u3` 및 빈 `ids` 로 진입 → 흰 화면 없이 정상 안내 또는 이동 폼 표시.

### J. 권한 자동 복귀 (38–40)
- [ ] **J1.** `cycles.manage` 만 보유한 non-admin 그룹 멤버로 `/permissions` 접근 → `/` 자동 복귀.
- [ ] **J2.** `org.manage` 보유 non-admin 그룹 멤버로 `/team/profile-fields` 접근 → 정상 렌더.
- [ ] **J3.** member role 사용자가 `/cycles/abc/edit` 직접 입력 → `/` 자동 복귀.

### K. 페이지 전환 회귀 — 데이터 흐름 (41–42)
- [ ] **K1.** 외부 알림 또는 책갈피의 `/cycles/:cycleId?edit=1` 링크 진입 → `/cycles/:cycleId/edit` 으로 replace 리다이렉트.
- [ ] **K2.** `/cycles/:cycleId/edit` 에서 저장 → `/cycles/:cycleId` 로 이동, 변경된 필드가 상세 화면에 반영.

### L. EmptyState / Edge case (43)
- [ ] **L1.** `editLockedAt` 인 사이클의 상세에서 편집 진입이 막히고, `/cycles/:cycleId/edit` 직접 입력 시 EmptyState + "상세 화면으로" 동작.

---

## 4. 회귀 주의 체크 (자주 깨지는 곳)

- [ ] 로그인 직후 OrgSync/ReviewSync 중 흰 화면이 아닌 로딩 인디케이터가 보인다.
- [ ] 사이드바의 현재 경로 하이라이트가 라우트 이동 시 즉시 업데이트된다.
- [ ] Toast 가 여러 개 연속 호출되어도 쌓이지 않고 순차 표시된다.
- [ ] ConfirmDialog 를 `Esc` 로 닫을 수 있고, 포커스가 호출자로 복귀한다.
- [ ] 리뷰 작성 중 창 닫기 → 자동저장된 draft가 재진입 시 복원된다.

---

## 5. 결과 기록 템플릿

```
일시: YYYY-MM-DD HH:MM
환경: dev / prod / 로컬
브라우저: Chrome XXX
통과: N / 43
이슈:
  - [id] 설명 / 재현 / 영향
```
