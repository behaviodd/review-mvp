# 가이드 스크린샷 캡처 명세서

> `/guide/*` 페이지에 사용되는 스크린샷 캡처 가이드. 본 문서를 따라 캡처해 `public/guide-images/<category>/` 에 저장하면 즉시 가이드 페이지에 반영됩니다.

---

## 1. 공통 규칙

### 해상도·DPR
- 기준 너비: **1440px** (데스크탑 표준)
- DPR (device pixel ratio): **2x** (Retina) — 결과 PNG 는 2880px 가로
- 가이드 본문 max-width 는 760px → 자동 축소되어도 선명도 유지

### 파일 포맷
- **PNG** (jpg 금지 — 텍스트 압축 손실)
- 저장 위치: `public/guide-images/<category>/<번호>-<설명-슬러그>.png`
- 번호 prefix 는 페이지 순서(`01`, `02`, ... `10`, `11`...) — 페이지별 그룹핑용

### 캡처 도구
- **macOS 권장**: ⌘+Shift+5 → "선택 영역 캡처" → 영역 드래그
- 브라우저 개발자도구의 "Capture node screenshot" 으로 단일 컴포넌트 영역만 깔끔하게 캡처 가능

### 어노테이션 (선택)
- 색상: 브랜드 핑크 `#FF558F` (hover/focus 의 fg-brand1)
- 두께: 2~3px
- 화살표/박스만 — 텍스트 라벨은 가이드 본문에 적도록 분리
- 도구: macOS Preview / Skitch / CleanShot X

### 화면 상태
- **로그인 상태**: admin 권한 사용자
- **데이터**: 실데이터 사용 시 **PII 마스킹 필수** (이름·이메일·사번). 가능하면 데모 데이터 활용
- **브라우저 chrome**: URL 바 / 탭 표시줄 등은 잘라낼 것 (앱 화면만)
- **사이드바**: 항상 펼친 상태로 (모바일 메뉴 X)

---

## 2. review-cycle/template.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 01 | `01-template-list.png` | `/templates` | 템플릿 목록 페이지 전체 | 검색창·페이지네이션 보이게 |
| 02 | `02-template-builder-empty.png` | `/templates/new` (또는 신규 진입) | 빌더 진입 직후 — 빈 섹션 1개 + 자동 편집 모드 | 섹션 이름 입력란 강조 |
| 03 | `03-template-sections.png` | `/templates/<existing>` | 섹션 2~3개 + 질문 4~6개가 채워진 상태 | 드래그 핸들 또는 "질문 추가" 버튼 |

---

## 3. review-cycle/publish.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 10 | `10-cycle-new.png` | `/cycles/new` | 새 사이클 폼 진입 직후 | 제목·템플릿·종류·차수 영역 |
| 11 | `11-cycle-targets.png` | `/cycles/new` | 대상자 지정 섹션 | 조직 일괄 선택 / 개별 추가 |
| 12 | `12-preflight.png` | `/cycles/new` → 발행 시도 | 사전 점검 모달 — **차단 1건 + 경고 1건** 시나리오 | 차단(빨강)/경고(주황) 아이콘 + 멤버 이름 노출 |

**시나리오 만드는 팁 (preflight 캡처용)**
- 차단: 평가권자 미배정 멤버 1명을 일부러 포함시키기 (managerId 비워서)
- 경고: 자기평가 마감을 토요일로 설정 → "주말 마감" 경고 발생

---

## 4. review-cycle/operate.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 20 | `20-cycle-detail.png` | `/cycles/<id>` | 사이클 상세 페이지 진입 직후 | 사이클 제목·상태 헤더 |
| 21 | `21-cycle-kpi.png` | `/cycles/<id>` | 첫 섹션 (총 대상 + 자기평가 완료 + 조직장 리뷰 완료 + 일정) 영역만 | 4가지가 한 줄로 묶여있는 모습 |
| 22 | `22-ops-center.png` | `/cycles/<id>` | 운영센터 영역 — 세그먼트 + KPI 스트립 + 필터 + 테이블 | 평면화된 시트 패턴 (세로 + 가로 라인) |

---

## 5. review-cycle/close.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 30 | `30-cycle-close.png` | `/cycles/<id>` (마감 도래 상태) | 우상단 종료 액션 영역 | 종료 버튼/모달 |
| 31 | `31-received.png` | `/reviews/received` | 받은 리뷰 페이지 | 본인이 받은 평가 1~2개 노출 (PII 마스킹) |
| 32 | `32-archive.png` | `/cycles/archive` | 보관함 목록 페이지 | 보관된 사이클 1~2개 |

---

## 5b. team/invite-approve.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 50 | `50-pending-approvals-list.png` | `/team/pending-approvals` | 대기승인 큐 목록 1~3건 | 사번 미발번 / status=pending 행들 |
| 51 | `51-approve-form.png` | `/team/pending-approvals` → 행 클릭 | 승인 폼 모달 (`role="dialog"`, `ApproveDialog`) | 사번/직무/보고대상/권한그룹 입력 영역 |

## 5c. team/profile.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 60 | `60-team-page.png` | `/team` | 좌 멤버 + 우 조직도 페이지 | 좌우 패널 분할 |
| 61 | `61-member-drawer.png` | `/team?member=<id>` | 멤버 drawer 진입 직후 | 기본 정보 |
| 62 | `62-member-edit.png` | `/team?member=<id>&action=edit` | drawer 편집 모드 | 입력 필드들 |
| 63 | `63-member-status.png` | `/team?member=<id>&action=edit` | MemberEditDialog 안 "근무 상태" 섹션 + activityStatus select | 정상/단기/장기/퇴사/기타 5종 |

## 5d. team/org-tree.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 70 | `70-org-panel.png` | `/team` | 우측 조직도 패널만 (366px 고정폭) | 트리 구조 (회사 → 부서) |
| 71 | `71-org-add.png` | `/team` → "+" 버튼 클릭 | 조직 추가 다이얼로그 (OrgUnitDialog) | 이름/조직장 입력 영역 |
| 72 | `72-org-dnd.png` | `/team` (`dispatchEvent('dragover')` 강제) | DnD 드롭 인디케이터 표시 | 위/아래(`h-0.5 bg-fg-brand1`) / 안(`ring-2 ring-fg-brand1`) |
| 73 | `73-org-head.png` | `/team` → 조직 노드 메뉴 → 편집 | OrgUnitDialog 의 조직장 드롭다운 | "조직장" select |

## 5e. team/reviewer.md

| # | 파일명 | URL | 상태 / 영역 | 강조 |
|---|---|---|---|---|
| 80 | `80-reviewer-section.png` | `/team?member=<id>` | drawer 안 평가권자 카드 (read-only) | 1차/2차 rank pill + UserAvatar + source pill |
| 81 | `81-reviewer-modal.png` | drawer → 평가권자 카드 "편집" 버튼 | ReviewerAssignmentModal — 활성 list + 추가 영역 | rank select + reviewer 검색 |
| 82 | `82-reviewer-ranks.png` | 81 모달 안 | rank 별 활성 평가권자 결과 (1차+2차+...) | source pill (조직장 자동/수동 지정) |

## 6. 작업 체크리스트

리뷰 사이클 카테고리 캡처는 총 **12장**, 구성원 관리 카테고리는 **13장**:

### template.md
- [ ] `01-template-list.png`
- [ ] `02-template-builder-empty.png`
- [ ] `03-template-sections.png`

### publish.md
- [ ] `10-cycle-new.png`
- [ ] `11-cycle-targets.png`
- [ ] `12-preflight.png`

### operate.md
- [ ] `20-cycle-detail.png`
- [ ] `21-cycle-kpi.png`
- [ ] `22-ops-center.png`

### close.md
- [ ] `30-cycle-close.png`
- [ ] `31-received.png`
- [ ] `32-archive.png`

### invite-approve.md
- [x] `50-pending-approvals-list.png`
- [x] `51-approve-form.png`

### profile.md
- [x] `60-team-page.png`
- [x] `61-member-drawer.png`
- [x] `62-member-edit.png`
- [x] `63-member-status.png` — Phase G-4.63 구현 + 캡처 완료

### org-tree.md
- [x] `70-org-panel.png`
- [x] `71-org-add.png`
- [x] `72-org-dnd.png` — Playwright `dispatchEvent('dragover')` 로 캡처
- [x] `73-org-head.png` — OrgUnitDialog 편집 모드의 조직장 드롭다운으로 의미 재정의

### reviewer.md
- [x] `80-reviewer-section.png` — Phase G-4.80 구현 + 캡처 완료
- [x] `81-reviewer-modal.png` — Phase G-4.81 구현 + 캡처 완료
- [x] `82-reviewer-ranks.png` — Phase G-4.81 구현 (81 모달 안 동일 화면) + 캡처 완료

---

## 7. 캡처 후 워크플로

1. `public/guide-images/review-cycle/` 폴더에 파일 복사
2. dev 5174 → `/guide/review-cycle/template` 부터 순서대로 시각 확인
3. 의도와 다르면 재캡처 (해상도/잘림/마스킹 누락 등)
4. 모두 OK 면 `git add public/guide-images/ && git commit`
5. 스크린샷이 생기면 자동으로 페이지에 반영됨 (markdown 의 `![](path)` 가 그대로 매칭)

---

## 8. 향후 다른 카테고리 추가 시

- `team`, `permissions`, `operations`, `getting-started`, `faq` 카테고리도 동일 패턴 사용
- 카테고리별 번호 prefix 는 새로 시작 (`team` 도 `01`, `02`, ... 부터)
- 본 문서 § 2~5 같은 표를 추가해 명세 유지

---

작성: 2026-04-29 · Phase G-3.
