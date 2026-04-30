# 인수인계 문서 — 2026-04-30 (디자인 정리 + 가이드 완성)

> 같은 날 다른 영역 인수인계: `docs/handoff-2026-04-30.md` (R8 자동 승인 모드).
> 두 문서 + 어제 4개 (`handoff-2026-04-28.md`, `handoff-2026-04-29.md`,
> `handoff-2026-04-29-design.md`, `handoff-2026-04-29-security.md`) 와 함께 보면 흐름 명확.

---

## 1. 프로젝트 현재 상태

- **위치**: `/Users/makestar/review-mvp` · 브랜치 `main`
- **단계**: 디자인 토큰화 + 카드형 UI deprecate wrap-up + 가이드 캡처 25/25 완성
- **DB**: Google Sheets 유지 (변동 없음)
- **Apps Script 위치**: `~/Desktop/apps-script/ReviewFlow.gs` (1,357줄). main repo 와 분리
- **배포 상태**:
  - GitHub: `d9a7e96` (origin/main) — 본 세션 작업 17 commit push 완료
  - **Vercel: 자동 배포 트리거** (`d9a7e96` push 시점). production URL 에서 확인 필요
  - **Apps Script 미배포 ⚠️ (이전부터)**: `fadbc0e` (어제, B-2.4 dedupe) + 오전 R8 자동 승인 묶음 — 여전히 한 번 deploy 필요. 본 세션은 클라이언트만 변경, Apps Script 변경 없음
- **Dev 서버**: 5174 (5173 free)
- **마지막 검증**: build 그린 / 36/36 tests / lint 변경 라인 클린 / dev 5174 200

### 본 세션 commit 흐름 (최신 → 과거)

```
d9a7e96 docs(guide): 미구현 4건 캡처 + 문서 갱신 (Phase G-4.82 — 가이드 완성)
067876a feat(team): 평가권자 배정 모달 — CRUD (Phase G-4.81 + G-4.82)
d965f63 feat(team): MemberProfileDrawer 평가권자 섹션 read-only (Phase G-4.80)
5face5c feat(team): MemberEditDialog 활성상태 드롭다운 (Phase G-4.63)
8e827c6 refactor: 비-시트형 행간 border 제거 (Phase D-3.I 후속 — § 7.6/§ 7.7 정합)
0409be4 refactor: 시트형 행간 border 제거 (Phase D-3.I — § 7.6 정합)
6d8f761 refactor: 텍스트 토큰 마이그레이션 (Phase D-3.H — 안전 3매핑)
78c30a1 fix(template): /templates/new 배경을 다른 페이지와 동일하게 (Phase D-3.G 후속)
afed805 refactor: 나머지 카드 제거 + D-3.G wrap-up (Phase D-3.G-6)
b979769 refactor(reports): 통계형 카드 제거 (Phase D-3.G-5) — divide-x grid
420bedd refactor(content,reviews): 컨텐츠/리뷰 작성 페이지 카드 제거 (Phase D-3.G-4)
b3f4040 refactor(reviews): 폼형 카드 제거 (Phase D-3.G-3)
5c2f0ad refactor(reviews,team): 리스트형 카드 제거 (Phase D-3.G-2)
d5a045a refactor(settings): 외곽 카드 3개 제거 → 섹션 + divide 패턴 (Phase D-3.G-1)
69b8057 feat(review): admin 도 평가자·피평가자로 지정 가능 (옵션 B 모두 포함)
```

(이전 같은 날 R8 자동 승인 + D-3.C/E/F = `7cd03ac` ~ `36739d7` 13건은 `handoff-2026-04-30.md` 참조)

---

## 2. Phase 별 변경 요약

### 2-1. admin 평가자/피평가자 가능 (`69b8057`) — 옵션 B 전면 적용

**배경**: 운영 정책 변경 — admin 도 일반 구성원처럼 사이클 reviewee + reviewer 가 될 수 있어야 함.
어제 `08620f2` 가 reviewer 측 isSystemOperator 거부 룰만 풀었고 후보 리스트/카운트는 미정리.

**선택 옵션**: B (평가/배정/통계 모두 admin 포함, 빙의 시 본인만 제외)

**변경 17곳 / 17 파일**:
- util (5): createCycleSubmissions / resolveTargets / exportUtils / cyclePreflight / autoAdvance
- 페이지·모달 (7): CycleNew(9) / CycleEdit(2) / CycleList / CycleDetail / PeerPickPage / PeerAssignModal / ReassignReviewerModal
- 빙의·대시보드 (5): TeamReviewWrite(2) / TeamReviewList(2) / Dashboard(3) / Reports / PendingApprovals

**미정리 (현재 호출처 0 — 후속 PR 에서 함수 자체 제거 가능)**: `isSystemOperator()` 함수 (src/utils/permissions.ts L39)

**유지된 항목 (의미 다름)**:
- authStore / SchedulerTick / OpsImpactBanner — 현재 actor 의 admin 권한 체크
- teamStore — admin 권한그룹 자동 멤버
- migrations/r1_org_redesign.ts — 마이그레이션 과거 시점 코드

**영향**:
- admin 본인이 사이클 대상에 포함되면 본인 self-review submission 도 생성됨
- 빙의 흐름: admin → admin 빙의 가능, 본인 빙의는 막힘 (`u.id !== currentUser?.id`)

### 2-2. D-3.G 카드형 UI 제거 wrap-up (`d5a045a` ~ `78c30a1`) — 7 commit

**배경**: `docs/ui-tokens.md` § 4-3 의 카드형 UI deprecate 정책 (`bg-white rounded-xl border + shadow-card` 패턴) 41+ 사용처 점진 마이그레이션.

**Phase 분리**:

| Phase | 커밋 | 패턴 적용 |
|---|---|---|
| G-1 Settings | `d5a045a` | 외곽 카드 3개 → 섹션 + `divide-y divide-bd-default` |
| G-2 리스트형 | `5c2f0ad` | MyReviewList(7) / TeamReviewList(4) / PendingApprovals(1) — 외곽 카드 제거, 행 구조 유지 |
| G-3 폼형 | `b3f4040` | CycleNew(3) / CycleEdit(1) / TemplateBuilder(1) — 평면 + border-only |
| G-4 컨텐츠·작성 | `420bedd` | Feedback(4) / Goals(3) / TeamReviewWrite(1) / MyReviewWrite(4) — 평면 + border |
| G-5 통계형 | `b979769` | Reports(8) — KPI grid `md:divide-x md:divide-bd-default` (AdminCycleWidget 패턴), 차트 카드 평면 + border |
| G-6 나머지 | `afed805` | BulkMove / CycleArchive / Notifications |
| G 후속 | `78c30a1` | TemplateBuilder root wrapper 의 `bg-gray-005` 제거 (다른 페이지와 배경 통일) |

**§4-3 예외 (정상 유지)**:
- Login.tsx, PendingApproval.tsx — 부트스트랩 / 로그인 surface
- Toast / NotificationPanel / MemberProfileDrawer / ErrorBoundary 등 overlay
- 모든 모달 (`shadow-modal`)
- sticky bar (`shadow-raised`) — 떠 있는 시각성 정당
- segmented inline 컨트롤 active 시 `bg-white shadow-sm` 약화

### 2-3. 텍스트 토큰 마이그레이션 (`6d8f761`) — Phase D-3.H

**옵션**: A (안전 3 매핑만, 시각 변화 0)

| Raw | hex | 토큰 | hex | 동등 | 빈도 |
|---|---|---|---|---|---|
| `text-gray-099` | `#111417` | `text-fg-default` | `#111417` | ✅ | 77 |
| `text-gray-050` | `#6d7f92` | `text-fg-subtle` | `#6d7f92` | ✅ | 122 |
| `text-gray-040` | `#8a99a8` | `text-fg-subtlest` | `#8a99a8` | ✅ | 323 |

**수단**: `find + perl -i \b` word-boundary 일괄 치환. **78 파일 / 512 치환**.

**미적용 (별도 phase 필요)**:
- `text-gray-080` (101) — `text-text-primary` 매핑 시 -9 RGB
- `text-gray-070` (72) — `text-text-primary` 매핑 시 -25 RGB
- `text-gray-060` (76) — `text-text-secondary` 매핑 시 +60 RGB ⚠️
- `text-gray-030/020` — 토큰 매핑 자체 없음

→ **디자이너 결정 후 별도 phase**. 새 토큰 정의 (`text-fg-strong` 등) 도 옵션.

### 2-4. 시트형 행간 border 제거 (`0409be4` + `8e827c6`) — Phase D-3.I

§ 7.6 본문 "행 사이 명시 border-b — 시트형은 hover 효과만으로 구분" 정합.

**시트형 메인 리스트 (`0409be4`, 4곳)**: MyReviewList ReviewRow + ReceivedReviewRow / TeamReviewList CycleRow / CycleArchive row
**비-시트형 (시트형 정합) (`8e827c6`, 3곳)**: Dashboard activity feed + 최근 리뷰 / TeamReviewWrite tree node (§ 7.7)

**미적용 (의미 다름 — 정보 표)**: CycleNew preview row (label-value 정보 표) — border-b 가 핵심 시각 분리, 그대로 유지

**hover 패턴 변경**: `hover:bg-gray-005/70` → `hover:bg-interaction-hovered` (§ 4-1 semi-transparent 토큰)

### 2-5. 가이드 미구현 4건 완성 (`5face5c` ~ `d9a7e96`) — Phase G-4

handoff-2026-04-29 에 남겨진 가이드 미구현 4건 모두 UI 추가 + 캡처. **가이드 25/25 (review-cycle 12 + team 13) 완성**.

| Phase | 커밋 | 변경 |
|---|---|---|
| G-4.63 | `5face5c` | MemberEditDialog 에 "근무 상태" 섹션 — `activityStatus` 5종 select (정상 / 단기 / 장기 / 퇴사 / 기타) + `statusReason` 옵션 + 안내 문구. statusChangedAt 자동 갱신. 기존 "퇴사 처리" 버튼 (terminateMember 흐름) 은 보고관계 자동 정리 포함이라 보존 |
| G-4.80 | `d965f63` | MemberProfileDrawer 에 평가권자 카드 (read-only). active ReviewerAssignment 들을 rank 별 정렬 표시. UserAvatar + source pill (조직장 자동 / 수동 지정 / 엑셀 일괄) |
| G-4.81+82 | `067876a` | `src/components/team/ReviewerAssignmentModal.tsx` 신규 생성. ModalShell 기반, rank select (1~5) + reviewer 검색 + 추가 버튼. 활성 평가권자 list (rank 정렬) + 제거 버튼 (group-hover). drawer "편집" 버튼 → 모달. 권한 체크: `can.manageReviewerAssignments` |
| G-4.82 (캡처) | `d9a7e96` | 캡처 자동화 스크립트 시드에 reviewerAssignments 추가 (M002 박개발 1차/2차) + 캡처 시퀀스 추가 (63/80/81/82). docs/guide-screenshots.md 갱신 |

**모달 닫기 graceful 처리**: drawer + modal z-index 충돌로 닫기 timeout 가능 — `click({ force: true, timeout: 2000 }).catch(() => {})` 으로 무시. 캡처 자체엔 영향 없음.

---

## 3. 함정 / 주의

1. **`isSystemOperator()` 함수는 본 세션 후 호출처 0** — `src/utils/permissions.ts L39` 에 정의만 남음. 다음 PR 에서 함수 + 관련 import/comment 모두 제거 가능. 단 의미적 헬퍼라 다른 의미로 재사용 가능성 검토 필요

2. **D-3.G 잔여 8곳 모두 §4-3 예외**:
   - Login.tsx / PendingApproval.tsx — 부트스트랩 surface
   - 모든 sticky bar (`shadow-raised`)
   - 모든 모달 (`shadow-modal`)
   - segmented inline 컨트롤 active (`bg-white shadow-sm`)
   - dead code 모달 (`{false && ...}`)

3. **텍스트 토큰 마이그레이션은 hex 동일 매핑만** — 080/070/060 적용 시 시각 회귀 위험. 디자이너 검토 후 phase 분리 필요

4. **`MemberEditDialog` 의 "근무 상태" 섹션 + 하단 "퇴사 처리" 버튼은 의미 분리**:
   - 활성상태 드롭다운: status flag 만 변경
   - 퇴사 처리 버튼: status='terminated' + 보고관계 자동 정리 + leaveDate 입력
   - terminated 선택 시 안내 문구로 두 흐름 차이 설명

5. **가이드 캡처 스크립트의 reviewerAssignments 시드 추가**: 시드 변경으로 모든 캡처의 권한 계산 변동 → 거의 모든 png 가 미세 픽셀 변경. 의미 동일

6. **Vercel 자동 배포는 main 브랜치 push 시 트리거** — `d9a7e96` 가 production 배포 시작점. CLI 없이 상태 polling 안 됨, 대시보드 확인 필요

7. **`b663c0e` TEMP SSO 우회는 어제(`f464ecc`) 이미 제거됨** — 메모리/handoff-2026-04-30.md § 3-2 에 stale 정보 있었음. 본 세션에서 메모리 정정 완료 (`project_review_mvp.md` L23)

---

## 4. 배포 체크리스트

### 4-1. 즉시 처리

- [ ] **Vercel 배포 production 확인** — 대시보드에서 `d9a7e96` 빌드 성공 + URL 응답 확인
- [ ] **Apps Script 배포** ⚠️ (어제부터 미배포, 본 세션과 무관): `fadbc0e` (B-2.4 dedupe) + 오전 R8 변경 (자동 승인 모드) 묶어서 1회 deploy. GAS 에디터에서 새 버전 → V1 sanity (verifyGoogleLogin / setSetting / getSetting 200 응답) → 토글 OFF default 회귀 확인

### 4-2. 외부 시연 / 도입 협상 시작 전

- [ ] 자동 승인 모드 ON 운용 기간 설정 (배포 직후 1~2주 권장)
- [ ] git history `a52d65b` 의 OAuth Client ID rotate (어제 보안 phase § 1 잔여 P0)

### 4-3. 데이터 import (별도 진행)

- [ ] Workspace Admin csv → `_구성원` 일괄 사전 등록 (사용자가 타 부서와 협업)

---

## 5. 잔여 작업 (다음 phase 단서)

### 가까운 우선순위

1. **`isSystemOperator()` 함수 자체 제거** — 호출처 0, 안전한 정리
2. **임시 사번 → 정식 사번 변경 함수 (`migrateUserId`)** — handoff-2026-04-30 § 4 참조. 자동 승인된 `auto_*` 사번 변경 시 권한그룹/평가권자/제출 모두 갱신 필요
3. **Settings 토글 카드에 "자동 승인된 보강 필요 멤버: N명" 카운트** — handoff-2026-04-30 § 4 참조
4. **`/team` "보강 필요" 필터 탭** — handoff-2026-04-30 § 4 참조

### 멀리

5. **텍스트 토큰 080/070/060 의미 매핑** — 디자이너 결정 후 별도 phase. 옵션:
   - 새 토큰 (`text-fg-strong`, `text-fg-medium`) 정의 + tailwind config 추가
   - 또는 080→primary / 070→primary / 060→secondary (시각 회귀 검토 후)
   - 또는 그대로 유지 (raw hex)
6. **B 그룹 audit 잔여 (B2/B7/B8/B11/B12)** — `docs/stability-audit-B.md` 167줄 참조
7. **CycleNew preview row 의 label-value 정보 표** — D-3.I 미적용. 정보 표 의미 유지하되 시각 토큰화 검토

---

## 6. 변경 파일 (본 세션, 누적)

```
src/components/team/MemberEditDialog.tsx                  (G-4.63)
src/components/team/MemberProfileDrawer.tsx               (G-4.80)
src/components/team/ReviewerAssignmentModal.tsx           (G-4.81 신규)
src/utils/createCycleSubmissions.ts                       (admin 옵션 B)
src/utils/resolveTargets.ts                               (admin)
src/utils/exportUtils.ts                                  (admin)
src/utils/cyclePreflight.ts                               (admin — stale 주석 제거)
src/utils/scheduler/jobs/autoAdvance.ts                   (admin)
src/pages/reviews/CycleNew.tsx                            (admin + D-3.G-3)
src/pages/reviews/CycleEdit.tsx                           (admin + D-3.G-3)
src/pages/reviews/CycleList.tsx                           (admin)
src/pages/reviews/CycleDetail.tsx                         (admin)
src/pages/reviews/CycleArchive.tsx                        (D-3.G-6 + D-3.I)
src/pages/reviews/MyReviewList.tsx                        (admin + D-3.G-2 + D-3.I)
src/pages/reviews/MyReviewWrite.tsx                       (D-3.G-4)
src/pages/reviews/TeamReviewList.tsx                      (admin + D-3.G-2 + D-3.I)
src/pages/reviews/TeamReviewWrite.tsx                     (admin + D-3.G-4 + D-3.I 후속)
src/pages/reviews/TemplateBuilder.tsx                     (D-3.G-3 + D-3.G 후속 배경)
src/pages/reviews/PeerPickPage.tsx                        (admin)
src/components/review/modals/PeerAssignModal.tsx          (admin)
src/components/review/modals/ReassignReviewerModal.tsx    (admin)
src/pages/Dashboard.tsx                                   (admin + D-3.I 후속)
src/pages/Reports.tsx                                     (admin + D-3.G-5)
src/pages/Feedback.tsx                                    (D-3.G-4)
src/pages/Goals.tsx                                       (D-3.G-4)
src/pages/Settings.tsx                                    (D-3.G-1)
src/pages/Notifications.tsx                               (D-3.G-6)
src/pages/team/BulkMove.tsx                               (D-3.G-6)
src/pages/team/PendingApprovals.tsx                       (admin + D-3.G-2)

(+ D-3.H 78 파일 / 512 치환 — 위 파일 다수 포함, catalyst/* 도 포함)

scripts/capture-guide-screenshots.mjs                     (G-4.82 — 시드 + 캡처 시퀀스)
docs/guide-screenshots.md                                 (G-4.82 — 미구현 4건 → 정식 등록)
public/guide-images/team/63-member-status.png             (신규)
public/guide-images/team/80-reviewer-section.png          (신규)
public/guide-images/team/81-reviewer-modal.png            (신규)
public/guide-images/team/82-reviewer-ranks.png            (신규)
docs/handoff-2026-04-30-design-and-guide.md               (이 문서)
```

---

## 7. 다음 에이전트가 알아야 할 핵심 결정 (Quick reference)

- **운영 정책**: admin 도 사이클 reviewee/reviewer 가 될 수 있다 (옵션 B 전면 적용)
- **디자인 정책**: 페이지 표면은 단일 white surface. 카드형 UI deprecate (§ 4-3). 41+ 사용처 정리 완료, 8곳 §4-3 예외만 잔존
- **시트형 정책**: 행 사이 명시 border-b 금지 (§ 7.6). hover-only 시각 분리. 7곳 정리 완료 (시트형 4 + 시트형 정합 3)
- **텍스트 토큰**: hex 동일 3매핑 완료 (522건). 080/070/060 은 디자이너 결정 대기
- **가이드**: 25/25 캡처 완료. 가이드 페이지 자체는 G-3 phase 에서 이미 작성됨
- **Apps Script**: 어제 + 오전 R8 변경 묶어 1회 deploy 필요 — 본 세션에서 변경 없음
- **빙의 정책**: admin → admin 빙의 가능 (`u.id !== currentUser?.id` 본인만 차단). admin 빙의 시 리뷰 작성·제출 가능 (R5-b 정책)
