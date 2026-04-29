# 인수인계 문서 — 2026-04-29 (디자인 작업)

> 본 세션의 **두 번째 영역** — UI 디자인 정합 (Figma "Admin Master UI Guidelines" 기준).
> 같은 날의 첫 번째 영역 (안정성 audit B 그룹) 인수인계는 `docs/handoff-2026-04-29.md` 참조.
> 두 문서를 함께 읽으면 본 세션 전체 흐름 파악 가능.

---

## 1. 프로젝트 현재 상태 (디자인 영역)

- **위치**: `/Users/makestar/review-mvp` · 브랜치 `main` · origin 동기화
- **단계**: **Phase D-1 + D-2.1 ~ D-2.4 모두 완료**.
- **Figma 참조**: `60pY6exMF1N4RI8o4Dy5Cs` "Admin Master UI Guidelines"
  - 가이드라인 페이지: `1143:33550`
  - 마스터 화면: `1143:15585`
  - 구성원 페이지: `1143:13721` (D-2.4 의 1:1 정합 대상)
- **다음 사용자 우선순위 미정** — D-2.5 모바일 정비 / 카드형 UI 일괄 제거 / 다른 페이지 디자인 정합 중 선택
- **마지막 검증**: build ✅ · test 36/36 ✅ · dev 5174 200 ✅

### 본 세션 디자인 commit 흐름 (최신 → 과거)

```
eadd1ac D-2.4c — 우측 조직도 패널 재설계 + 좌우 개별 스크롤 (Phase D-2.4 완료)
699f8e7 D-2.4b-fix — 페이지 배경 white 통일 + 카드형 UI deprecate
6bcc415 D-2.4b — 좌우 패널 역전 + MemberRow 시트형
17401ac D-2.4a-fix2 — 헤더 버튼/검색 높이 40 정합
9da4814 D-2.4a-fix — 토큰 갱신 + Header/Tab 1px border 룰
faaa226 D-2.4a — Team.tsx PageHeader 슬롯 + 본문 정리
9eacd40 D-2.3 — Tab strip 신규 컴포넌트
12ee006 D-2.2 — Header 정비 + PageHeader 토큰 정합
c6f9129 D-2.1 — Sidebar (LNB) Figma 정합 재설계
14bdede D-1.1 + D-1.4 + D-1.3 — 시각 정비 (배경 / shadow / letter-spacing)
e65d547 D-1.2 — 디자인 토큰 Figma 정합
```

---

## 2. Phase 별 변경 요약

### Phase D-1 — 토큰 + 기본 시각 정비

| Sub | 변경 |
|---|---|
| D-1.2 | `--token-bg-subtle` → `#f8f9fa`, `--token-border-default` → `#dfe7e9`, `--token-bg-accent-brand1-subtlest` → `#fbe9f1`, `--token-interaction-{hovered,pressed}` base color → `#4c5a66`, `--token-border-primary` 신규 (#dee2e6) |
| D-1.1 | AppLayout 의 raw `bg-gray-005` 제거 — body 토큰 단일 출처 |
| D-1.4 | `boxShadow.card / card-hover` 값을 `'none'` 으로 무효화 — 36+ 사용처 자동 적용. `.card` 클래스에서 shadow 제거 |
| D-1.3 | body 글로벌 letter-spacing `-0.3px` |

### Phase D-2.1 — Sidebar (LNB) 재설계

Figma `ADM / LNB / *` 정합. 매우 큰 구조 변화.
- 로고 + User ID 통합 박스 컨테이너 (Container/Header)
- User ID: 평면 → **박스** (border + bg-bg-token-subtle + rounded)
- 메뉴 항목: 단일 → **outer/inner 중첩 컨테이너**
- 아이콘 16 → 20px, chevron 제거
- SubTitle: 10 uppercase tracking-wider → 12 SemiBold sentence-case
- 메뉴 텍스트 weight 통일 (활성/비활성 모두 bold)
- admin 섹션 indent (`md:ml-1.5`) 제거
- raw 색상 → semantic 토큰 (`text-fg-*`, `bg-bg-token-*`, `border-bd-*`, `hover:bg-interaction-hovered`)
- `interaction` 토큰 alias 신규 (tailwind config)

### Phase D-2.2 — Header 정비

- 높이 72 → **92px** (Figma)
- 타이틀 `text-xl 20/28` → **`text-2xl Bold leading-10`** (Display/Small)
- subtitle 분기 (있을 때 leading-7 축소)
- raw 팔레트 → semantic 토큰

### Phase D-2.3 — Tab strip 신규 컴포넌트

- `PageHeaderContext` 에 `tabs` / `tabActions` slot 추가
- `HeaderTab.tsx` 신규 — 단일 탭 아이템 (활성 시 border-b-2 + fg-default)
- `HeaderTabsBar.tsx` 신규 — Header 다음 자동 렌더 (slot 비면 null)
- 기존 "콘텐츠 영역 TAB 금지" 정책 폐기 → 헤더 탭 / 세그먼트 탭 분리
  - 페이지 1차 분류 / view toggle = **헤더 탭**
  - 콘텐츠 영역 안 세부 필터 = **ListToolbar segments**

### Phase D-2.4 — 구성원 페이지 (Team.tsx) 본격 정합

5개 sub commit (D-2.4a / D-2.4a-fix / D-2.4a-fix2 / D-2.4b / D-2.4b-fix / D-2.4c):

**D-2.4a + fix2**: PageHeader 슬롯 활용 + 본문 정리
- 헤더 actions: 검색 input (h-10) + "구성원 추가" 버튼 (size="lg" h-10)
- 헤더 tabs: "전체" 단일 탭
- 헤더 tabActions: 퇴사자 토글 (`terminatedUsers.length > 0` 일 때)
- 본문에서 Stats 카드 / 동기화 배지 / 큰 검색 바 / 퇴사자 토글 모두 제거

**D-2.4a-fix**: Figma 토큰 갱신 + Header/Tab 1px border 룰
- `--token-bg-default` `#fcfdfd → #ffffff`
- `--token-border-subtlest` base `3b454f → 4c5a66`
- `--token-text-primary/secondary` 신규 (`#212529`, `#868e96`)
- Header 가 tabs/tabActions 있을 때 `border-b` 제거 — Tab strip 의 단일 1px

**D-2.4b**: 좌우 패널 역전 + MemberRow 시트형
- 카드 컨테이너 (`bg-white rounded-xl border shadow-card`) 제거
- 좌측 = 멤버 (flex-1, 시트형) / 우측 = 조직도 (w-366, border-l)
- MemberRow: Avatar 28→**40px** + name 14 medium → **16 semibold** + sub `position·email` → **`직무·마지막조직`**
- 행간 border 제거 — hover 효과만 (semi-transparent)
- 소속 없음 → 좌측 inline 토글 (사용자 결정 5.a)

**D-2.4b-fix**: 페이지 배경 white 통일 + 카드형 UI deprecate
- body { background: `--token-bg-subtle` → `--token-bg-default` (#ffffff) }
- `.card` 클래스 `@deprecated` 표기
- ui-tokens.md § 4-3 "페이지 표면 정책" 신규 — 카드형 UI 사용 금지 (overlay 류는 예외)

**D-2.4c**: 우측 조직도 패널 재설계 + 좌우 개별 스크롤
- AppLayout `FULL_BLEED_EXACT` 배열 신규 — `/team` 추가
- 페이지 root: `<div className="flex flex-col h-full">` 풀-높이 구조
- 좌우 패널 각자 `overflow-y-auto` (사용자 명시 "개별 스크롤")
- `OrgTreeNode` 재작성: h-7, 들여쓰기 depth*20px, 색 dot 제거, 라벨 depth 0 Bold/그 외 SemiBold, 활성 bg-interaction-hovered
- 우측 헤더: "조직도" 16 Bold + "전체(N)명" 14 subtle (selectAll 트리거)

---

## 3. 디자인 시스템 정합 — 핵심 룰

`docs/ui-tokens.md` 가 정합 산출물의 단일 진실. 본 세션 후 § 추가/갱신 내역:

| § | 내용 | 변경 |
|---|---|---|
| § 4 Elevation | shadow-card / .card 클래스 deprecated 표기 | 갱신 |
| § 4-1 Interaction | `bg-interaction-hovered/pressed` 토큰 (semi-transparent) | 신규 |
| § 4-2 Text 토큰 | `text-text-primary/secondary` Figma 정합 | 신규 |
| **§ 4-3 페이지 표면 정책** ⭐ | 모든 페이지 single white surface, 카드형 UI 사용 금지, 영역 구분 = border 만 | 신규 |
| § 7.1 ListToolbar | "콘텐츠 영역 TAB 금지" 폐기 → 헤더 탭/세그먼트 탭 분리 | 갱신 |
| § 7.3 LNB 패턴 | Sidebar 컴포넌트 룰 (User ID 박스, 메뉴 중첩, SubTitle 등) | 신규 |
| § 7.4 Header 패턴 | Header 컴포넌트 룰 (h-92, 타이틀 24 Bold, Tab 동반 시 border-b 제거) | 신규 |
| § 7.5 Tab strip 패턴 | HeaderTabsBar + HeaderTab 사용 룰 | 신규 |
| § 7.6 시트형 리스트 패턴 | Row 컨테이너, Avatar/Name/Sub 스펙, Action hover | 신규 |
| § 7.7 트리 패턴 | OrgTreeNode 룰 (h-7, depth*20, 색 dot 금지) | 신규 |
| § 7.8 페이지 영역 개별 스크롤 | full-bleed 등록, root 구조, min-h-0 핵심 원칙 | 신규 |

---

## 4. 새로 만들어진 토큰·alias·컴포넌트 (다른 에이전트 참고)

### 토큰 (`src/index.css` + `tailwind.config.js`)

| 토큰 | hex | 사용 |
|---|---|---|
| `--token-bg-default` | `#ffffff` | 페이지 본문 / Header 배경 |
| `--token-bg-subtle` | `#f8f9fa` | 보조 surface (예: User ID 박스) |
| `--token-border-default` | `#dfe7e9` | 카드/필드 보더 |
| `--token-border-primary` | `#dee2e6` | bd.default 와 bd.subtle 사이 단계 |
| `--token-border-subtlest` | `rgba(76,90,102,0.20)` | Avatar border 등 (4c5a66 base 통일) |
| `--token-interaction-hovered` | `rgba(76,90,102,0.08)` | hover 효과 (semi-transparent) |
| `--token-interaction-pressed` | `rgba(76,90,102,0.20)` | active/pressed |
| `--token-text-primary` | `#212529` | 본문 강조 (Fg/Default 보다 약간 옅음) |
| `--token-text-secondary` | `#868e96` | 본문 보조 |

### Tailwind alias (`tailwind.config.js`)

| alias | 매핑 |
|---|---|
| `bg-interaction-hovered` / `pressed` | var(--token-interaction-*) |
| `bd.primary` | var(--token-border-primary) |
| `text.primary` / `secondary` | var(--token-text-*) |

### 신규 컴포넌트 / 헬퍼

| 위치 | 컴포넌트 | 용도 |
|---|---|---|
| `src/components/layout/HeaderTab.tsx` | `HeaderTab` | Tab strip 단일 탭 아이템 (활성/비활성 + onClick) |
| `src/components/layout/HeaderTabsBar.tsx` | `HeaderTabsBar` | Header 다음 자동 렌더 (slot 비면 null) |
| `src/components/ui/UserAvatar.tsx` | `className` prop 추가 | SIZES 외 비표준 크기 (예: size-10) override |
| `src/contexts/PageHeaderContext.tsx` | `tabs` / `tabActions` slot | useSetPageHeader 옵션 확장 |
| `src/components/layout/AppLayout.tsx` | `FULL_BLEED_EXACT` | 정확 매칭 full-bleed (좌우 개별 스크롤 페이지용) |

---

## 5. 다음 작업 후보 (사용자 결정 필요)

### 5-1. 카드형 UI 일괄 제거 (P1) ⭐

§ 4-3 정책 명시 후에도 **36+ 파일** 의 `.card` / `bg-white rounded-xl border shadow-card` 패턴이 그대로 사용 중. shadow 는 D-1.4 에서 무효화됐지만 컨테이너 자체 (border + rounded + bg) 는 잔재.

대상 파일 (find 결과 — § 7.6 § 4-3 정책 적용 미마이그레이션):
- pages: Dashboard, Settings, Reports, Goals, Permissions, Team, Notifications, AuditLog, Feedback, ProfileFieldSettings, Cycles 전체, Team 하위 등 20+
- components: SectionCard, ListToolbar, ErrorBoundary, dashboard/* (2), review/* (6) 등 16+

**작업 분할 권장**:
- D-3.1: SectionCard 컴포넌트 자체 정비 (가장 영향 큰 단일 파일)
- D-3.2: 페이지별 점진 마이그레이션 (Dashboard / Settings / ...)
- D-3.3: review/dashboard 컴포넌트 정비

### 5-2. 모바일 헤더 토큰 정합 (P2)

`AppLayout.tsx` 의 모바일 56px 상단 바가 raw 팔레트 (`bg-white border-gray-020`) 사용 중. 데스크탑 정비 끝났으니 모바일도 동일 토큰화. ui-tokens.md § 7.4 에 모바일 분기 추가.

### 5-3. 다른 페이지 디자인 정합 (P2)

- **Cycles** (사이클 운영) — 리스트 + 디테일
- **Reviews** (받은 리뷰 / 내 작성 / 하향평가) — 평가 UI
- **Dashboard** (홈)
- **Settings**

각 페이지마다 Figma 매칭 노드가 있다면 1:1 정합. 없으면 § 7 패턴 (시트형 리스트 / 트리 / Tab strip 등) 적용.

### 5-4. 미완 항목

- `headerActions` 의 매 키 입력마다 setHeader 발화 — 잠재 lag 우려 (D-2.4a commit 메시지 참조). 미검증, 발견 시 SearchInput 컴포넌트 추출 + debounce
- Sidebar 의 배경이 Figma 정합 상 `elevated/surface/raised` 토큰 (#fcfdfd) 이어야 — 별도 fix 진행 예정

---

## 6. 사용자 협업 컨벤션 — 본 세션에서 추가/갱신된 규칙

`docs/handoff-2026-04-29.md` § 5 (커밋 메시지 다른 에이전트 친화) 그대로 유효.

본 세션에서 추가:
- **결정점이 5+ 개일 땐 옵션 표 + 우선순위 추천 (α/β/γ)** — 사용자가 빠르게 한 줄로 답하기 편함
- **Figma 토큰을 바뀌면 사용자가 명시** ("토큰이 변경되었습니다" 발화 → 재 fetch + 갱신)
- **시각 변화가 미미하면 사용자가 직접 알림** ("체감되는 시각 변화가 없는 것 같습니다") → 단순 토큰 정합보다 구조적 변경 시작 신호
- **(예외) 정책 폐기 결정** ("기존 정책 폐기" 명시 가능) — ui-tokens.md 의 § 7.1 정책 변경 사례

---

## 7. 검증 명령어 (디자인 작업 한정)

```bash
# 빌드 + 타입 체크
npm run build

# 단위 + 통합 테스트
npm test

# Lint (변경 파일만 보려면 grep)
npm run lint 2>&1 | grep -E "<파일이름>" | head -10

# Dev 서버 (5174 포트)
npm run dev -- --port 5174

# 시각 확인 (HMR 자동)
open http://localhost:5174/team
```

각 commit 후 4종 통과 + dev 5174 시각 확인 (사용자 측). 디자인 변경은 build/test 만으로 검증 불충분 — 사용자의 dev 시각 확인이 필수.

---

## 8. 체크리스트 — 새 에이전트 첫 행동 (디자인 작업 이어서)

- [ ] `git log --oneline -15` 으로 본 세션 11건 디자인 commit 흐름 파악
- [ ] **`docs/ui-tokens.md` 정독** — 본 세션의 핵심 산출물. § 4-3 (페이지 표면 정책) 와 § 7.3~7.8 (컴포넌트 패턴) 가 가장 중요
- [ ] 본 핸드오프 (`docs/handoff-2026-04-29-design.md`) + 안정성 핸드오프 (`docs/handoff-2026-04-29.md`) 모두 읽기
- [ ] `npm run build && npm test` baseline 확인
- [ ] dev 5174 띄우고 `/team` 페이지 확인 — Phase D-2.4 의 1:1 정합 결과
- [ ] 다음 작업 사용자와 합의 — § 5 의 5-1 (카드 일괄 제거) 추천 / 5-2~5-3 도 가능

---

## 9. 알려진 함정·주의사항 (디자인 작업)

1. **카드형 UI deprecate** (§ 4-3) — 새 작업에서 `.card` / `bg-white rounded-xl border` 사용 금지. 기존 사용처는 점진 마이그레이션.
2. **시트형 리스트** (§ 7.6) — 행간 border 금지, hover 효과만으로 구분.
3. **Tab strip 동반 시** Header 의 border-b 자동 제거 (Header.tsx 의 `hasTabBar` 분기).
4. **`/team` 은 full-bleed 모드** — 페이지가 자체 height 관리. flex/min-h-0 패턴 깨면 스크롤 동작 안 함.
5. **MemberRow Avatar** 는 SIZES 외 `size-10` (40px) — UserAvatar 의 className override 사용. 다른 시트형 리스트도 동일 패턴.
6. **OrgTreeNode 색 dot 금지** — Figma 정합. ORG_TYPE_COLOR 변수는 panel header (selectedUnit 분기) 에서만 사용.
7. **headerActions 의 검색 input** — 매 키 입력마다 useMemo 재계산. 입력 lag 발생 시 SearchInput 컴포넌트 추출 후처리.
8. **Pretendard JP Variable vs Variable** — 사용자 결정 (a) Variable 유지. JP 교체는 보류 (한국어 only 환경).
9. **Sidebar 배경** — 본 핸드오프 작성 시점에 `bg-bg-token-default` 사용 중. Figma 정합 상 `elevated/surface/raised` (#fcfdfd) 가 맞음. 다음 commit 에서 fix 예정.

---

작성: 2026-04-29 · 본 세션의 두 번째 핸드오프. 다음 에이전트는 § 8 체크리스트로 시작 권장.
