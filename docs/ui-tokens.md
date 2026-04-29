# UI Tokens (Phase 3.3c-1)

디자인 리스킨 대비 · 일관성을 위한 토큰 매트릭스. 새로 만드는 컴포넌트는 이 범위 안에서만 스타일링합니다.

## 1. 색 · Tone

| Tone     | 배경            | 전경(텍스트/아이콘) | 보더               | 쓰임                     |
|----------|-----------------|---------------------|--------------------|--------------------------|
| neutral  | `bg-gray-005`   | `text-gray-070`     | `border-gray-010`  | 기본 · 회색 배지         |
| brand    | `bg-pink-005`   | `text-pink-060`     | `border-pink-010`  | 주요 액션 · 브랜드 강조  |
| info     | `bg-blue-005`   | `text-blue-070`     | `border-blue-020`  | 정보 · 예약·공지         |
| success  | `bg-green-005`  | `text-green-070`    | `border-green-020` | 완료 · OK                |
| warning  | `bg-orange-005` | `text-orange-070`   | `border-orange-020`| 경고 · 마감 임박         |
| danger   | `bg-red-005`    | `text-red-070`      | `border-red-020`   | 파괴적 · 실패 · 지연     |
| purple   | `bg-purple-005` | `text-purple-060`   | `border-purple-010`| 자동화 · 특수 유형       |

- 팔레트 외 임의 HEX 금지.
- 텍스트 단계: `text-gray-099 / 080 / 070 / 050 / 040` 5단.
- 보더 기본: `border-gray-010`. 카드 그림자: `shadow-card`.

## 2. 타이포그래피

| Role       | Tailwind                                            |
|------------|-----------------------------------------------------|
| Page title | `text-xl font-bold text-gray-099 tracking-[-0.3px]` |
| Section h3 | `text-sm font-semibold text-gray-080`               |
| Body       | `text-sm text-gray-080`                             |
| Small      | `text-xs text-gray-050`                             |
| Caption    | `text-[11px] text-gray-040`                         |

## 3. 간격

| 용도              | 값                                       |
|-------------------|------------------------------------------|
| 카드 내부 padding | `p-4`                                    |
| 섹션 사이 gap     | `space-y-4` / `space-y-5` (페이지 레벨)  |
| 칼럼/행 gap       | `gap-2` / `gap-3`                        |
| 모달 padding      | `px-5 py-4`                              |

## 4. Elevation

- ~~`shadow-card`~~ · ~~`shadow-card-hover`~~ — **deprecated (Phase D-1.4)**. 값 `none` 으로 무효화됨
- ~~`.card`~~ 클래스 — **deprecated (Phase D-2.4b-fix)**. 카드형 UI 자체 사용 금지 (§ 4-3 참조)
- `shadow-raised` — 팝오버
- `shadow-modal` — 모달 · 드로어
- `shadow-overlay` — 토스트 · LNB 드롭다운

## 4-3. 페이지 표면 정책 (Phase D-2.4b-fix → D-2.4d 정밀화) ⭐

사용자 명시 결정 (2026-04-29):
- **페이지 본문 배경 = `bg-bg-token-default` (#ffffff)** — body / 콘텐츠 영역
- **Header / Tab strip = `bg-surface-default` (#ffffff)** — 의미 분리 (elevated 의 평평)
- **Sidebar (LNB) = `bg-surface-raised` (#fcfdfd)** — 페이지 위 살짝 띄운 surface (Figma 정합)
- **카드형 UI 사용 금지** — `bg-white rounded-xl border` 로 콘텐츠를 카드처럼 띄우는 패턴 deprecated
- **영역 구분은 border (1-side) + 평면 시트 만으로**

### 표면 토큰 매핑 (Phase D-2.4d)

| 토큰 | hex | Figma | 사용 |
|---|---|---|---|
| `bg-bg-token-default` | `#ffffff` | Color/Bg/Default | 페이지 본문 (body 배경) |
| `bg-surface-default` | `#ffffff` | Elevated/Surface/Default | Header / Tab strip — 페이지 위 평평 |
| `bg-surface-raised` | `#fcfdfd` | Elevated/Surface/Raised | Sidebar (LNB) — 살짝 띄움 |
| `bg-surface-overlay` | `#fcfdfd` | (정의 시) | Popover / Dropdown |
| `bg-surface-sunken` | `#e1e6ea` | Elevated/Surface/Sunken | 패널 안 가라앉은 표면 |

같은 hex 라도 토큰 의미는 다름. 신규 컴포넌트 작성 시 의미에 맞는 토큰 선택.

**대체 패턴**

| 이전 (카드형) | 이후 |
|---|---|
| `bg-white rounded-xl border shadow-card p-4` | 평면 + 적당한 padding (영역이 필요하면 한쪽 border) |
| 페이지 안 박스 컨테이너 | rounded-lg row + hover 효과 (§ 7.6 시트형 리스트) |
| 좌우 패널을 큰 카드로 묶기 | 좌측 평면 + 우측 `border-l border-bd-default pl-6` |

**예외 (카드 아님)**
- Modal / Drawer / Popover — overlay 류는 elevation 가치 있음 (`shadow-modal/raised/overlay` 유지)
- 작은 inline 박스 (예: User ID 박스, badge, Pill) — input/badge 류는 카드와 다름
- `<input>` 등 폼 컨트롤 — border 는 컨트롤 경계로 유지

**기존 .card 사용처** — 36+ 파일. 점진 마이그레이션. 새 작업에서는 `.card` 클래스 금지.

## 4-1. Interaction (Phase D-2.1)

| 토큰 | hex | 쓰임 |
|---|---|---|
| `bg-interaction-hovered` | `rgba(76,90,102,0.08)` | hover 효과 — semi-transparent 가 의도 (raw 색상보다 자연스러운 카스케이드) |
| `bg-interaction-pressed` | `rgba(76,90,102,0.20)` | active/pressed 효과 |

raw 팔레트 (`bg-gray-005` 같은 불투명 클래스) 대신 hover 에는 `interaction` 토큰 사용. Figma `Color/Interaction/*` 정합.

## 4-2. Text 토큰 (Phase D-2.4a-fix)

Figma `Color/Text/*` 가 `Color/Fg/*` 와 별도 그룹으로 정의됨. 사용 의도가 다름.

| 토큰 | hex | Figma 매핑 | 쓰임 |
|---|---|---|---|
| `text-text-primary` | `#212529` | Color/Text/Primary | 본문 강조 텍스트 (Fg/Default `#111417` 보다 약간 옅음) |
| `text-text-secondary` | `#868e96` | Color/Text/Secondary | 본문 보조 텍스트 |
| `text-fg-default` | `#111417` | Color/Fg/Default | 페이지 타이틀 등 가장 어두운 텍스트 |
| `text-fg-subtle` | `#6d7f92` | Color/Fg/Subtle | 메뉴 아이템, label, sub-info |
| `text-fg-subtlest` | `#8a99a8` | Color/Fg/Subtlest | placeholder, count badge, 캡션 |

**규칙**: 페이지 타이틀/임팩트 큰 헤딩 = `fg-default`, 일반 본문 강조 = `text-primary`, 보조 = `text-secondary` 또는 `fg-subtle/subtlest`. 마이그레이션은 점진 (raw `text-gray-099 → fg-default` 우선).

## 5. 버튼 (MsButton)

| Size | h      | padding     | font size   | gap       |
|------|--------|-------------|-------------|-----------|
| sm   | `h-6`  | `px-[8px]`  | `text-xs`   | `gap-0.5` |
| md   | `h-8`  | `px-[8px]`  | `text-sm`   | `gap-1`   |
| lg   | `h-10` | `px-[10px]` | `text-base` | `gap-1.5` |
| xl   | `h-12` | `px-3`      | `text-base` | `gap-2`   |
| xxl  | `h-14` | `px-4`      | `text-lg`   | `gap-2`   |

- 주요 CTA 1개만 `brand1`, 보조는 `outline-default` / `ghost`.
- 위험: `red` (채움) / `outline-red` (외곽).

## 6. 배지 — Pill

| Size | h    | padding  | font size     |
|------|------|----------|---------------|
| xs   | `h-5`| `px-1.5` | `text-[10px]` |
| sm   | `h-6`| `px-2`   | `text-[11px]` |
| md   | `h-7`| `px-2.5` | `text-xs`     |

- Pill에 아이콘 포함 시 `leftIcon` prop 사용.
- 인라인 `<span className="bg-*-005">` 직접 작성 금지 → 항상 Pill.

## 7. 컴포넌트 Catalog

| Component      | 용도                                   | 주의                                 |
|----------------|----------------------------------------|--------------------------------------|
| `ModalShell`   | 작업 단위 모달                         | 한 번에 1개만. ESC·Backdrop 닫힘     |
| `SideDrawer`   | 열어둔 채 탐색 단위                    | `lockBackdrop`으로 위험 작업 격리    |
| `ConfirmDialog`| 네이티브 `confirm()` 대체              | danger tone 시 빨간 CTA              |
| `SectionCard`  | 설정/폼 섹션                           | title/description/actions 슬롯       |
| `Pill`         | 상태·유형·카테고리 배지                | tone 7종 · size 3종                  |
| `EmptyState`   | 목록 비었을 때                         | `variant="inline"` 으로 목록 내 삽입 |
| `Field`        | 폼 필드 공통 쉘                        | required · hint · error 표시 표준    |
| `StatusBadge`  | submission/review/role 상태            | Pill 기반                            |
| `ListToolbar`  | 리스트 페이지 상단 필터/검색 툴바      | segments · search · rightSlot |
| **`Sidebar` (LNB)** | 좌측 네비게이션 — Figma `ADM / LNB / *` 패턴 | § 7.3 참조 — 메뉴 outer/inner 중첩 + 활성 brand1-subtlest, chevron 없음 |

### 7.3 LNB (Sidebar) 패턴 — Phase D-2.1

Figma `ADM / LNB / *` 컴포넌트와 1:1 정합.

**Sidebar 컨테이너 (Phase D-2.4d)**
- `bg-surface-raised border-r border-bd-default` (Figma `elevated/surface/raised` #fcfdfd)
- 페이지 본문 (#ffffff) 위 살짝 띄운 surface 의도 — 단순 white 와 다름

**상단 Header 박스 (로고 + User ID)**
- 컨테이너: `flex flex-col gap-2 px-3.5 py-4 items-start justify-center`
- 로고: `BrandIcon size-[34px] rounded-md` + 앱 이름 `text-sm font-bold text-fg-default leading-5`
- User ID 박스: `bg-bg-token-subtle border border-bd-primary rounded px-2 py-1` + 이메일 `text-xs text-fg-subtle` + more 버튼 `size-[14px]`

**SubTitle (섹션 헤더)**
- 컨테이너: `flex items-center pt-2 px-5 w-full`
- 텍스트: `text-xs font-semibold text-fg-subtlest tracking-[-0.3px] leading-4`
- ❌ uppercase 사용 금지 (sentence case 만)
- ❌ tracking-wider 사용 금지

**메뉴 항목 — 중첩 컨테이너 패턴**
- outer (간격 보장): `flex items-center px-2 py-1 w-full`
- inner (NavLink, 클릭 영역): `flex flex-1 gap-2 items-center min-w-0 px-3 py-2 rounded-md`
- 활성: `bg-bg-token-brand1-subtlest text-fg-brand1`
- 비활성: `text-fg-subtle hover:bg-interaction-hovered`
- 텍스트 weight: 활성/비활성 모두 `font-bold` (Figma 정합)
- 아이콘: `size={20}` 일관
- ❌ chevron 우측 indicator 사용 금지 (Figma 에 없음)
- ❌ admin 섹션 indent (`ml-1.5` 등) 금지 — SubTitle 만으로 그룹 분리

**드롭다운 (사용자 메뉴 등)**
- `absolute left-0 right-0 top-full mt-1 bg-white border border-bd-default rounded-lg shadow-overlay`

### 7.4 Header (PageHeader) 패턴 — Phase D-2.2

Figma `1143:13782` 정합. `usePageHeader()` Context 의 title/subtitle/actions/onBack 슬롯을 받아 렌더.

**컨테이너**
- 기본: `h-[92px] bg-surface-default border-b border-bd-default flex items-center gap-4 px-6 py-3 sticky top-0 z-10`
- 배경: `bg-surface-default` (Phase D-2.4d, Figma `elevated/surface/default` #ffffff) — 페이지 본문 hex 동일하지만 의미 분리
- **Tab strip 동반 시 border-b 제거** (Phase D-2.4a-fix) — `tabs` 또는 `tabActions` 슬롯이 있으면 HeaderTabsBar 가 자체 border-b 를 그으므로 헤더+탭 조합에선 1px 만. Header 컴포넌트 내부에서 자동 처리됨 (`!hasTabBar && 'border-b border-bd-default'`)
- 모바일은 별도 56px 바 (AppLayout.tsx) — 토큰 정합은 이후 Phase 에서

**타이틀 (Display/Small)**
- title 만: `text-2xl font-bold text-fg-default tracking-[-0.3px] leading-10` (24/40)
- title + subtitle: title 의 leading 을 `leading-7` 로 축소 (둘이 함께 92px 안에 수용)
- subtitle: `text-xs text-fg-subtlest mt-0.5 truncate`

**onBack 버튼**
- `size-9 rounded-lg text-fg-subtle hover:bg-interaction-hovered hover:text-fg-default`
- 좌측 chevron 20px

**actions 슬롯**
- 우측 정렬 `flex items-center gap-1.5 flex-wrap justify-end max-w-[60%]`
- primary 버튼은 brand1 채움 (h-10, gap-1.5, px-2.5, rounded-lg) — Figma 정합은 `MsButton size="lg"` 로 자동 충족

**금지**
- ❌ 페이지 본문 상단의 커스텀 `<h1>` → `useSetPageHeader` 만
- ❌ raw 팔레트 (`text-gray-099`, `border-gray-020`) — semantic 토큰 (`text-fg-*`, `border-bd-*`) 사용

### 7.5 Tab strip (HeaderTabsBar) 패턴 — Phase D-2.3

Figma `ADM / Header / Tab` 정합. Header (h-92) 바로 아래의 별도 44px 영역.

**컨테이너** (`HeaderTabsBar` — 자동 렌더, slot 비어있으면 null)
- `hidden md:flex h-[44px] bg-bg-token-default border-b border-bd-default items-center gap-6 px-6 flex-shrink-0`
- 모바일은 일단 hidden — 모바일 디자인 별도 phase 에서 정의

**사용 방법** (`useSetPageHeader` 의 옵션 슬롯)
```tsx
useSetPageHeader('구성원 관리', actions, {
  tabs: (
    <>
      <HeaderTab active>전체</HeaderTab>
      <HeaderTab onClick={() => navigate('?status=pending')}>대기 승인</HeaderTab>
    </>
  ),
  tabActions: (
    <button className="...">필터</button>
  ),
});
```

**HeaderTab 단일 아이템** (`src/components/layout/HeaderTab.tsx`)
- 활성: `border-b-2 border-fg-default text-fg-default`
- 비활성: `border-b-2 border-transparent text-fg-subtle hover:text-fg-default`
- 텍스트: `text-base font-bold tracking-[-0.3px] leading-6` (Figma Title(Bd)/Medium)
- `-mb-px` — 컨테이너 border-b 와 겹치게

**tabActions (우측 작은 버튼 그룹)**
- 자유 ReactNode — 보통 작은 액션 버튼 (h-6, 14px icon, border-bd-subtle, font 12 Bold)
- gap-1.5

**금지**
- ❌ 콘텐츠 영역 안에 직접 `border-b` 탭 그리기 — 헤더 탭 사용
- ❌ ListToolbar `tabs` 슬롯 사용 (deprecated) — 헤더 탭 또는 segments 마이그레이션

### 7.6 시트형 리스트 패턴 — Phase D-2.4b

Figma `Parts/List` 정합. 카드 컨테이너 (bg + border + shadow) 없이 페이지 배경 위에 평면으로 그리는 리스트.

**Row 컨테이너** (예: 멤버 리스트, 사이클 리스트)
- `flex items-center gap-3 min-h-[52px] px-2 py-1.5 rounded-lg group transition-colors`
- 활성/선택: `bg-bg-token-brand1-subtlest`
- 비활성 hover: `hover:bg-interaction-hovered`
- 행 사이 구분선 없음 — 시트 위 평면

**Row 내부 구성**
- 좌측 LeftItem: Avatar 40px (`size-10`), gap-3 으로 다음 영역 분리
- 중앙 Contents: `flex-col flex-1 min-w-0 gap-0.5`
  - 이름/제목: `text-base font-semibold text-fg-default tracking-[-0.3px] leading-6`
  - 부가 정보: `text-sm font-normal text-fg-subtle tracking-[-0.3px] leading-5 truncate`
- 우측 액션: `opacity-0 group-hover:opacity-100` — hover 시 보임. 작은 IconButton (p-1.5 rounded-md, 14px icon)

**금지**
- ❌ 시트형 리스트에 카드 컨테이너 (bg-white + border + shadow) 추가 — 페이지 배경 위 평면 의도
- ❌ 행 사이 명시 border-b — 시트형은 hover 효과만으로 구분
- ❌ 시트형 외 영역에서도 `.card` 클래스 사용 — § 4-3 정책 (카드형 UI deprecate)

### 7.7 트리 (조직도) 패턴 — Phase D-2.4c

Figma `Parts/Tree` (1143:13876) 정합. 우측 패널의 트리 구조.

**Row** (`OrgTreeNode`)
- `flex items-center gap-1 h-7 pr-2 rounded-md` (h-7 = 28px 컴팩트)
- 들여쓰기: `paddingLeft: depth * 20px` (Figma pl-20 / 40 / 60 / 80 / 100)
- 활성/hover: `bg-interaction-hovered` (semi-transparent, 분홍 X)
- DnD drop 표시: `ring-2 ring-fg-brand1 bg-bg-token-brand1-subtlest` (into) / `h-0.5 bg-fg-brand1` (above/below)

**Row 내부 구성**
- Drag handle (canEdit + hover): `MsGrabIcon size={12} text-fg-subtlest`
- Expand chevron: 16px (Figma 정합) — 자식 없으면 `opacity-0 pointer-events-none`
- 라벨: `text-sm tracking-[-0.3px] leading-5 text-fg-default`
  - depth 0 = `font-bold` (Figma 정합 — root 강조)
  - depth >= 1 = `font-semibold`
- 카운트: `text-xs text-fg-subtlest tracking-[-0.3px] leading-4`
- Action 버튼 (canEdit + hover, 14px icon): 구성원추가 / 하위추가 / 편집 / 삭제

**금지**
- ❌ 색 dot (`size-2 rounded-full ${ORG_TYPE_COLOR}`) 사용 — Figma 정합으로 제거됨
- ❌ 활성 시 분홍 카드 (bg-pink-005 ring-2) — semi-transparent 만 사용

### 7.8 페이지 영역 개별 스크롤 패턴 — Phase D-2.4c

좌우 패널이 각자 독립 스크롤 (예: /team 의 멤버 + 조직도) 되어야 하는 페이지는 **full-bleed 모드** 를 사용.

**AppLayout 등록**
- `FULL_BLEED_EXACT` 배열에 정확 매칭 경로 추가 (`AppLayout.tsx`)
- main 이 `overflow-hidden` + Outlet 직접 렌더 — 페이지가 자체 height 관리

**페이지 root 구조**
```tsx
<div className="flex flex-col h-full">
  {/* sticky 영역 (선택, flex-shrink-0 으로 자체 높이) */}
  <PendingApprovalsBanner />

  {/* 본문 — flex-1 min-h-0 으로 남은 공간 차지 */}
  <div className="flex-1 min-h-0 flex">
    {/* 좌측 패널 — 자체 스크롤 */}
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-4">
      ...
    </div>
    {/* 우측 패널 — 자체 스크롤 */}
    <div className="w-[366px] flex-shrink-0 border-l border-bd-default overflow-y-auto px-6 py-4 flex flex-col">
      ...
    </div>
  </div>
</div>
```

**핵심 원칙**
- `min-h-0` 빠뜨리면 flex item 이 부모보다 커질 수 있음 — flex 안에 overflow-y-auto 컨테이너 필수 prop
- 패널 자체에 `overflow-y-auto` + `px-6 py-4` 가 있어 padding 도 함께 스크롤
- 영역 구분은 우측 패널의 `border-l border-bd-default` 만 (페이지 배경 위 평면)

**금지**
- ❌ 좌우 패널을 큰 카드 컨테이너로 묶기 (§ 4-3 카드형 UI deprecate)
- ❌ `h-[calc(...)]` 같은 강제 높이 — flex 기반 height 분배가 안전

### 7.1 ListToolbar 사용 규칙

리스트 페이지(MyReviewList, TeamReviewList, PeerApprovalPage, CycleList, ReceivedReviewList, CycleArchive 등)는 **반드시** `ListToolbar` 를 사용해 필터/검색을 구성합니다.

**대원칙 (2026-04-29 개정 — Phase D-2.3)**

탭 사용 정책이 두 컴포넌트로 명확히 분리됩니다:

| 종류 | 위치 | 컴포넌트 | 쓰임 |
|---|---|---|---|
| **헤더 탭** | Header 바로 아래 (h-44 별도 영역) | `HeaderTab` 안에 `tabs` 슬롯 | **페이지 1차 분류** 또는 **view toggle** (예: 구성원 / 조직도, 사이클 진행 / 종료) |
| **세그먼트 탭** | 콘텐츠 영역 안 ListToolbar | `ListToolbar segments[pills]` | **세부 필터** (상태별, 유형별, 카운트 강조 등) |

- ~~"콘텐츠 영역에 TAB 사용 금지"~~ 정책 폐기 — 헤더 탭은 콘텐츠 영역이 아니므로 충돌 없음
- 단 **콘텐츠 영역 안의 자체 TAB UI** (border-b 강조 탭 직접 작성) 는 여전히 금지 — segments 또는 헤더 탭으로
- ListToolbar 의 `tabs` 슬롯은 **deprecated** — 신규 페이지는 헤더 탭 또는 segments 사용

| 슬롯       | 시각                                            | 쓰임                                      |
|------------|-------------------------------------------------|-------------------------------------------|
| `segments` | pills (≤4 옵션) / select (옵션 多 또는 라벨 길음) | 분류·상태·유형 필터. 여러 개 stack 가능.  |
| `search`   | 우측 정렬, `width='sm'`(56) / `'md'`(80)        | 단일 검색 입력. 페이지에 1개만.           |
| `rightSlot`| 임의                                            | 보조 액션(초기화 등). primary는 PageHeader |
| ~~`tabs`~~ | ~~border-b + count chip~~                        | **deprecated.** segments[pills] 로 대체.   |

**규칙**
- 상태 필터(전체/진행 중/완료/종료됨처럼 카운트 강조 필요)는 `segments[pills]` 의 `count` 필드 사용.
- segments 가 둘 이상이면 `flex-wrap` 으로 자동 다음 줄 배치 (`상태` 다음 `유형` 등).
- search 단독 사용 시 `width='md'` 권장.
- primary action(예: '새 리뷰')은 `useSetPageHeader(title, actions)` 의 `actions` 슬롯, 절대 ListToolbar `rightSlot` 에 넣지 말 것.

**금지**
- ❌ 콘텐츠 영역에 TAB UI (border-b 강조 탭) 사용 — 1차 분류는 LNB 로
- ❌ ListToolbar 우회한 인라인 `<button className="border-b ...">` 탭
- ❌ 페이지마다 다른 색·간격으로 자체 필터 바 구성

### 7.2 EmptyState 사용 규칙

| 상황 | prop                  | 사용 컨벤션                                     |
|------|-----------------------|------------------------------------------------|
| 페이지 자체 빈 (데이터 0) / 필터 결과 0 | `icon`         | 아이콘 1개 + 짧은 안내 + 보조 action            |
| 라우트 dead-end / 권한 없음 / 오류 | `illustration` | 일러스트 + 명확한 복귀 CTA                      |

**illustration variant**

| variant       | 쓰임                                  |
|---------------|---------------------------------------|
| `empty-list`  | 일반 목록 없음 / 잘못된 경로 / 권한 없음 |
| `empty-inbox` | 작성·수신 데이터 없음 (제출물·메일함류) |
| `empty-cycle` | 사이클 자체가 없거나 찾을 수 없음        |

**variant prop**
- 기본 `default` — 페이지 가운데 배치 (큰 패딩)
- `inline` — 점선 박스, 리스트/카드 내부 자리 채움용

**금지**
- ❌ `<div className="text-center py-20 text-gray-040">데이터 없음</div>` 같은 임시 placeholder
- ❌ illustration + icon 동시 지정 (illustration 우선이지만 시각적 혼란)

## 8. 아이콘

- 기본 사이즈: `size={14}` (리스트/배지), `size={16}` (버튼), `size={20}` (헤더/강조).
- 반드시 `aria-label` 또는 주변 텍스트로 컨텍스트 제공.

## 9. 반응형

- 기본 breakpoint: `md` (768px). 모바일 우선 설계.
- 리스트는 `md:grid + style={{ gridTemplateColumns }}`로 CSS 변수 기반. Tailwind JIT-safe.

## 10. 금지 목록

- ❌ `confirm()` · `alert()` · `prompt()` 네이티브 다이얼로그 → `ConfirmDialog`
- ❌ 인라인 HEX 색
- ❌ 임의 Tailwind 색(`bg-yellow-*`, `bg-teal-*` 등 토큰 외)
- ❌ Tailwind 동적 클래스 문자열 조립 (`'grid-cols-[' + n + ']'`) — JIT가 놓침
- ❌ 페이지 본문 상단의 커스텀 `<h1>` → `useSetPageHeader`
